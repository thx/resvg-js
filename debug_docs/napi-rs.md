- Introduction
  - [Getting started](https://napi.rs/docs/introduction/getting-started)
  - [A simple package](https://napi.rs/docs/introduction/simple-package)

- Concepts
  - [Exports](https://napi.rs/docs/concepts/exports)
  - [Module Initialization](https://napi.rs/docs/concepts/module-init)
  - [Naming conventions](https://napi.rs/docs/concepts/naming-conventions)
  - [Values](https://napi.rs/docs/concepts/values)
  - [Class](https://napi.rs/docs/concepts/class)
  - [Enum](https://napi.rs/docs/concepts/enum)
  - [Object](https://napi.rs/docs/concepts/object)
  - [Function](https://napi.rs/docs/concepts/function)
  - [ThreadsafeFunction](https://napi.rs/docs/concepts/threadsafe-function)
  - [AsyncTask](https://napi.rs/docs/concepts/async-task)
  - [Inject Env](https://napi.rs/docs/concepts/inject-env)
  - [Inject This](https://napi.rs/docs/concepts/inject-this)
  - [Reference](https://napi.rs/docs/concepts/reference)
  - [async fn](https://napi.rs/docs/concepts/async-fn)
  - [External](https://napi.rs/docs/concepts/external)
  - [Promise](https://napi.rs/docs/concepts/promise)
  - [Types Overwrite](https://napi.rs/docs/concepts/types-overwrite)
  - [Typed Array](https://napi.rs/docs/concepts/typed-array)
  - [Understanding Lifetime](https://napi.rs/docs/concepts/understanding-lifetime)
  - [Env](https://napi.rs/docs/concepts/env)
  - [WebAssembly](https://napi.rs/docs/concepts/webassembly)

- CLI
  - [Programmatic API](https://napi.rs/docs/cli/programmatic-api)
  - [Build](https://napi.rs/docs/cli/build)
  - [Artifacts](https://napi.rs/docs/cli/artifacts)
  - [Prepublish](https://napi.rs/docs/cli/pre-publish)
  - [NAPI Config](https://napi.rs/docs/cli/napi-config)
  - [Create Npm Dirs](https://napi.rs/docs/cli/create-npm-dirs)
  - [New](https://napi.rs/docs/cli/new)
  - [Rename](https://napi.rs/docs/cli/rename)
  - [Universalize](https://napi.rs/docs/cli/universalize)
  - [Version](https://napi.rs/docs/cli/version)

- Deep dive
  - [Native module](https://napi.rs/docs/deep-dive/native-module)
  - [History](https://napi.rs/docs/deep-dive/history)
  - [Release native packages](https://napi.rs/docs/deep-dive/release)

- [Cross build](https://napi.rs/docs/cross-build)
- More
  - [Frequently Asked Questions](https://napi.rs/docs/more/faq)
  - [V2 to V3 Migration Guide](https://napi.rs/docs/more/v2-v3-migration-guide)

Docs begin:

# Inject Env

The `#[napi]` macro is a very high level abstraction for the `Node-API`. Most of the time, you use the Rust native API and crates.

But sometimes you still need to access the low-level `Node-API`, for example, to call [`napi_async_cleanup_hook`](https://nodejs.org/api/n-api.html#napi_async_cleanup_hook) or [`napi_adjust_external_memory`](https://nodejs.org/api/n-api.html#napi_adjust_external_memory).

For this scenario, **NAPI-RS** allows you to inject `Env` into your `fn` which is decorated by the `#[napi]`.

lib.rs

```
use napi::{Env, bindgen_prelude::*};

#[napi]
pub fn call_env(env: Env, length: u32) -> Result<External<Vec<u32>>> {
  env.adjust_external_memory(length as i64)?;
  Ok(External::new(vec![0; length as usize]))
}
```

And the `Env` will be auto injected by **NAPI-RS**, it does not affect the `arguments` types in the JavaScript side:

index.d.ts

```
export function callEnv(length: number) -> ExternalObject<number[]>
```

You can also inject `Env` in `impl` block:

lib.rs

```
use napi::bindgen_prelude::*;

// A complex struct which can not be exposed into JavaScript directly.
struct QueryEngine {}

#[napi(js_name = "QueryEngine")]
pub struct JsQueryEngine {
  engine: QueryEngine,
}

#[napi]
impl JsQueryEngine {
  #[napi(factory)]
  pub fn with_initial_count(count: u32) -> Self {
    JsQueryEngine { engine: QueryEngine::with_initial_count(count) }
  }

  /// Class method
  #[napi]
  pub fn query(&self, env: Env, query: String) -> napi::Result<String> {
    self.engine.query(query).map_err(|err| Error::new(Status::GenericFailure, format!("Query failed {}", err)))
  }
}
```

The behavior is just the same with the pure `fn`.

Last updated on July 17, 2025

------

# Class

There is no concept of a class in Rust. We use `struct` to represent a
JavaScript `Class`.

## `Constructor` [Permalink for this section](https://napi.rs/docs/concepts/class\#constructor)

### Default `constructor` [Permalink for this section](https://napi.rs/docs/concepts/class\#default-constructor)

If all fields in a `Rust` struct are `pub`, then you can use `#[napi(constructor)]` to make the `struct` have a default `constructor`.

lib.rs

```
#[napi(constructor)]
pub struct AnimalWithDefaultConstructor {
  pub name: String,
  pub kind: u32,
}
```

index.d.ts

```
export class AnimalWithDefaultConstructor {
  name: string
  kind: number
  constructor(name: string, kind: number)
}
```

### Custom `constructor` [Permalink for this section](https://napi.rs/docs/concepts/class\#custom-constructor)

If you want to define a custom `constructor`, you can use `#[napi(constructor)]` on your constructor `fn` in the struct `impl` block.

lib.rs

```
// A complex struct that cannot be exposed to JavaScript directly.
pub struct QueryEngine {}

#[napi(js_name = "QueryEngine")]
pub struct JsQueryEngine {
  engine: QueryEngine,
}

#[napi]
impl JsQueryEngine {
  #[napi(constructor)]
  pub fn new() -> Self {
    JsQueryEngine { engine: QueryEngine::new() }
  }
}
```

index.d.ts

```
export class QueryEngine {
  constructor()
}
```

**NAPI-RS** does not currently support `private constructor`. Your custom
constructor must be `pub` in Rust.

## Factory [Permalink for this section](https://napi.rs/docs/concepts/class\#factory)

Besides `constructor`, you can also define factory methods on `Class` by using `#[napi(factory)]`.

lib.rs

```
// A complex struct that cannot be exposed to JavaScript directly.
pub struct QueryEngine {}

#[napi(js_name = "QueryEngine")]
pub struct JsQueryEngine {
  engine: QueryEngine,
}

#[napi]
impl JsQueryEngine {
  #[napi(factory)]
  pub fn with_initial_count(count: u32) -> Self {
    JsQueryEngine { engine: QueryEngine::with_initial_count(count) }
  }
}
```

index.d.ts

```
export class QueryEngine {
  static withInitialCount(count: number): QueryEngine
  constructor()
}
```

If no `#[napi(constructor)]` is defined in the `struct`, and you attempt to
create an instance (`new`) of the `Class` in JavaScript, an error will be
thrown.

test.mjs

```
import { QueryEngine } from './index.js'

new QueryEngine() // Error: Class contains no `constructor`, cannot create it!
```

## `class method` [Permalink for this section](https://napi.rs/docs/concepts/class\#class-method)

You can define a JavaScript class method with `#[napi]` on a struct method in **Rust**.

lib.rs

```
// A complex struct that cannot be exposed to JavaScript directly.
pub struct QueryEngine {}

#[napi(js_name = "QueryEngine")]
pub struct JsQueryEngine {
  engine: QueryEngine,
}

#[napi]
impl JsQueryEngine {
  #[napi(factory)]
  pub fn with_initial_count(count: u32) -> Self {
    JsQueryEngine { engine: QueryEngine::with_initial_count(count) }
  }

  /// Class method
  #[napi]
  pub async fn query(&self, query: String) -> napi::Result<String> {
    self.engine.query(query).await
  }

  #[napi]
  pub fn status(&self) -> napi::Result<u32> {
    self.engine.status()
  }
}
```

index.d.ts

```
export class QueryEngine {
  static withInitialCount(count: number): QueryEngine
  constructor()
  query(query: string) => Promise<string>
  status() => number
}
```

`async fn` needs the `napi4` and `tokio_rt` features to be enabled.

💡

Any `fn` in `Rust` that returns `Result<T>` will be treated as `T` in JavaScript/TypeScript. If the `Result<T>` is `Err`, a JavaScript Error will be thrown.

## `Getter` [Permalink for this section](https://napi.rs/docs/concepts/class\#getter)

Define [JavaScript class `getter` (opens in a new tab)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get) using `#[napi(getter)]`. The Rust `fn` must be a struct method, not an associated function.

lib.rs

```
// A complex struct that cannot be exposed to JavaScript directly.
pub struct QueryEngine {}

#[napi(js_name = "QueryEngine")]
pub struct JsQueryEngine {
  engine: QueryEngine,
}

#[napi]
impl JsQueryEngine {
  #[napi(factory)]
  pub fn with_initial_count(count: u32) -> Self {
    JsQueryEngine { engine: QueryEngine::with_initial_count(count) }
  }

  /// Class method
  #[napi]
  pub async fn query(&self, query: String) -> napi::Result<String> {
    self.engine.query(query).await
  }

  #[napi(getter)]
  pub fn status(&self) -> napi::Result<u32> {
    self.engine.status()
  }
}
```

index.d.ts

```
export class QueryEngine {
  static withInitialCount(count: number): QueryEngine
  constructor()
  get status(): number
}
```

## `Setter` [Permalink for this section](https://napi.rs/docs/concepts/class\#setter)

Define [JavaScript class `setter` (opens in a new tab)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/set) using `#[napi(setter)]`. The Rust `fn` must be a struct method, not an associated function.

lib.rs

```
// A complex struct that cannot be exposed to JavaScript directly.
pub struct QueryEngine {}

#[napi(js_name = "QueryEngine")]
pub struct JsQueryEngine {
  engine: QueryEngine,
}

#[napi]
impl JsQueryEngine {
  #[napi(factory)]
  pub fn with_initial_count(count: u32) -> Self {
    JsQueryEngine { engine: QueryEngine::with_initial_count(count) }
  }

  /// Class method
  #[napi]
  pub async fn query(&self, query: String) -> napi::Result<String> {
    self.engine.query(query).await
  }

  #[napi(getter)]
  pub fn status(&self) -> napi::Result<u32> {
    self.engine.status()
  }

  #[napi(setter)]
  pub fn count(&mut self, count: u32) {
    self.engine.count = count;
  }
}
```

index.d.ts

```
export class QueryEngine {
  static withInitialCount(count: number): QueryEngine
  constructor()
  get status(): number
  set count(count: number)
}
```

## Class as argument [Permalink for this section](https://napi.rs/docs/concepts/class\#class-as-argument)

`Class` is different from [`Object`](https://napi.rs/docs/concepts/object). `Class` can have Rust methods and associated functions on it. Every field in `Class` can be mutated in JavaScript.

So the ownership of the `Class` is actually transferred to the JavaScript side when you create it. It is managed by the JavaScript GC, and you can only pass it back by passing its `reference`.

lib.rs

```
pub fn accept_class(engine: &QueryEngine) {
  // ...
}

pub fn accept_class_mut(engine: &mut QueryEngine) {
  // ...
}
```

index.d.ts

```
export function acceptClass(engine: QueryEngine): void
export function acceptClassMut(engine: QueryEngine): void
```

## Property attributes [Permalink for this section](https://napi.rs/docs/concepts/class\#property-attributes)

The default Property attributes are `writable = true`, `enumerable = true` and `configurable = true`. You can control the Property attributes over the `#[napi]` macro:

lib.rs

```
use napi::bindgen_prelude::*;
use napi_derive::napi;

// A complex struct that cannot be exposed to JavaScript directly.
#[napi]
pub struct QueryEngine {
  num: i32,
}

#[napi]
impl QueryEngine {
  #[napi(constructor)]
  pub fn new() -> Result<Self> {
    Ok(Self {
      num: 42,
    })
  }

  // writable / enumerable / configurable
  #[napi(writable = false)]
  pub fn get_num(&self) -> i32 {
    self.num
  }
}
```

In this case, the `getNum` method of `QueryEngine` is not writable:

main.mjs

```
import { QueryEngine } from './index.js'

const qe = new QueryEngine()
qe.getNum = function () {} // TypeError: Cannot assign to read only property 'getNum' of object '#<QueryEngine>'
```

## Custom Finalize logic [Permalink for this section](https://napi.rs/docs/concepts/class\#custom-finalize-logic)

**NAPI-RS** will drop the Rust struct wrapped in the JavaScript object when the JavaScript object is garbage collected. You can also specify custom finalize logic for the Rust struct.

lib.rs

```
use napi::bindgen_prelude::*;
use napi_derive::napi;

#[napi(custom_finalize)]
pub struct CustomFinalize {
  width: u32,
  height: u32,
  inner: Vec<u8>,
}

#[napi]
impl CustomFinalize {
  #[napi(constructor)]
  pub fn new(mut env: Env, width: u32, height: u32) -> Result<Self> {
    let inner = vec![0; (width * height * 4) as usize];
    let inner_size = inner.len();
    env.adjust_external_memory(inner_size as i64)?;
    Ok(Self {
      width,
      height,
      inner,
    })
  }
}

impl ObjectFinalize for CustomFinalize {
  fn finalize(self, mut env: Env) -> Result<()> {
    env.adjust_external_memory(-(self.inner.len() as i64))?;
    Ok(())
  }
}
```

First, you can set `custom_finalize` attribute in `#[napi]` macro, and NAPI-RS will not generate the default `ObjectFinalize` for the Rust struct.

Then, you can implement `ObjectFinalize` yourself for the Rust struct.

In this case, the `CustomFinalize` struct increases external memory in the **constructor** and decreases it in `fn finalize`.

## `instance of` [Permalink for this section](https://napi.rs/docs/concepts/class\#instance-of)

There is `fn instance_of` on all `#[napi]` class:

lib.rs

```
use napi::bindgen_prelude::*;
use napi_derive::napi;

#[napi]
pub struct NativeClass {}

#[napi]
pub fn is_native_class_instance(env: &Env, value: Unknown) -> Result<bool> {
  NativeClass::instance_of(env, &value)
}
```

main.mjs

```
import { NativeClass, isNativeClassInstance } from './index.js'

const nc = new NativeClass()
console.log(isNativeClassInstance(nc)) // true
console.log(isNativeClassInstance(1)) // false
```

Last updated on July 17, 2025
