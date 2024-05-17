### Unreleased:

### [0.2.0] - May 17th, 2024

Added support for pinned version strategy checking.

To enable, you can add `"versionStrategy": "pin"` to your `one-version.config.(json|jsonc)` configuration file:

```jsonc
{
  "$schema": "https://one-version.vercel.app/schema.json",
  "packageManager": "bun",
  "versionStrategy": "pin"
}
```

Notably, this respects your existing `overrides` configuration - if you want to allow some specific loose versions for specific dependencies.

### [0.1.1] - May 15th, 2024

- Added homepage to package.json, and repo info
- Add link to docs in README

### [0.1.0] - May 15th, 2024

- Update description in package.json
- Remove unnecessary devDependencies
- Update readme
- Add implementation
- Add tests

### [0.0.1] - May 14th, 2024

- Initial release
