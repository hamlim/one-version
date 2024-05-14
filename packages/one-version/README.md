# `one-version`

**A strict dependency conformance tool for (mono)repos!**

## Getting Started:

Install `one-version` from the root of your repo (even for monorepos!):

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
  // one of: "bun", "yarn-berry", "yarn", "pnpm", "npm"
  // by default it will try to detect the package manager based on the presence of a lockfile
  "packageManager": "bun",
}
```

## Inspiration:

This is effectively a fork of the [wayfair/one-version](https://github.com/wayfair/one-version) project, which I had partially contributed to while I was at Wayfair. This fork is intended to be a slimmer re-write of the original project, aiming to support the same functionality (eventually), with also supporting `bun`!

This tool should be a drop-in replacement for `@wayfair/one-version`, if you run into any issues or collisions, please open an issue!

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
