import { execSync as exec } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path, { join as pathJoin } from "node:path";
import fg from "fast-glob";

import { createDebug } from "./utils/create-debug.mjs";
import { parse } from "./utils/jsonc-parser.mjs";

let debug = createDebug("one-version");

// MARK: Config
/**
 * @typedef {string} PackageName      - Name of dependency, e.g. "react"
 * @typedef {string} VersionSpecifier - Version specifier, e.g. "^16.8.0"
 * @typedef {string} WorkspaceName    - Name of workspace, e.g. "one-version"
 * @typedef {'yarn-classic' | 'yarn-berry' | 'npm' | 'pnpm' | 'bun'} PackageManager
 * @typedef {Record<PackageName, Record<VersionSpecifier, Array<WorkspaceName>>} Overrides
 * @typedef {'pin' | 'loose'} VersionStrategy
 *
 * @typedef {object} Config
 * @property {PackageManager} packageManager
 * @property {Overrides} overrides
 * @property {VersionStrategy} versionStrategy
 */

/**
 * @param {object} options
 * @param {string} options.rootDirectory
 * @returns {Config} config
 */
function loadConfig({ rootDirectory }) {
  try {
    // prefer jsonc first, then fallback to .json
    if (existsSync(pathJoin(rootDirectory, "one-version.config.jsonc"))) {
      return parse(
        readFileSync(
          pathJoin(rootDirectory, "one-version.config.jsonc"),
          "utf8",
        ),
      );
    }
    return parse(
      readFileSync(pathJoin(rootDirectory, "one-version.config.json"), "utf8"),
    );
  } catch (error) {
    debug("Error loading config", error);
    return {};
  }
}

// MARK: Infer Package Manager
/**
 * @param {object} options
 * @param {string} options.rootDirectory
 * @returns {PackageManager}
 */
function inferPackageManager({ rootDirectory }) {
  if (existsSync(pathJoin(rootDirectory, "yarn.lock"))) {
    if (existsSync(pathJoin(rootDirectory, ".yarnrc.yml"))) {
      return "yarn-berry";
    }
    return "yarn-classic";
  }
  if (existsSync(pathJoin(rootDirectory, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (existsSync(pathJoin(rootDirectory, "package-lock.json"))) {
    return "npm";
  }
  if (
    existsSync(pathJoin(rootDirectory, "bun.lockb")) ||
    // modern versions of bun can use the text-based lockfile format
    existsSync(pathJoin(rootDirectory, "bun.lock"))
  ) {
    return "bun";
  }
}

// MARK: Get Workspaces
/**
 * @typedef {object} Workspace
 * @property {string} name
 * @property {string} path
 *
 * @param {object} options
 * @param {string} options.rootDirectory
 * @param {PackageManager} options.packageManager
 * @returns {Array<Workspace>}
 */
function getWorkspaces({ rootDirectory, packageManager }) {
  switch (packageManager) {
    case "pnpm": {
      let workspaces = [];
      try {
        // this can fail if not running in a monorepo
        let stdout = exec("pnpm list -r --json --depth -1", {
          cwd: rootDirectory,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        /**
         * @type {Array<{
         *   name: string;
         *   path: string; // absolute path
         *   private: boolean;
         *   version?: string;
         * }>}
         */
        let parsedWorkspaces = JSON.parse(stdout);
        workspaces = parsedWorkspaces.map(({ name, path }) => ({ name, path }));
        return workspaces;
      } catch (error) {
        // @TODO: consider if we should surface this error to the user
        // it could be a config issue if they expect to find workspaces :thinking:
        debug("Error getting workspaces", error);
        return workspaces;
      }
    }
    case "yarn-classic": {
      let workspaces = [];
      // Yarn Classic does not include the root package.
      let rootPackageJSONPath = path.join(rootDirectory, "package.json");
      let rootPackageJSON = JSON.parse(
        readFileSync(rootPackageJSONPath, { encoding: "utf8" }),
      );
      workspaces.push({
        name: rootPackageJSON.name,
        path: rootDirectory,
      });
      try {
        // Silent still prints out some character escape sequences at the beginning that `trim` / `trimStart` doesn't remove
        // Passing `--json` changes the output to be a stringified object of: `log` and `data`
        // where `data` is a stringified object of workspace names and their dependencies
        let stdout = exec("yarn --silent --json workspaces info", {
          cwd: rootDirectory,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        let output = JSON.parse(stdout);
        /**
         * @type {{
         *   [name: string]: {
         *     location: string; // relative path
         *     workspaceDependencies: string[];
         *     mismatchedWorkspaceDependencies: string[]
         *   }
         * }}
         */
        let parsedWorkspaces = JSON.parse(output.data);

        return [
          ...workspaces,
          ...Object.entries(parsedWorkspaces).map(([name, { location }]) => ({
            name,
            path: path.join(rootDirectory, location),
          })),
        ];
      } catch (error) {
        debug("Error getting workspaces", error);
        return workspaces;
      }
    }
    case "yarn-berry": {
      let workspaces = [];
      try {
        // http://ndjson.org/
        let ndJSONWorkspaces = exec("yarn workspaces list --json", {
          cwd: rootDirectory,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        });

        if (ndJSONWorkspaces !== "") {
          /**
           * @type {Array<{
           *   name: string;
           *   location: string; // relative path
           * }>}
           */
          let parsedWorkspaces = ndJSONWorkspaces
            .replace(/\n*$/, "") // strip out trailing new line
            .split("\n") // split on new line
            .map((str) => JSON.parse(str)); // parse each workspace

          return parsedWorkspaces.map(({ location, name }) => ({
            name,
            path: path.join(rootDirectory, location),
          }));
        }
      } catch (error) {
        debug("Error getting workspaces", error);
        return workspaces;
      }
      return [];
    }
    case "npm": {
      let rootPackageJSON = readFileSync(
        path.join(rootDirectory, "package.json"),
        { encoding: "utf8" },
      );
      rootPackageJSON = JSON.parse(rootPackageJSON);
      let workspaceGlobs = rootPackageJSON.workspaces || [];

      let workspaces = [];
      for (let workspaceGlob of workspaceGlobs) {
        let workspacePaths = fg.sync(workspaceGlob, {
          cwd: rootDirectory,
          absolute: true,
          onlyDirectories: true,
        });
        for (let workspacePath of workspacePaths) {
          workspaces.push({
            name: path.basename(workspacePath),
            path: workspacePath,
          });
        }
      }
      return workspaces;
    }
    case "bun": {
      let rootPackageJSON = readFileSync(
        path.join(rootDirectory, "package.json"),
        { encoding: "utf8" },
      );
      rootPackageJSON = JSON.parse(rootPackageJSON);
      let workspaceGlobs = rootPackageJSON.workspaces || [];

      let workspaces = [];
      for (let workspaceGlob of workspaceGlobs) {
        let workspacePaths = fg.sync(workspaceGlob, {
          cwd: rootDirectory,
          absolute: true,
          onlyDirectories: true,
        });
        for (let workspacePath of workspacePaths) {
          workspaces.push({
            name: path.basename(workspacePath),
            path: workspacePath,
          });
        }
      }
      return workspaces;
    }
  }
}

// MARK: Get Dependencies
/**
 * @typedef {object} WorkspaceDependencies
 * @property {string} name
 * @property {Record<string, string>} [peerDependencies]
 * @property {Record<string, string>} [devDependencies]
 * @property {Record<string, string>} [dependencies]
 * @property {Record<string, string>} [resolutions]
 *
 * @param {object} options
 * @param {string} options.path
 * @returns {Record<string, string>}
 */
function getDependencies({ path: workspacePath }) {
  let packageContents = readFileSync(path.join(workspacePath, "package.json"), {
    encoding: "utf8",
  });
  let { name, peerDependencies, devDependencies, dependencies, resolutions } =
    JSON.parse(packageContents);
  return { name, peerDependencies, devDependencies, dependencies, resolutions };
}

// MARK: Get Duplicate Dependencies
/**
 * @param {object} options
 * @param {Array<WorkspaceDependencies>} options.workspaceDependencies
 * @param {Overrides} options.overrides
 * @returns {Array<string>}
 */
function getDuplicateDependencies({ workspaceDependencies, overrides }) {
  /**
   * Transform dependencies from an array of package json formats, i.e. multiple
   * {
   *   name: "packageName",
   *   dependencies: {
   *     'react': '^18'
   *   }
   * }
   * into an inverted structure organized by each dependency name, version, and type:
   * {
   *   react: {
   *     '^18': {direct: [ 'packageName' ], peer: ['demo-package']},
   *     '^17': {direct: [ 'demo', 'platform-capabilities' ]}
   *   },
   * }
   * that is,
   * {
   *    dependencyName: {
   *      versionSpecifier: {dependencyType: [ consumers using this specifier and type ]}
   *    }
   * }
   * @type {Record<string, Record<string, Record<'direct' | 'peer' | 'dev', Array<string>>>>}
   */
  let dependenciesByNameAndVersion = workspaceDependencies.reduce(
    (
      acc,
      { name: consumerName, dependencies, peerDependencies, devDependencies },
    ) => {
      if (dependencies) {
        for (let [packageName, version] of Object.entries(dependencies)) {
          let seenConsumers = acc[packageName]?.[version]?.direct || [];
          let versionConsumers = seenConsumers.concat(consumerName);
          acc[packageName] = {
            ...acc[packageName],
            [version]: {
              ...acc[packageName]?.[version],
              direct: versionConsumers,
            },
          };
        }
      }
      if (peerDependencies) {
        for (let [packageName, version] of Object.entries(peerDependencies)) {
          let seenConsumers = acc[packageName]?.[version]?.peer || [];
          let versionConsumers = seenConsumers.concat(consumerName);
          acc[packageName] = {
            ...acc[packageName],
            [version]: {
              ...acc[packageName]?.[version],
              peer: versionConsumers,
            },
          };
        }
      }
      if (devDependencies) {
        for (let [packageName, version] of Object.entries(devDependencies)) {
          let seenConsumers = acc[packageName]?.[version]?.dev || [];
          let versionConsumers = seenConsumers.concat(consumerName);
          acc[packageName] = {
            ...acc[packageName],
            [version]: {
              ...acc[packageName]?.[version],
              dev: versionConsumers,
            },
          };
        }
      }
      return acc;
    },
    {},
  );

  /**
   * Finds dependencies with multiple versions (excluding overrides)
   */
  return Object.entries(dependenciesByNameAndVersion)
    .map(([packageName, versions]) => {
      let packageOverrides = overrides?.[packageName];
      if (packageOverrides) {
        /**
         * Removes overridden dependencies from the versions arrays
         */
        let filteredVersions = Object.entries(versions)
          .map(([version, { direct, peer, dev }]) => {
            let filteredPackages = {};
            let notOverridden = (packageName) =>
              // If it's not a direct match on the packageName (workspaceName) and if it's not a wildcard match
              !packageOverrides[version]?.includes(packageName) &&
              !packageOverrides[version]?.includes("*");
            if (direct) {
              let directDependencies = direct.filter(notOverridden);
              if (directDependencies.length > 0) {
                filteredPackages.direct = directDependencies;
              }
            }
            if (peer) {
              let peerDependencies = peer.filter(notOverridden);
              if (peerDependencies.length > 0) {
                filteredPackages.peer = peerDependencies;
              }
            }
            if (dev) {
              let devDependencies = dev.filter(notOverridden);
              if (devDependencies.length > 0) {
                filteredPackages.dev = devDependencies;
              }
            }
            return [version, filteredPackages];
          })
          .filter(([, dependents]) => Object.keys(dependents).length > 0);
        return [packageName, Object.fromEntries(filteredVersions)];
      }
      return [packageName, versions];
    })
    .filter(([, versions]) => Object.keys(versions).length > 1);
}

// MARK: Prettify

let SINGLE_INDENT = 2;
let DOUBLE_INDENT = SINGLE_INDENT * 2;

/**
 * Get a string in the format:
 *  [version]:
 *     [...dependencyTypeStrings]
 *
 * e.g.:
 * 16
 *   direct: mock-app-b
 */
function getVersionString(version, dependencyTypeStrings) {
  return `${version.padStart(SINGLE_INDENT + version.length)}
${dependencyTypeStrings.join("\n")}`;
}

/**
 * Get a string in the format:
 *  [type]: [...names], e.g.:
 *  direct: name1, name2
 */
function getTypeString({ type, names }) {
  const padded = type.padStart(DOUBLE_INDENT + type.length);
  return `${padded}:  ${names.join(", ")}`;
}

function prettify(packages) {
  return packages
    .map(([name, versions]) => {
      const str = name;

      const versionsStr = Object.entries(versions)
        .map(([version, depTypes]) => {
          const depTypeStrings = Object.entries(depTypes).map(([type, names]) =>
            getTypeString({ type, names }),
          );

          return getVersionString(version, depTypeStrings);
        })
        .join("\n");

      return `${str}\n${versionsStr}`;
    })
    .join("\n");
}

// MARK: Get Unpinned Dependencies

/**
 * @param {object} options
 * @param {Array<WorkspaceDependencies>} options.workspaceDependencies
 * @param {Overrides} options.overrides
 * @returns {Record<WorkspaceName, Array<string>>}
 *
 * exported for tests only
 */
export function getUnpinnedDependencies({ workspaceDependencies, overrides }) {
  let unpinnedDependencies = {};
  // Notably - omit peerDeps since those can be semver ranges
  for (let {
    name: workspaceName,
    dependencies,
    devDependencies,
  } of workspaceDependencies) {
    let allDependencies = { ...dependencies, ...devDependencies };
    for (let [packageName, version] of Object.entries(allDependencies)) {
      // Let `file:`, `url:`, `git:`, `link:`, and `workspace:*` dependencies pass currently
      if (
        version.startsWith("file:") ||
        version.startsWith("url:") ||
        version.startsWith("git:") ||
        version.startsWith("link:") ||
        version === "workspace:*"
      ) {
        continue;
      }
      if (
        version.startsWith("^") ||
        version.startsWith("~") ||
        // any version
        version.includes("*") ||
        // range versions
        version.includes(".x") ||
        version.includes(".X") ||
        version.includes(" - ") ||
        version.includes(" || ") ||
        // Greater Than, Less Than
        version.includes(">") ||
        version.includes("<") ||
        // Keywords:
        version === "latest" ||
        version === "canary" ||
        version === "next" ||
        version === "beta" ||
        version === "alpha" ||
        version === "rc" ||
        version === "dev" ||
        // workspace custom semver range deps
        version.startsWith("workspace:^") ||
        version.startsWith("workspace:~")
      ) {
        if (
          // If we've overridden this specific package@version for this specific workspace
          overrides?.[packageName]?.[version]?.includes(workspaceName) ||
          // or if we've overridden this specific package@version for any workspace
          overrides?.[packageName]?.[version]?.includes("*")
        ) {
          continue;
        }
        unpinnedDependencies[workspaceName] =
          unpinnedDependencies[workspaceName] || [];
        unpinnedDependencies[workspaceName].push(`${packageName}@${version}`);
      }
    }
  }
  return unpinnedDependencies;
}

// MARK: Start
let usageLogs = [
  "",
  `Usage:`,
  `  one-version check - Check the repo to ensure all dependencies are match the expected versions`,
  `  one-version help  - Display this help message!`,
  "",
];
/**
 * @typedef {Record<"log" | "error", Function>} Logger
 *
 * @param {object} options
 * @param {string} options.rootDirectory
 * @param {Logger} options.logger
 * @param {Array<string>} options.args
 * @param {Function} options.exit
 */
export async function start({ rootDirectory, logger, args }) {
  let [firstArg] = args;

  switch (firstArg) {
    case "check": {
      let initialConfig = loadConfig({ rootDirectory });
      if (!initialConfig.packageManager) {
        let inferredPackageManager = inferPackageManager({ rootDirectory });
        if (typeof inferredPackageManager !== "string") {
          logger.error(
            "Could not infer package manager! Please specify one in the config file.",
          );
          return Promise.resolve({
            statusCode: 1,
          });
        }
        initialConfig.packageManager = inferredPackageManager;
      }
      if (!initialConfig.versionStrategy) {
        initialConfig.versionStrategy = "loose";
      }
      debug("Initial config", JSON.stringify(initialConfig, null, 2));
      let workspaces = getWorkspaces({
        rootDirectory,
        packageManager: initialConfig.packageManager,
      });
      debug("Workspaces", JSON.stringify(workspaces, null, 2));

      let rootDependencies = getDependencies({ path: rootDirectory });
      debug("Root dependencies", JSON.stringify(rootDependencies, null, 2));

      let workspaceDependencies = workspaces.map(({ path }) =>
        getDependencies({ path }),
      );
      debug(
        "Workspaces Dependencies",
        JSON.stringify(workspaceDependencies, null, 2),
      );

      // Check for duplicate and mismatched versions of dependencies
      let duplicateDependencies = getDuplicateDependencies({
        workspaceDependencies,
        overrides: initialConfig.overrides,
      });
      debug(
        "Duplicate dependencies",
        JSON.stringify(duplicateDependencies, null, 2),
      );

      let pendingStatusCode = 0;
      let status = "✅";

      if (duplicateDependencies.length > 0) {
        status = "🚫";
        logger.log(
          [
            "You shall not pass!",
            "🚫 One Version Rule Failure",
            "",
            "Found multiple versions of the following dependencies:",
            "",
            prettify(duplicateDependencies),
          ].join("\n"),
        );

        pendingStatusCode = 1;
      }

      // check versionStrategy
      if (initialConfig.versionStrategy === "pin") {
        // check if all dependencies are pinned
        let monorepoUnpinnedDependencies = getUnpinnedDependencies({
          workspaceDependencies,
          overrides: initialConfig.overrides,
        });

        let rootUnpinnedDependencies = getUnpinnedDependencies({
          workspaceDependencies: [rootDependencies],
          overrides: initialConfig.overrides,
        });

        let unpinnedDependencies = {
          ...(monorepoUnpinnedDependencies || {}),
          ...(rootUnpinnedDependencies || {}),
        };

        debug(
          "Unpinned dependencies",
          JSON.stringify(unpinnedDependencies, null, 2),
        );

        if (Object.keys(unpinnedDependencies).length > 0) {
          status = "🚫";
          logger.log(
            [
              // if we already logged a failure, don't log the header again
              ...(pendingStatusCode === 0
                ? ["You shall not pass!", "🚫 One Version Rule Failure"]
                : ["", ""]),
              "Found unpinned dependencies (with versionStrategy: 'pin'):",
              "",
              Object.entries(unpinnedDependencies)
                .map(([workspaceName, deps]) => {
                  return `${workspaceName}:\n${deps
                    .map((dep) => dep.padStart(dep.length + SINGLE_INDENT))
                    .join("\n")}`;
                })
                .join("\n\n"),
            ].join("\n"),
          );
          pendingStatusCode = 1;
        }
      }

      if (status === "✅") {
        logger.log(
          [
            "My preciousss",
            "✨ One Version Rule Success - found no version conflicts!",
          ].join("\n"),
        );
      }
      return Promise.resolve({
        statusCode: pendingStatusCode,
      });
    }
    case "help": {
      logger.log(
        `one-version - a strict dependency conformance tool for (mono)repos!`,
      );
      for (let log of usageLogs) {
        logger.log(log);
      }
      return Promise.resolve({
        statusCode: 0,
      });
    }
    default: {
      logger.log(`Unknown command: ${firstArg}`);
      for (let log of usageLogs) {
        logger.log(log);
      }
      return Promise.resolve({
        statusCode: 1,
      });
    }
  }
}
