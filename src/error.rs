// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

use thiserror::Error;

#[derive(Error, Debug)]
pub enum Error {
    #[error(transparent)]
    Svg(#[from] svgtypes::Error),
    #[error(transparent)]
    USvg(#[from] resvg::usvg::Error),
    #[error(transparent)]
    Encoding(#[from] png::EncodingError),
    #[error(transparent)]
    Utf8(#[from] std::string::FromUtf8Error),
    #[error("Target size is zero (please do not set the width/height/zoom options to 0)")]
    ZeroSized,
    #[error("Input must be string or Uint8Array")]
    InvalidInput,
    #[error("Unsupported image types (currently resvg only supports PNG, JPEG and GIF)")]
    UnsupportedImage,
}

#[cfg(not(target_arch = "wasm32"))]
impl From<Error> for napi::Error {
    fn from(e: Error) -> Self {
        napi::Error::from_reason(format!("{e}"))
    }
}

#[cfg(target_arch = "wasm32")]
impl From<Error> for js_sys::Error {
    fn from(e: Error) -> Self {
        js_sys::Error::new(&format!("{}", e))
    }
}
