// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

use std::sync::Arc;

#[cfg(not(target_arch = "wasm32"))]
use napi::bindgen_prelude::{
    AbortSignal, AsyncTask, Buffer, Either, Error as NapiError, Task, Undefined,
};
#[cfg(not(target_arch = "wasm32"))]
use napi_derive::napi;
use options::JsOptions;
use pathfinder_content::outline::{Contour, Outline};
use pathfinder_content::stroke::{LineCap, LineJoin, OutlineStrokeToFill, StrokeStyle};
use pathfinder_geometry::rect::RectF;
use pathfinder_geometry::vector::Vector2F;
use resvg::tiny_skia::{NonZeroRect, PathSegment, Rect, Transform};
use resvg::usvg::TreePostProc;
use resvg::{
    tiny_skia::{Pixmap, Point},
    usvg::{self, ImageKind, Node, TreeParsing},
};
#[cfg(target_arch = "wasm32")]
use wasm_bindgen::{
    prelude::{wasm_bindgen, JsValue},
    JsCast,
};

mod error;
mod fonts;
mod options;

use error::Error;

#[cfg(all(
    not(target_arch = "wasm32"),
    not(debug_assertions),
    not(all(target_os = "windows", target_arch = "aarch64")),
    not(all(target_os = "linux", target_arch = "aarch64", target_env = "musl")),
))]
#[global_allocator]
static ALLOC: mimalloc_rust::GlobalMiMalloc = mimalloc_rust::GlobalMiMalloc;

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "Uint8Array | string")]
    pub type IStringOrBuffer;
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
#[cfg_attr(not(target_arch = "wasm32"), napi)]
#[derive(Debug)]
pub struct BBox {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
#[cfg_attr(not(target_arch = "wasm32"), napi)]
pub struct Resvg {
    tree: usvg::Tree,
    js_options: JsOptions,
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
#[cfg_attr(not(target_arch = "wasm32"), napi)]
pub struct RenderedImage {
    pix: Pixmap,
}

#[cfg_attr(target_arch = "wasm32", wasm_bindgen)]
#[cfg_attr(not(target_arch = "wasm32"), napi)]
impl RenderedImage {
    // Wasm
    #[cfg(not(target_arch = "wasm32"))]
    #[napi]
    /// Write the image data to Buffer
    pub fn as_png(&self) -> Result<Buffer, NapiError> {
        let buffer = self.pix.encode_png().map_err(Error::from)?;
        Ok(buffer.into())
    }

    #[cfg(target_arch = "wasm32")]
    #[wasm_bindgen(getter)]
    /// Get the PNG width
    pub fn width(&self) -> u32 {
        self.pix.width()
    }

    #[cfg(target_arch = "wasm32")]
    #[wasm_bindgen(getter)]
    /// Get the PNG height
    pub fn height(&self) -> u32 {
        self.pix.height()
    }

    // napi-rs
    #[cfg(target_arch = "wasm32")]
    #[wasm_bindgen(js_name = asPng)]
    /// Write the image data to Uint8Array
    pub fn as_png(&self) -> Result<js_sys::Uint8Array, js_sys::Error> {
        let buffer = self.pix.encode_png().map_err(Error::from)?;
        Ok(buffer.as_slice().into())
    }

    /// Get the RGBA pixels of the image
    #[cfg(target_arch = "wasm32")]
    #[wasm_bindgen(getter)]
    pub fn pixels(&self) -> js_sys::Uint8Array {
        self.pix.data().into()
    }

    /// Get the RGBA pixels of the image
    #[cfg(not(target_arch = "wasm32"))]
    #[napi(getter)]
    pub fn pixels(&self) -> Buffer {
        self.pix.data().into()
    }

    #[cfg(not(target_arch = "wasm32"))]
    #[napi(getter)]
    /// Get the PNG width
    pub fn width(&self) -> u32 {
        self.pix.width()
    }

    #[cfg(not(target_arch = "wasm32"))]
    #[napi(getter)]
    /// Get the PNG height
    pub fn height(&self) -> u32 {
        self.pix.height()
    }
}

#[cfg(not(target_arch = "wasm32"))]
#[napi]
impl Resvg {
    #[napi(constructor)]
    pub fn new(svg: Either<String, Buffer>, options: Option<String>) -> Result<Resvg, NapiError> {
        Resvg::new_inner(&svg, options)
    }

    fn new_inner(
        svg: &Either<String, Buffer>,
        options: Option<String>,
    ) -> Result<Resvg, NapiError> {
        let js_options: JsOptions = options
            .and_then(|o| serde_json::from_str(o.as_str()).ok())
            .unwrap_or_default();
        let _ = env_logger::builder()
            .filter_level(js_options.log_level)
            .try_init();

        let (mut opts, fontdb) = js_options.to_usvg_options();
        options::tweak_usvg_options(&mut opts);
        // Parse the SVG string into a tree.
        let mut tree = match svg {
            Either::A(a) => usvg::Tree::from_str(a.as_str(), &opts),
            Either::B(b) => usvg::Tree::from_data(b.as_ref(), &opts),
        }
        .map_err(|e| napi::Error::from_reason(format!("{e}")))?;
        tree.postprocess(Default::default(), &fontdb);
        tree.calculate_abs_transforms();
        tree.calculate_bounding_boxes();

        Ok(Resvg { tree, js_options })
    }

    #[napi]
    /// Renders an SVG in Node.js
    pub fn render(&self) -> Result<RenderedImage, NapiError> {
        Ok(self.render_inner()?)
    }

    #[napi]
    /// Output usvg-simplified SVG string
    pub fn to_string(&self) -> String {
        use usvg::TreeWriting;
        self.tree.to_string(&usvg::XmlOptions::default())
    }

    #[napi(js_name = innerBBox)]
    /// Calculate a maximum bounding box of all visible elements in this SVG.
    ///
    /// Note: path bounding box are approx values.

    // Either<T, Undefined> depends on napi 2.4.3
    // https://github.com/napi-rs/napi-rs/releases/tag/napi@2.4.3
    pub fn inner_bbox(&mut self) -> Either<BBox, Undefined> {
        let rect = self.tree.view_box.rect;
        let rect = points_to_rect(
            Vector2F::new(rect.x(), rect.y()),
            Vector2F::new(rect.right(), rect.bottom()),
        );
        let mut v = None;
        for child in &self.tree.root.children {
            let child_viewbox = match self.node_bbox(&child).and_then(|v| v.intersection(rect)) {
                Some(v) => v,
                None => continue,
            };
            if let Some(v) = v.as_mut() {
                *v = child_viewbox.union_rect(*v);
            } else {
                v = Some(child_viewbox)
            };
        }
        match v {
            Some(v) => Either::A(BBox {
                x: v.min_x().floor() as f64,
                y: v.min_y().floor() as f64,
                width: (v.max_x().ceil() - v.min_x().floor()) as f64,
                height: (v.max_y().ceil() - v.min_y().floor()) as f64,
            }),
            None => Either::B(()),
        }
    }

    #[napi(js_name = getBBox)]
    /// Calculate a maximum bounding box of all visible elements in this SVG.
    /// This will first apply transform.
    /// Similar to `SVGGraphicsElement.getBBox()` DOM API.

    // Either<T, Undefined> depends on napi 2.4.3
    // https://github.com/napi-rs/napi-rs/releases/tag/napi@2.4.3
    pub fn get_bbox(&self) -> Either<BBox, Undefined> {
        match self.calculate_bbox(self.tree.root.clone()) {
            Some(bbox) => Either::A(BBox {
                x: bbox.x,
                y: bbox.y as f64,
                width: bbox.width,
                height: bbox.height,
            }),
            None => Either::B(()),
        }
    }

    #[napi(js_name = cropByBBox)]
    /// Use a given `BBox` to crop the svg. Currently this method simply changes
    /// the viewbox/size of the svg and do not move the elements for simplicity
    pub fn crop_by_bbox(&mut self, bbox: &BBox) {
        if !bbox.width.is_finite() || !bbox.height.is_finite() {
            return;
        }
        let width = bbox.width as f32;
        let height = bbox.height as f32;
        self.tree.view_box.rect =
            usvg::NonZeroRect::from_xywh(bbox.x as f32, bbox.y as f32, width, height).unwrap();
        self.tree.size = usvg::Size::from_wh(width, height).unwrap();
    }

    #[napi]
    pub fn images_to_resolve(&self) -> Result<Vec<String>, NapiError> {
        Ok(self.images_to_resolve_inner()?)
    }

    #[napi]
    pub fn resolve_image(&mut self, _href: String, buffer: Buffer) -> Result<(), NapiError> {
        let buffer = buffer.to_vec();
        Ok(self.resolve_image_inner(buffer)?)
    }

    /// Get the SVG width
    #[napi(getter)]
    pub fn width(&self) -> f32 {
        self.tree.size.width().round()
    }

    /// Get the SVG height
    #[napi(getter)]
    pub fn height(&self) -> f32 {
        self.tree.size.height().round()
    }
}

#[cfg(target_arch = "wasm32")]
#[wasm_bindgen]
impl Resvg {
    #[wasm_bindgen(constructor)]
    pub fn new(
        svg: IStringOrBuffer,
        options: Option<String>,
        custom_font_buffers: Option<js_sys::Array>,
    ) -> Result<Resvg, js_sys::Error> {
        let js_options: JsOptions = options
            .and_then(|o| serde_json::from_str(o.as_str()).ok())
            .unwrap_or_default();

        let (mut opts, mut fontdb) = js_options.to_usvg_options();

        crate::fonts::load_wasm_fonts(&js_options.font, custom_font_buffers, &mut fontdb)?;

        options::tweak_usvg_options(&mut opts);
        let mut tree = if js_sys::Uint8Array::instanceof(&svg) {
            let uintarray = js_sys::Uint8Array::unchecked_from_js_ref(&svg);
            let svg_buffer = uintarray.to_vec();
            usvg::Tree::from_data(&svg_buffer, &opts).map_err(Error::from)
        } else if let Some(s) = svg.as_string() {
            usvg::Tree::from_str(s.as_str(), &opts).map_err(Error::from)
        } else {
            Err(Error::InvalidInput)
        }?;
        tree.postprocess(Default::default(), &fontdb);
        tree.calculate_abs_transforms();
        tree.calculate_bounding_boxes();
        Ok(Resvg { tree, js_options })
    }

    /// Get the SVG width
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> f32 {
        self.tree.size.width().round()
    }

    /// Get the SVG height
    #[wasm_bindgen(getter)]
    pub fn height(&self) -> f32 {
        self.tree.size.height().round()
    }

    /// Renders an SVG in Wasm
    pub fn render(&self) -> Result<RenderedImage, js_sys::Error> {
        Ok(self.render_inner()?)
    }

    /// Output usvg-simplified SVG string
    #[wasm_bindgen(js_name = toString)]
    pub fn to_string(&self) -> String {
        use usvg::TreeWriting;
        self.tree.to_string(&usvg::XmlOptions::default())
    }

    /// Calculate a maximum bounding box of all visible elements in this SVG.
    ///
    /// Note: path bounding box are approx values.
    #[wasm_bindgen(js_name = innerBBox)]
    pub fn inner_bbox(&self) -> Option<BBox> {
        let rect = self.tree.view_box.rect;
        let rect = points_to_rect(
            Vector2F::new(rect.x(), rect.y()),
            Vector2F::new(rect.right(), rect.bottom()),
        );
        let mut v = None;
        for child in &self.tree.root.children {
            let child_viewbox = match self.node_bbox(child).and_then(|v| v.intersection(rect)) {
                Some(v) => v,
                None => continue,
            };
            if let Some(v) = v.as_mut() {
                *v = child_viewbox.union_rect(*v);
            } else {
                v = Some(child_viewbox)
            };
        }
        let v = v?;
        Some(BBox {
            x: v.min_x().floor() as f64,
            y: v.min_y().floor() as f64,
            width: (v.max_x().ceil() - v.min_x().floor()) as f64,
            height: (v.max_y().ceil() - v.min_y().floor()) as f64,
        })
    }

    #[wasm_bindgen(js_name = getBBox)]
    /// Calculate a maximum bounding box of all visible elements in this SVG.
    /// This will first apply transform.
    /// Similar to `SVGGraphicsElement.getBBox()` DOM API.
    pub fn get_bbox(&self) -> Option<BBox> {
        let bbox = self.calculate_bbox(self.tree.root.clone())?;
        Some(BBox {
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height,
        })
    }

    #[wasm_bindgen(js_name = cropByBBox)]
    /// Use a given `BBox` to crop the svg. Currently this method simply changes
    /// the viewbox/size of the svg and do not move the elements for simplicity
    pub fn crop_by_bbox(&mut self, bbox: &BBox) {
        if !bbox.width.is_finite() || !bbox.height.is_finite() {
            return;
        }
        let width = bbox.width as f32;
        let height = bbox.height as f32;
        self.tree.view_box.rect =
            usvg::NonZeroRect::from_xywh(bbox.x as f32, bbox.y as f32, width, height).unwrap();
        self.tree.size = usvg::Size::from_wh(width, height).unwrap();
    }

    #[wasm_bindgen(js_name = imagesToResolve)]
    pub fn images_to_resolve(&self) -> Result<js_sys::Array, js_sys::Error> {
        let images = self.images_to_resolve_inner()?;
        let result = js_sys::Array::from_iter(images.into_iter().map(|s| JsValue::from(s)));
        Ok(result)
    }

    #[wasm_bindgen(js_name = resolveImage)]
    pub fn resolve_image(
        &mut self,
        _href: String,
        buffer: js_sys::Uint8Array,
    ) -> Result<(), js_sys::Error> {
        let buffer = buffer.to_vec();
        Ok(self.resolve_image_inner(buffer)?)
    }
}

impl Resvg {
    fn node_bbox(&self, node: &usvg::Node) -> Option<RectF> {
        let mut transform = Transform::identity();
        let bbox = match node {
            usvg::Node::Path(p) => {
                let no_fill = p.fill.is_none()
                    || p.fill
                        .as_ref()
                        .map(|f| f.opacity.get() == 0.0)
                        .unwrap_or_default();
                let no_stroke = p.stroke.is_none()
                    || p.stroke
                        .as_ref()
                        .map(|f| f.opacity.get() == 0.0)
                        .unwrap_or_default();
                if no_fill && no_stroke {
                    return None;
                }
                let mut outline = Outline::new();
                let mut contour = Contour::new();
                let mut iter = p.data.segments().peekable();
                while let Some(seg) = iter.next() {
                    match seg {
                        PathSegment::MoveTo(p) => {
                            if !contour.is_empty() {
                                outline
                                    .push_contour(std::mem::replace(&mut contour, Contour::new()));
                            }
                            contour.push_endpoint(Vector2F::new(p.x, p.y))
                        }
                        PathSegment::LineTo(p) => {
                            let v = Vector2F::new(p.x, p.y);
                            if let Some(PathSegment::Close) = iter.peek() {
                                let first = contour.position_of(0);
                                if (first - v).square_length() < 1.0 {
                                    continue;
                                }
                            }
                            contour.push_endpoint(v);
                        }
                        PathSegment::CubicTo(p1, p2, p) => {
                            contour.push_cubic(
                                Vector2F::new(p1.x, p1.y),
                                Vector2F::new(p2.x, p2.y),
                                Vector2F::new(p.x, p.y),
                            );
                        }
                        PathSegment::QuadTo(p1, p) => {
                            contour
                                .push_quadratic(Vector2F::new(p1.x, p1.y), Vector2F::new(p.x, p.y));
                        }
                        PathSegment::Close => {
                            contour.close();
                            outline.push_contour(std::mem::replace(&mut contour, Contour::new()));
                        }
                    }
                }
                if !contour.is_empty() {
                    outline.push_contour(std::mem::replace(&mut contour, Contour::new()));
                }
                if let Some(stroke) = p.stroke.as_ref() {
                    if !no_stroke {
                        let mut style = StrokeStyle::default();
                        style.line_width = stroke.width.get() as f32;
                        style.line_join = LineJoin::Miter(style.line_width);
                        style.line_cap = match stroke.linecap {
                            usvg::LineCap::Butt => LineCap::Butt,
                            usvg::LineCap::Round => LineCap::Round,
                            usvg::LineCap::Square => LineCap::Square,
                        };
                        let mut filler = OutlineStrokeToFill::new(&outline, style);
                        filler.offset();
                        outline = filler.into_outline();
                    }
                }
                Some(outline.bounds())
            }
            usvg::Node::Group(g) => {
                transform = g.transform;
                let clippath = if let Some(ref clippath) = g
                    .clip_path
                    .as_ref()
                    .and_then(|n| n.borrow().root.children.first().cloned())
                {
                    self.node_bbox(clippath)
                } else if let Some(ref mask) = g
                    .mask
                    .as_ref()
                    .and_then(|n| n.borrow().root.children.first().cloned())
                {
                    self.node_bbox(mask)
                } else {
                    Some(self.viewbox())
                }?;
                let mut v = None;
                for child in &g.children {
                    let child_viewbox =
                        match self.node_bbox(child).and_then(|v| v.intersection(clippath)) {
                            Some(v) => v,
                            None => continue,
                        };
                    if let Some(v) = v.as_mut() {
                        *v = child_viewbox.union_rect(*v);
                    } else {
                        v = Some(child_viewbox)
                    };
                }
                v.and_then(|v| v.intersection(self.viewbox()))
            }
            usvg::Node::Image(image) => {
                let rect = image.view_box.rect;
                Some(points_to_rect(
                    Vector2F::new(rect.x(), rect.y()),
                    Vector2F::new(rect.right(), rect.bottom()),
                ))
            }
            usvg::Node::Text(_) => None,
        }?;
        let mut pts = vec![
            Point::from_xy(bbox.min_x(), bbox.min_y()),
            Point::from_xy(bbox.max_x(), bbox.max_y()),
            Point::from_xy(bbox.min_x(), bbox.max_y()),
            Point::from_xy(bbox.max_x(), bbox.min_y()),
        ];
        transform.map_points(&mut pts);
        let x_min = pts[0].x.min(pts[1].x).min(pts[2].x).min(pts[3].x);
        let x_max = pts[0].x.max(pts[1].x).max(pts[2].x).max(pts[3].x);
        let y_min = pts[0].y.min(pts[1].y).min(pts[2].y).min(pts[3].y);
        let y_max = pts[0].y.max(pts[1].y).max(pts[2].y).max(pts[3].y);
        let r = points_to_rect(Vector2F::new(x_min, y_min), Vector2F::new(x_max, y_max));
        Some(r)
    }

    // https://github.com/RazrFalcon/resvg/blob/1dfe9e506c2f90b55e662b1803d27f0b4e4ace77/crates/usvg-tree/src/lib.rs#L1289-L1291
    #[inline]
    fn calculate_bbox(&self, group: usvg::Group) -> Option<BBox> {
        let node = Node::Group(Box::new(group));
        let transform = node.abs_transform();
        self.calc_node_bbox(&node, transform)
    }

    /// https://github.com/RazrFalcon/resvg/blob/v0.37.0/crates/usvg-tree/src/lib.rs#L1298-L1335
    fn calc_node_bbox(&self, node: &Node, ts: Transform) -> Option<BBox> {
        match node {
            Node::Path(ref path) => bbox_with_transform(&path.data, ts, path.stroke.as_ref()),
            Node::Image(ref img) => img.view_box.rect.transform(ts).map(bbox_from_nonzrect),
            Node::Group(g) => {
                // https://github.com/RazrFalcon/resvg/blob/v0.37.0/crates/usvg-tree/src/geom.rs#L89-L98
                // Self {
                //   left: f32::MAX,
                //   top: f32::MAX,
                //   right: f32::MIN,
                //   bottom: f32::MIN,
                // }
                let mut bbox = BBox {
                    x: f64::MAX,
                    y: f64::MAX,
                    width: f64::MIN,
                    height: f64::MIN,
                };

                for child in &g.children {
                    let child_transform = if let Node::Group(ref group) = child {
                        ts.pre_concat(group.transform)
                    } else {
                        ts
                    };
                    if let Some(c_bbox) = self.calc_node_bbox(&child, child_transform) {
                        bbox = bbox_expanded(&bbox, &c_bbox);
                    }
                }

                // Make sure bbox was changed.
                if bbox_is_default(&bbox) {
                    return None;
                }

                Some(bbox)
            }
            Node::Text(ref text) => {
                if let Some(bbox) = text.bounding_box {
                    bbox.transform(ts).map(bbox_from_nonzrect)
                } else {
                    None
                }
            }
        }
    }

    fn viewbox(&self) -> RectF {
        RectF::new(
            Vector2F::new(0.0, 0.0),
            Vector2F::new(self.width() as f32, self.height() as f32),
        )
    }

    fn render_inner(&self) -> Result<RenderedImage, Error> {
        let (width, height, transform) = self.js_options.fit_to.fit_to(self.tree.size)?;
        let mut pixmap = self.js_options.create_pixmap(width, height)?;
        // Render the tree
        let _image = resvg::render(&self.tree, transform, &mut pixmap.as_mut());

        // Crop the SVG
        let crop_rect = resvg::tiny_skia::IntRect::from_ltrb(
            self.js_options.crop.left,
            self.js_options.crop.top,
            self.js_options.crop.right.unwrap_or(width as i32),
            self.js_options.crop.bottom.unwrap_or(height as i32),
        );

        if let Some(crop_rect) = crop_rect {
            pixmap = pixmap.clone_rect(crop_rect).unwrap_or(pixmap);
        }

        Ok(RenderedImage { pix: pixmap })
    }

    fn images_to_resolve_inner(&self) -> Result<Vec<String>, Error> {
        let mut data = vec![];
        let mut err: Option<Error> = None;
        for node in &self.tree.root.children {
            if err.is_some() {
                break;
            }
            let err = &mut err;
            let data = &mut data;
            traverse_tree(node, &mut |node| {
                if let Node::Image(img) = node {
                    if err.is_some() {
                        return;
                    }

                    match &img.kind {
                        ImageKind::HOLE(url) => {
                            if is_not_data_url(&url) {
                                data.push(url.clone());
                            }
                        }
                        _ => {}
                    }
                }
            });
        }
        Ok(data)
    }

    fn resolve_image_inner(&mut self, buffer: Vec<u8>) -> Result<(), Error> {
        let resolver = usvg::ImageHrefResolver::default_data_resolver();
        let (options, _) = self.js_options.to_usvg_options();
        let mime = MimeType::parse(&buffer)?.mime_type().to_string();

        for node in &mut self.tree.root.children {
            traverse_tree_mut(node, &|node| {
                if let Node::Image(ref mut i) = node {
                    let need_fallback = match &i.kind {
                        ImageKind::HOLE(_) => true,
                        _ => false,
                    };

                    if need_fallback {
                        let data = (resolver)(&mime, Arc::new(buffer.clone()), &options);
                        if let Some(ref kind) = data {
                            i.as_mut().kind = kind.clone();
                        }
                    }
                }
            });
        }

        Ok(())
    }
}

// https://github.com/RazrFalcon/resvg/blob/1dfe9e506c2f90b55e662b1803d27f0b4e4ace77/crates/usvg-tree/src/geom.rs#L78-L87
fn bbox_from_nonzrect(rect: NonZeroRect) -> BBox {
    BBox {
        x: rect.x() as f64,
        y: rect.y() as f64,
        width: rect.width() as f64,
        height: rect.height() as f64,
    }
}

// https://github.com/RazrFalcon/resvg/blob/1dfe9e506c2f90b55e662b1803d27f0b4e4ace77/crates/usvg-tree/src/geom.rs#L102-L107
fn bbox_is_default(bbox: &BBox) -> bool {
    bbox.x == f64::MAX && bbox.y == f64::MAX && bbox.width == f64::MIN && bbox.height == f64::MIN
}

// https://github.com/RazrFalcon/resvg/blob/1dfe9e506c2f90b55e662b1803d27f0b4e4ace77/crates/usvg-tree/src/geom.rs#L111-L122
fn bbox_expanded(this_bbox: &BBox, other: &BBox) -> BBox {
    // left: self.left.min(r.left),
    // top: self.top.min(r.top),
    // right: self.right.max(r.right),
    // bottom: self.bottom.max(r.bottom),
    BBox {
        x: this_bbox.x.min(other.x),
        y: this_bbox.y.min(other.y),
        width: this_bbox.width.max(other.width),
        height: this_bbox.height.max(other.height),
    }
}

// https://github.com/zimond/resvg/commit/3495d8705b302d6d266748516973606ca9657906
fn bbox_with_transform(
    path: &usvg::tiny_skia_path::Path,
    ts: Transform,
    stroke: Option<&usvg::Stroke>,
) -> Option<BBox> {
    use kurbo::{CubicBez, Point};

    if path.segments().count() == 0 {
        return None;
    }

    let mut prev_x = 0.0;
    let mut prev_y = 0.0;
    let mut minx = 0.0;
    let mut miny = 0.0;
    let mut maxx = 0.0;
    let mut maxy = 0.0;

    if let Some(PathSegment::MoveTo(p)) =
        path.clone().transform(ts).and_then(|p| p.segments().next())
    {
        prev_x = p.x;
        prev_y = p.y;
        minx = p.x;
        miny = p.y;
        maxx = p.x;
        maxy = p.y;
    }

    for seg in path
        .clone()
        .transform(ts)
        .as_ref()
        .map(|p| p.segments())
        .into_iter()
        .flatten()
    {
        match seg {
            PathSegment::MoveTo(p) | PathSegment::LineTo(p) => {
                let x = p.x;
                let y = p.y;
                prev_x = x;
                prev_y = y;

                if x > maxx {
                    maxx = x;
                } else if x < minx {
                    minx = x;
                }

                if y > maxy {
                    maxy = y;
                } else if y < miny {
                    miny = y;
                }
            }
            PathSegment::CubicTo(p1, p2, p) => {
                let curve = CubicBez::new(
                    Point::new(prev_x as f64, prev_y as f64),
                    Point::new(p1.x as f64, p1.y as f64),
                    Point::new(p2.x as f64, p2.y as f64),
                    Point::new(p.x as f64, p.y as f64),
                );
                let r = kurbo::ParamCurveExtrema::bounding_box(&curve);

                if (r.x0 as f32) < minx {
                    minx = r.x0 as f32;
                }
                if (r.x1 as f32) > maxx {
                    maxx = r.x1 as f32;
                }
                if (r.y0 as f32) < miny {
                    miny = r.y0 as f32;
                }
                if (r.y1 as f32) > maxy {
                    maxy = r.y1 as f32;
                }

                prev_x = p.x;
                prev_y = p.y;
            }
            PathSegment::QuadTo(p1, p) => {
                let curve = CubicBez::new(
                    Point::new(prev_x as f64, prev_y as f64),
                    Point::new(p1.x as f64, p1.y as f64),
                    Point::new(p1.x as f64, p1.y as f64),
                    Point::new(p.x as f64, p.y as f64),
                );
                let r = kurbo::ParamCurveExtrema::bounding_box(&curve);

                if (r.x0 as f32) < minx {
                    minx = r.x0 as f32;
                }
                if (r.x1 as f32) > maxx {
                    maxx = r.x1 as f32;
                }
                if (r.y0 as f32) < miny {
                    miny = r.y0 as f32;
                }
                if (r.y1 as f32) > maxy {
                    maxy = r.y1 as f32;
                }

                prev_x = p.x;
                prev_y = p.y;
            }
            _ => {}
        }
    }

    // TODO: find a better way
    // It's an approximation, but it's better than nothing.
    if let Some(stroke) = stroke {
        let w = stroke.width.get()
            / if ts.is_identity() {
                2.0
            } else {
                2.0 / (ts.sx * ts.sy - ts.kx * ts.ky).abs().sqrt()
            };
        minx -= w;
        miny -= w;
        maxx += w;
        maxy += w;
    }

    let width = maxx - minx;
    let height = maxy - miny;

    // Some(BBox::from(Rect::from_xywh(minx, miny, width, height)?))
    Some(BBox {
        x: minx as f64,
        y: miny as f64,
        width: width as f64,
        height: height as f64,
    })
}

fn is_not_data_url(data: &str) -> bool {
    return !data.starts_with("data:");
}

fn traverse_tree_mut<F>(node: &mut usvg::Node, f: &F)
where
    F: Fn(&mut usvg::Node),
{
    f(node);
    if let usvg::Node::Group(g) = node {
        for child in &mut g.children {
            traverse_tree_mut(child, f);
        }
    }
}

fn traverse_tree<F>(node: &usvg::Node, f: &mut F)
where
    F: FnMut(&usvg::Node),
{
    f(node);
    if let usvg::Node::Group(g) = node {
        for child in &g.children {
            traverse_tree(child, f);
        }
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub struct AsyncRenderer {
    options: Option<String>,
    svg: Either<String, Buffer>,
}

#[cfg(not(target_arch = "wasm32"))]
#[napi]
impl Task for AsyncRenderer {
    type Output = RenderedImage;
    type JsValue = RenderedImage;

    fn compute(&mut self) -> Result<Self::Output, NapiError> {
        let resvg = Resvg::new_inner(&self.svg, self.options.clone())?;
        resvg.render()
    }

    fn resolve(
        &mut self,
        _env: napi::Env,
        result: Self::Output,
    ) -> Result<Self::JsValue, NapiError> {
        Ok(result)
    }
}

#[cfg(not(target_arch = "wasm32"))]
#[napi]
pub fn render_async(
    svg: Either<String, Buffer>,
    options: Option<String>,
    signal: Option<AbortSignal>,
) -> AsyncTask<AsyncRenderer> {
    match signal {
        Some(s) => AsyncTask::with_signal(AsyncRenderer { options, svg }, s),
        None => AsyncTask::new(AsyncRenderer { options, svg }),
    }
}

fn points_to_rect(min: Vector2F, max: Vector2F) -> RectF {
    RectF::new(min, max - min)
}

// Detects the file type by magic number.
// Currently resvg only supports the following types of files.
pub enum MimeType {
    Png,
    Jpeg,
    Gif,
}

impl MimeType {
    pub fn parse(buffer: &[u8]) -> Result<Self, Error> {
        if buffer.len() < 4 {
            return Err(Error::UnsupportedImage);
        }
        Ok(match &buffer[0..4] {
            [0x89, 0x50, 0x4E, 0x47] => MimeType::Png,
            [0xFF, 0xD8, 0xFF, _] => MimeType::Jpeg,
            [0x47, 0x49, 0x46, _] => MimeType::Gif,
            _ => return Err(Error::UnsupportedImage),
        })
    }

    pub fn mime_type(&self) -> &'static str {
        match self {
            MimeType::Png => "image/png",
            MimeType::Gif => "image/gif",
            _ => "image/jpeg",
        }
    }
}
