# inertia_oak_middleware

About @inertiajs inertia server-side adapter for the @denoland Deno web-framework @oakserver oak

## Credits

Favicon convertet from https://github.com/hashrock licensed under MIT

## Features

- [x] Basic Inertia render
- [x] Static asset support
- [x] template to integrate with JS-UI-framework tooling
    - preferred eta but it is not possible, because vite cant process .eta and <%= =%\>
    - [ ] check if vite can process {{{ html }}}
    - [x] make it possible add support multiple renderer
- [ ] Version support
    - [x] Basic support
    - [x] Move in Middleware to return early
      [reference](https://github.com/inertiajs/inertia-laravel/blob/1ba4a0dba2d52ea88dec6b94360fce5f2a9415cc/src/Middleware.php#L78)
      ?
        - [x] Ask on discord or don't do it because the Pricing CRM sets headers and cookies even though the version
          mismatch and the render is the last call anyways. 
        - [x] Check if complete html should be returned on POST request without version header -> Not a use case
    - [ ] Session support \( reflash session when it contains errors, and version is incorrect \)
- [x] Shared Props
- [x] Redirect \( with shorthand \) for example in store methods
  - [x] internal
  - [x] external via inertia.location
- [ ] Validation Errors
- [ ] View Data
- [ ] Partial Reloads

### In question

- [ ] Log if request version equals current version
- [ ] Setup with session