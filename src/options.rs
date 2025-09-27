// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

use std::sync::Arc;

use crate::error::Error;
#[cfg(not(target_arch = "wasm32"))]
use napi::{bindgen_prelude::Buffer, Either};
use resvg::tiny_skia::{Pixmap, Transform};
use resvg::usvg::fontdb::Database;
use resvg::usvg::{self, ImageHrefResolver, ImageKind, Options, TreeParsing};
use serde::{Deserialize, Deserializer};

/// Options for resolving image URLs.
#[derive(Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct ImageResolvingOptions {
    /// Whether to enable relative path resolution.
    pub enable_relative_paths: bool,
    /// The base URL to resolve relative paths against.
    pub base_url: Option<String>,
}

/// Image fit options.
/// This provides the deserializer for `usvg::FitTo`.
#[derive(Deserialize)]
#[serde(
    tag = "mode",
    content = "value",
    rename_all = "lowercase",
    deny_unknown_fields
)]
pub enum FitToDef {
    /// Keep original size.
    Original,
    /// Scale to width.
    Width(u32),
    /// Scale to height.
    Height(u32),
    /// Zoom by factor.
    Zoom(f32),
}

impl FitToDef {
    pub(crate) fn fit_to(&self, size: usvg::Size) -> Result<(u32, u32, Transform), Error> {
        let mut transform = Transform::identity();
        let width = size.width();
        let height = size.height();
        let scale = match self {
            FitToDef::Original => 1.0,
            FitToDef::Width(w) => *w as f32 / width,
            FitToDef::Height(h) => *h as f32 / height,
            FitToDef::Zoom(s) => *s,
        };
        let width = (width * scale).round().max(0.0) as u32;
        let height = (height * scale).round().max(0.0) as u32;
        transform = transform.pre_scale(
            width as f32 / size.width() as f32,
            height as f32 / size.height() as f32,
        );
        if width == 0 || height == 0 {
            Err(Error::ZeroSized)
        } else {
            Ok((width, height, transform))
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase", remote = "log::LevelFilter")]
enum LogLevelDef {
    Off,
    Error,
    Warn,
    Info,
    Debug,
    Trace,
}

pub(crate) trait ResvgReadable {
    fn load(&self, options: &usvg::Options) -> Result<usvg::Tree, usvg::Error>;
}

impl<'a> ResvgReadable for &'a str {
    fn load(&self, options: &usvg::Options) -> Result<usvg::Tree, usvg::Error> {
        usvg::Tree::from_str(self, options)
    }
}

impl<'a> ResvgReadable for &'a [u8] {
    fn load(&self, options: &usvg::Options) -> Result<usvg::Tree, usvg::Error> {
        usvg::Tree::from_data(self, options)
    }
}

#[cfg(not(target_arch = "wasm32"))]
impl<'a> ResvgReadable for &'a Either<String, Buffer> {
    fn load(&self, options: &usvg::Options) -> Result<usvg::Tree, usvg::Error> {
        match self {
            Either::A(s) => s.as_str().load(options),
            Either::B(b) => b.as_ref().load(options),
        }
    }
}

/// The javascript options passed to `render()`.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", default, deny_unknown_fields)]
pub struct JsOptions {
    /// Font related options.
    pub font: JsFontOptions,

    /// Target DPI.
    ///
    /// Impact units conversion.
    ///
    /// Note: This is not the DPI in the PNG file. Resvg does not change the DPI
    ///  of the PNG file.
    /// https://github.com/RazrFalcon/resvg/issues/451#issuecomment-914462093
    /// https://github.com/RazrFalcon/resvg/issues/526#issuecomment-1190433890
    ///
    /// Default: 96.0
    pub dpi: f32,

    /// A list of languages.
    ///
    /// Will be used to resolve a `systemLanguage` conditional attribute.
    ///
    /// Format: en, en-US.
    ///
    /// Default: [en]
    pub languages: Vec<String>,

    /// The default shape rendering method.
    ///
    /// Will be used when an SVG element's `shape-rendering` property is set to `auto`.
    ///
    /// Default: GeometricPrecision
    #[serde(deserialize_with = "deserialize_shape_rendering")]
    pub shape_rendering: usvg::ShapeRendering,

    /// The default text rendering method.
    ///
    /// Will be used when an SVG element's `text-rendering` property is set to `auto`.
    ///
    /// Default: OptimizeLegibility
    #[serde(deserialize_with = "deserialize_text_rendering")]
    pub text_rendering: usvg::TextRendering,

    /// The default image rendering method.
    ///
    /// Will be used when an SVG element's `image-rendering` property is set to `auto`.
    ///
    /// Default: OptimizeQuality
    #[serde(deserialize_with = "deserialize_image_rendering")]
    pub image_rendering: usvg::ImageRendering,

    /// The size to render the SVG.
    ///
    /// Default: Original
    pub fit_to: FitToDef,

    /// The background color of the SVG.
    ///
    /// Default: `None`
    pub background: Option<String>,

    /// Crop options
    pub crop: JsCropOptions,

    #[serde(with = "LogLevelDef")]
    pub log_level: log::LevelFilter,

    /// Options for resolving image URLs.
    /// Default: None (preserves current behavior)
    pub image_resolving: Option<ImageResolvingOptions>,
}

impl Default for JsOptions {
    fn default() -> JsOptions {
        JsOptions {
            font: JsFontOptions::default(),
            dpi: 96.0,
            languages: vec!["en".to_string()],
            shape_rendering: usvg::ShapeRendering::default(),
            text_rendering: usvg::TextRendering::default(),
            image_rendering: usvg::ImageRendering::default(),
            fit_to: FitToDef::Original,
            background: None,
            crop: JsCropOptions::default(),
            log_level: log::LevelFilter::Error,
            image_resolving: None,
        }
    }
}

impl JsOptions {
    pub(crate) fn to_usvg_options(&self) -> (usvg::Options, Database) {
        // Load fonts
        #[cfg(not(target_arch = "wasm32"))]
        let fontdb = crate::fonts::load_fonts(&self.font);
        #[cfg(target_arch = "wasm32")]
        let fontdb = Database::new();

        // Build the SVG options
        let opts = usvg::Options {
            resources_dir: None,
            dpi: self.dpi,
            font_family: self.font.default_font_family.clone(),
            font_size: self.font.default_font_size,
            languages: self.languages.clone(),
            shape_rendering: self.shape_rendering,
            text_rendering: self.text_rendering,
            image_rendering: self.image_rendering,
            default_size: usvg::Size::from_wh(100.0, 100.0).unwrap(),
            image_href_resolver: usvg::ImageHrefResolver::default(),
        };
        (opts, fontdb)
    }

    pub(crate) fn create_pixmap(&self, width: u32, height: u32) -> Result<Pixmap, Error> {
        // Parse the background
        let background = self
            .background
            .as_ref()
            .map(|color| color.parse::<svgtypes::Color>())
            .transpose()?;

        // Unwrap is safe, because `size` is already valid.
        let mut pixmap = Pixmap::new(width, height).unwrap();

        if let Some(bg) = background {
            let color = resvg::tiny_skia::Color::from_rgba8(bg.red, bg.green, bg.blue, bg.alpha);
            pixmap.fill(color);
        }
        Ok(pixmap)
    }
}

/// The font options passed to `load_fonts()`.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", default, deny_unknown_fields)]
pub struct JsFontOptions {
    /// If system fonts should be loaded.
    ///
    /// Default: true
    pub load_system_fonts: bool,

    /// A list of local font file paths to load.
    pub font_files: Vec<String>,

    /// A list of local font directories to load.
    pub font_dirs: Vec<String>,

    /// The default font family.
    ///
    /// Will be used when no `font-family` attribute is set in the SVG.
    ///
    /// Default: ""
    pub default_font_family: String,

    /// The default font size.
    ///
    /// Will be used when no `font-size` attribute is set in the SVG.
    ///
    /// Default: 12
    pub default_font_size: f32,

    /// The 'serif' font family.
    ///
    /// Default: Times New Roman
    pub serif_family: String,

    /// The 'sans-serif' font family.
    ///
    /// Default: Arial
    pub sans_serif_family: String,

    /// The 'cursive' font family.
    ///
    /// Default: Comic Sans MS
    pub cursive_family: String,

    /// The 'fantasy' font family.
    ///
    /// Default: Impact
    pub fantasy_family: String,

    /// The 'monospace' font family.
    ///
    /// Default: Courier New
    pub monospace_family: String,
}

impl Default for JsFontOptions {
    fn default() -> JsFontOptions {
        JsFontOptions {
            load_system_fonts: true,
            font_files: vec![],
            font_dirs: vec![],
            default_font_family: "".to_string(),
            default_font_size: 12.0,
            serif_family: "Times New Roman".to_string(),
            sans_serif_family: "Arial".to_string(),
            cursive_family: "Comic Sans MS".to_string(),
            fantasy_family: "Impact".to_string(),
            monospace_family: "Courier New".to_string(),
        }
    }
}

/// The font options passed to `load_fonts()`.
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default, deny_unknown_fields)]
pub struct JsCropOptions {
    /// The rectangle's left x-axis coordinate.
    ///
    /// Default: 0
    pub left: i32,

    /// The rectangle's top y-axis coordinate.
    ///
    /// Default: 0
    pub top: i32,

    /// The rectangle's right x-axis coordinate. `None` targets the svg width.
    ///
    /// Default: None
    pub right: Option<i32>,

    /// The rectangle's bottom y-axis coordinate. `None` targets the svg height.
    ///
    /// Default: None
    pub bottom: Option<i32>,
}

/// Deserializes `usvg::ShapeRendering`
fn deserialize_shape_rendering<'de, D>(deserializer: D) -> Result<usvg::ShapeRendering, D::Error>
where
    D: Deserializer<'de>,
{
    match u64::deserialize(deserializer)? {
        0 => Ok(usvg::ShapeRendering::OptimizeSpeed),
        1 => Ok(usvg::ShapeRendering::CrispEdges),
        2 => Ok(usvg::ShapeRendering::GeometricPrecision),
        n => Err(serde::de::Error::custom(format_args!(
            "Invalid ShapeRendering value: {n}. Must be these numbers: 0 (OptimizeSpeed), 1 (CrispEdges), or 2 (GeometricPrecision)."
        ))),
    }
}

/// Deserializes `usvg::TextRendering`
fn deserialize_text_rendering<'de, D>(deserializer: D) -> Result<usvg::TextRendering, D::Error>
where
    D: Deserializer<'de>,
{
    match u64::deserialize(deserializer)? {
        0 => Ok(usvg::TextRendering::OptimizeSpeed),
        1 => Ok(usvg::TextRendering::OptimizeLegibility),
        2 => Ok(usvg::TextRendering::GeometricPrecision),
        n => Err(serde::de::Error::custom(format_args!(
            "Invalid TextRendering value: {n}. Must be these numbers: 0 (OptimizeSpeed), 1 (OptimizeLegibility), or 2 (GeometricPrecision)."
        ))),
    }
}

/// Deserializes `usvg::ImageRendering`
fn deserialize_image_rendering<'de, D>(deserializer: D) -> Result<usvg::ImageRendering, D::Error>
where
    D: Deserializer<'de>,
{
    match u64::deserialize(deserializer)? {
    0 => Ok(usvg::ImageRendering::OptimizeQuality),
    1 => Ok(usvg::ImageRendering::OptimizeSpeed),
    n => Err(serde::de::Error::custom(format_args!(
      "Invalid ImageRendering value: {n}. Must be these numbers: 0 (OptimizeQuality) or 1 (OptimizeSpeed)."
    ))),
  }
}

/// Validates that a URL is safe for relative resolution.
/// Blocks path traversal attempts and other security risks.
fn is_safe_relative_url(url: &str) -> bool {
    // Block path traversal patterns
    !url.contains("..") &&
    !url.contains("//") &&
    !url.starts_with("/") &&
    !url.contains("\\") &&
    // Block URL-encoded path traversal
    !url.contains("%2e%2e") &&
    !url.contains("%2E%2E") &&
    // Block URL-encoded backslashes
    !url.contains("%5c") &&
    !url.contains("%5C")
}

/// Resolves a relative URL against a base URL safely.
fn resolve_relative_url(relative: &str, base: &str) -> Option<String> {
    use url::Url;

    // Parse the base URL
    let base_url = Url::parse(base).ok()?;

    // Resolve the relative URL
    let resolved = base_url.join(relative).ok()?;

    // Ensure the resolved URL is still under the same origin
    if resolved.scheme() != base_url.scheme() || resolved.host() != base_url.host() {
        return None;
    }

    Some(resolved.to_string())
}

/// Resolves an image URL based on the provided options.
fn resolve_image_url(url: &str, image_resolving: &Option<ImageResolvingOptions>) -> Option<String> {
    // Always allow absolute URLs (current behavior)
    if url.starts_with("https://") || url.starts_with("http://") {
        return Some(url.to_string());
    }

    // Check if image resolving is enabled
    let image_opts = image_resolving.as_ref()?;

    if !image_opts.enable_relative_paths {
        return None;
    }

    // Validate and resolve relative paths
    let base_url = image_opts.base_url.as_ref()?;

    // Security checks
    if !is_safe_relative_url(url) {
        return None;
    }

    // Use the url crate for safe URL resolution
    resolve_relative_url(url, base_url)
}

pub(crate) fn tweak_usvg_options(opts: &mut usvg::Options, js_options: &JsOptions) {
    opts.image_href_resolver = ImageHrefResolver::default();
    let image_resolving = js_options.image_resolving.clone();

    opts.image_href_resolver.resolve_string = Arc::new(move |data: &str, opts: &Options| {
        if let Some(resolved) = resolve_image_url(data, &image_resolving) {
            Some(ImageKind::RAW(1, 1, Arc::new(resolved.as_bytes().to_vec())))
        } else {
            // Fallback to default resolver for data URIs, etc.
            let resolver = ImageHrefResolver::default().resolve_string;
            (resolver)(data, opts)
        }
    });
}
