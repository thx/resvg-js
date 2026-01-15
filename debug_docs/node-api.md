# Node-API Documentation

#### [`napi_adjust_external_memory`](https://nodejs.org/api/n-api.html#napi_adjust_external_memory)

Added in: v8.5.0N-API version: 1

```c
NAPI_EXTERN napi_status napi_adjust_external_memory(node_api_basic_env env,
                                                    int64_t change_in_bytes,
                                                    int64_t* result); copy
```

- `[in] env`: The environment that the API is invoked under.
- `[in] change_in_bytes`: The change in externally allocated memory that is kept
alive by JavaScript objects.
- `[out] result`: The adjusted value. This value should reflect the
total amount of external memory with the given `change_in_bytes` included.
The absolute value of the returned value should not be depended on.
For example, implementations may use a single counter for all addons, or a
counter for each addon.

Returns `napi_ok` if the API succeeded.

This function gives the runtime an indication of the amount of externally
allocated memory that is kept alive by JavaScript objects
(i.e. a JavaScript object that points to its own memory allocated by a
native addon). Registering externally allocated memory may, but is not
guaranteed to, trigger global garbage collections more
often than it would otherwise.

This function is expected to be called in a manner such that an
addon does not decrease the external memory more than it has
increased the external memory.