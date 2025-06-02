### Unreleased:

### [0.3.1] - June 2nd, 2025

Replace internal dependency on `fast-glob` with `tinyglobby`. There should be no changes for end user behavior!

### [0.3.0] - May 27th, 2025

**No breaking Changes**

This change adds support for "single package repos" (e.g. repos that don't use workspaces).

### [0.2.2] - April 8th, 2024

Improve log line output/formatting

### [0.2.1] - April 8th, 2024

Update packageManager inference for modern versions of bun using text-based lockfile format

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
