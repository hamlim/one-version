# `one-version`

**A strict dependency conformance tool for (mono)repos!**

**[Docs](https://one-version.vercel.app/)**

## Getting Started:

Install `one-version` from the root of your repo:

```bash
bun add one-version
```

Add a `one-version:check` script to your root `package.json`:

```json
{
  "scripts": {
    "one-version:check": "one-version check"
  }
}
```

## Configuration:

`one-version` can be configured using a `one-version.config.(jsonc|json)` file in the root of your repo. Here's an example:

```jsonc
{
  "$schema": "https://one-version.vercel.app/schema.json",
  // one of: "bun", "yarn-berry", "yarn-classic", "pnpm", "npm"
  // by default it will try to detect the package manager based on the presence of a lockfile
  "packageManager": "bun",
  // A mapping of dependencies, and which workspaces are "allowed" to use different versions
  "overrides": {
    "react": {
      "18.0.0": ["pkg-a"],
      // Wildcards are supported, and will capture any workspaces!
      "17.0.0": ["*"]
    }
  },
  // one of: "pin", "loose", defaults to `loose` if not provided
  // pin: all dependencies and devDependencies must use an exact version
  // meaning no ranges (`^`, `~`, `.x`, etc.) are allowed
  "versionStrategy": "pin"
}
```

### Supported Package Managers/Versions:

- Bun (`bun`)
- Yarn Berry (`yarn-berry`) - Yarn versions 2.x, 3.x, 4.x
- Yarn Classic (`yarn-classic`) - Yarn versions 1.x
- PNPM (`pnpm`)
- NPM (`npm`) - npm versions 7.x and greater
- Deno (`deno`) - When using `package.json`

## Inspiration:

This is effectively a fork of the [wayfair/one-version](https://github.com/wayfair/one-version) project, which I had partially contributed to while I was at Wayfair. This fork is intended to be a slimmer re-write of the original project, aiming to support the same functionality (eventually)!

This tool should be a drop-in replacement for `@wayfair/one-version`, if you run into any issues or collisions, please open an issue!

This package also notably includes a few additional features:

- Support for `npm` and `bun` package managers
- Support for wildcards (`"*"`) within the `overrides` configuration
- Support for `"versionStrategy"` configuration to enforce strict versioning across the repo!

## Contributing:

This library does not have a build step currently.

### Code Quality:

#### Type Checking:

This library uses TypeScript to perform type checks, run `bun run type-check` from the root or from this workspace!

#### Linting

This library uses [BiomeJS](https://biomejs.dev/) for linting, run `bun run lint` from the root or from this workspace!

#### Tests

This library uses Node.js for running unit tests, run `bun run test` from the root or from this workspace!

### Publishing:

To publish the library, run `bun run pub` from the workspace root. This will prompt you to login to npm and publish the package.
