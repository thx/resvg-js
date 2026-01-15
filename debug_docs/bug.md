# Bug 描述

在持续运行 resvg-js 时，会发现内存持续升高。
可以运行 `node scripts/test-memory2.mjs`，看到打印出的 rss 值持续升高。

## 相关文档

- Node-API: napi_adjust_external_memory: @debug_docs/node-api.md
- napi-rs: Custom Finalize: @debug_docs/napi-rs.md

## 参考解决方案

Brooooooklyn/canvas 项目也使用了 napi-rs（本地 git 仓库在 @/Users/yisi/works/canvas/ ），在 canvas 仓库的 commit 8321d11 解决了类似的问题，然后在 canvas 仓库的 Commit e0b76b9 做了进一步改进。你可以查看相关 commit 的改动，从中借鉴思路。

## 现有解决方案

我需要你根据上面的一些文档和参考项目进行分析，帮我分析下面的方案是否可行（以及优缺点），看看还有没有更好的解决方案。

### 方案 A：napi-rs Custom Finalize 方案

请查看当前仓库的 Commit 4137514

### 方案 B

在 @src/lib.rs 的 `impl RenderedImage` 中添加 `free` 方法：
完整代码在：https://github.com/tyutjohn/resvg-js/blob/ddfaccf2115b7a2e45d06a705a12dd82cc022912/src/lib.rs

```rust
#[cfg(not(target_arch = "wasm32"))]
#[napi]
pub fn free(&mut self) {
    self.pix = Pixmap::new(1, 1).expect("Failed to create empty Pixmap");
}
```

```rust
#[cfg(not(target_arch = "wasm32"))]
#[napi]
pub fn free(&mut self) {
    self.tree = usvg::Tree {
        size: usvg::Size::from_wh(1.0, 1.0).unwrap(),
        view_box: usvg::ViewBox {
            rect: usvg::NonZeroRect::from_ltrb(0.0, 0.0, 1.0, 1.0).unwrap(),
            aspect: usvg::AspectRatio::default(),
        },
        root: usvg::Node::new(usvg::NodeKind::Group(usvg::Group::default())),
    };

    self.js_options = JsOptions::default();
}
```
