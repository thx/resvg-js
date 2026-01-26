// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

use crate::options::*;
use resvg::usvg::fontdb::{Database, Language};

#[cfg(not(target_arch = "wasm32"))]
use log::{debug, warn};

#[cfg(not(target_arch = "wasm32"))]
use resvg::usvg::fontdb::{Family, Query, Source};

#[cfg(target_arch = "wasm32")]
use wasm_bindgen::JsCast;

#[cfg(target_arch = "wasm32")]
use woff2::decode::{convert_woff2_to_ttf, is_woff2};

/// Loads fonts.
#[cfg(not(target_arch = "wasm32"))]
pub fn load_fonts(font_options: &JsFontOptions) -> Database {
    // Create a new font database
    let mut fontdb = Database::new();
    let now = std::time::Instant::now();

    // 加载指定路径的字体
    for path in &font_options.font_files {
        if let Err(e) = fontdb.load_font_file(path) {
            warn!("Failed to load '{path}' cause {e}.");
        }
    }

    // Load font directories
    for path in &font_options.font_dirs {
        fontdb.load_fonts_dir(path);
    }

    // 加载系统字体
    // 放到最后加载，这样在获取 default_font_family 时才能优先读取到自定义的字体。
    // https://github.com/RazrFalcon/fontdb/blob/052d74b9eb45f2c4f446846a53f33bd965e2662d/src/lib.rs#L261
    if font_options.load_system_fonts {
        fontdb.load_system_fonts();
    }

    set_font_families(font_options, &mut fontdb);

    debug!(
        "Loaded {} font faces in {}ms.",
        fontdb.len(),
        now.elapsed().as_micros() as f64 / 1000.0
    );

    fontdb
}

/// Loads fonts in Wasm.
#[cfg(target_arch = "wasm32")]
pub fn load_wasm_fonts(
    font_options: &JsFontOptions,
    font_buffers: Option<js_sys::Array>,
    fontdb: &mut Database,
) -> Result<(), js_sys::Error> {
    if let Some(ref font_buffers) = font_buffers {
        for font in font_buffers.values().into_iter() {
            let raw_font = font?;
            let font_data = raw_font.dyn_into::<js_sys::Uint8Array>()?.to_vec();

            let font_buffer = if is_woff2(&font_data) {
                convert_woff2_to_ttf(&mut std::io::Cursor::new(font_data))
                    .map_err(|e| js_sys::Error::new(&format!("Failed to decode woff2 font: {e}")))?
            } else {
                font_data
            };
            fontdb.load_font_data(font_buffer);
        }
    }

    set_wasm_font_families(font_options, fontdb, font_buffers);

    Ok(())
}

#[cfg(not(target_arch = "wasm32"))]
fn set_font_families(font_options: &JsFontOptions, fontdb: &mut Database) {
    let mut default_font_family = font_options.default_font_family.clone().trim().to_string();
    // Debug: get font lists
    // for face in fontdb.faces() {
    //     let family = face
    //         .families
    //         .iter()
    //         .find(|f| f.1 == Language::English_UnitedStates)
    //         .unwrap_or(&face.families[0]);
    //     debug!("font_id = {}, family_name = {}", face.id, family.0);
    // }

    let fontdb_found_default_font_family = fontdb
        .faces()
        .find_map(|it| {
            it.families
                .iter()
                .find(|f| f.0 == default_font_family)
                .map(|f| f.0.clone())
        })
        .unwrap_or_default();

    // 当 default_font_family 为空或系统无该字体时，尝试把 fontdb
    // 中字体列表的第一个字体设置为默认的字体。
    if default_font_family.is_empty() || fontdb_found_default_font_family.is_empty() {
        // font_files 或 font_dirs 选项不为空时, 从已加载的字体列表中获取第一个字体的 font family。
        if !font_options.font_files.is_empty() || !font_options.font_dirs.is_empty() {
            default_font_family = get_first_font_family_or_fallback(fontdb);
        }
    }

    fontdb.set_serif_family(&default_font_family);
    fontdb.set_sans_serif_family(&default_font_family);
    fontdb.set_cursive_family(&default_font_family);
    fontdb.set_fantasy_family(&default_font_family);
    fontdb.set_monospace_family(&default_font_family);

    debug!("📝 default_font_family = '{default_font_family}'");

    #[cfg(not(target_arch = "wasm32"))]
    find_and_debug_font_path(fontdb, default_font_family.as_str())
}

#[cfg(target_arch = "wasm32")]
fn set_wasm_font_families(
    font_options: &JsFontOptions,
    fontdb: &mut Database,
    font_buffers: Option<js_sys::Array>,
) {
    let mut default_font_family = font_options.default_font_family.clone().trim().to_string();

    let fontdb_found_default_font_family = fontdb
        .faces()
        .find_map(|it| {
            it.families
                .iter()
                .find(|f| f.0 == default_font_family)
                .map(|f| f.0.clone())
        })
        .unwrap_or_default();

    // 当 default_font_family 为空或系统无该字体时，尝试把 fontdb
    // 中字体列表的第一个字体设置为默认的字体。
    if default_font_family.is_empty() || fontdb_found_default_font_family.is_empty() {
        // font_buffers 选项不为空时, 从已加载的字体列表中获取第一个字体的 font family。
        if let Some(_font_buffers) = font_buffers {
            default_font_family = get_first_font_family_or_fallback(fontdb);
        }
    }

    fontdb.set_serif_family(&default_font_family);
    fontdb.set_sans_serif_family(&default_font_family);
    fontdb.set_cursive_family(&default_font_family);
    fontdb.set_fantasy_family(&default_font_family);
    fontdb.set_monospace_family(&default_font_family);
}

/// 查询指定 font family 的字体是否存在，如果不存在则使用 fallback_font_family 代替。
#[cfg(not(target_arch = "wasm32"))]
fn find_and_debug_font_path(fontdb: &mut Database, font_family: &str) {
    let query = Query {
        families: &[Family::Name(font_family)],
        ..Query::default()
    };

    let now = std::time::Instant::now();
    // 查询当前使用的字体是否存在
    match fontdb.query(&query) {
        Some(id) => {
            if let Some((src, index)) = fontdb.face_source(id) {
                if let Source::File(path) = &src {
                    debug!(
                        "Font '{}':{} found in {}ms.",
                        path.display(),
                        index,
                        now.elapsed().as_micros() as f64 / 1000.0
                    );
                }
            }
        }
        None => {
            let first_font_family = get_first_font_family_or_fallback(fontdb);

            fontdb.set_serif_family(&first_font_family);
            fontdb.set_sans_serif_family(&first_font_family);
            fontdb.set_cursive_family(&first_font_family);
            fontdb.set_fantasy_family(&first_font_family);
            fontdb.set_monospace_family(&first_font_family);

            warn!(
                "Warning: The default font-family '{font_family}' not found, set to '{first_font_family}'."
            );
        }
    }
}

/// 获取 fontdb 中的第一个字体的 font family。
fn get_first_font_family_or_fallback(fontdb: &mut Database) -> String {
    let mut default_font_family = "Arial".to_string(); // 其他情况都 fallback 到指定的这个字体。

    match fontdb.faces().next() {
        Some(face) => {
            if let Some(base_family) = face
                .families
                .iter()
                .find(|f| f.1 == Language::English_UnitedStates)
                .or_else(|| face.families.get(0))
            {
                default_font_family = base_family.0.clone();
            }
        }
        None => {
            #[cfg(not(target_arch = "wasm32"))]
            debug!("📝 get_first_font_family not found = '{default_font_family}'");
        }
    }

    default_font_family
}
