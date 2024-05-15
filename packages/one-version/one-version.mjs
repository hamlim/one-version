import fg from "fast-glob";
import { execSync as exec } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path, { join as pathJoin } from "node:path";

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
 *
 * @typedef {object} Config
 * @property {PackageManager} packageManager
 * @property {Overrides} overrides
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
      return parse(readFileSync(pathJoin(rootDirectory, "one-version.config.jsonc"), "utf8"));
    }
    return parse(readFileSync(pathJoin(rootDirectory, "one-version.config.json"), "utf8"));
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
  if (existsSync(pathJoin(rootDirectory, "bun.lockb"))) {
    return "bun";
  }
  throw new Error("Could not infer package manager! Please specify one in the config file.");
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
      let stdout = exec("pnpm list -r --json --depth -1", { encoding: "utf8" });
      /**
       * @type {Array<{
       *   name: string;
       *   path: string; // absolute path
       *   private: boolean;
       *   version?: string;
       * }>}
       */
      let workspaces = JSON.parse(stdout);
      workspaces = workspaces.map(({ name, path }) => ({ name, path }));
      return workspaces;
    }
    case "yarn-classic": {
      /**
       * @type {{
       *   [name: string]: {
       *     location: string; // relative path
       *     workspaceDependencies: string[];
       *     mismatchedWorkspaceDependencies: string[]
       *   }
       * }}
       */
      let stdout = exec("yarn --silent workspaces info", {
        encoding: "utf8",
      });
      let workspaces = JSON.parse(stdout);
      // Yarn Classic does not include the root package.
      let rootPackageJSONPath = path.join(rootDirectory, "package.json");
      let rootPackageJSON = JSON.parse(readFileSync(rootPackageJSONPath, { encoding: "utf8" }));

      return [
        {
          name: rootPackageJSON.name,
          path: rootPackageJSONPath,
        },
        ...Object.entries(workspaces).map(([name, { location }]) => ({
          name,
          path: path.join(rootDirectory, location),
        })),
      ];
    }
    case "yarn-berry": {
      // http://ndjson.org/
      let ndJSONWorkspaces = exec("yarn workspaces list --json", {
        encoding: "utf8",
      });

      if (ndJSONWorkspaces != "") {
        /**
         * @type {Array<{
         *   name: string;
         *   location: string; // relative path
         * }>}
         */
        let workspaces = ndJSONWorkspaces
          .replace(/\n*$/, "") // strip out trailing new line
          .split("\n") // split on new line
          .map((str) => JSON.parse(str)); // parse each workspace

        return workspaces.map(({ location, name }) => ({
          name,
          path: path.join(rootDirectory, location),
        }));
      }
      return [];
    }
    case "npm": {
      let rootPackageJSON = readFileSync(path.join(rootDirectory, "package.json"), { encoding: "utf8" });
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
      let rootPackageJSON = readFileSync(path.join(rootDirectory, "package.json"), { encoding: "utf8" });
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
  let { name, peerDependencies, devDependencies, dependencies, resolutions } = JSON.parse(packageContents);
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
  let dependenciesByNameAndVersion = workspaceDependencies.reduce((
    acc,
    { name: consumerName, dependencies, peerDependencies, devDependencies },
  ) => {
    if (dependencies) {
      Object.entries(dependencies).forEach(([packageName, version]) => {
        let seenConsumers = acc[packageName]?.[version]?.direct || [];
        let versionConsumers = seenConsumers.concat(consumerName);
        acc[packageName] = {
          ...acc[packageName],
          [version]: {
            ...acc[packageName]?.[version],
            direct: versionConsumers,
          },
        };
      });
    }
    if (peerDependencies) {
      Object.entries(peerDependencies).forEach(([packageName, version]) => {
        let seenConsumers = acc[packageName]?.[version]?.peer || [];
        let versionConsumers = seenConsumers.concat(consumerName);
        acc[packageName] = {
          ...acc[packageName],
          [version]: {
            ...acc[packageName]?.[version],
            peer: versionConsumers,
          },
        };
      });
    }
    if (devDependencies) {
      Object.entries(devDependencies).forEach(([packageName, version]) => {
        let seenConsumers = acc[packageName]?.[version]?.dev || [];
        let versionConsumers = seenConsumers.concat(consumerName);
        acc[packageName] = {
          ...acc[packageName],
          [version]: {
            ...acc[packageName]?.[version],
            dev: versionConsumers,
          },
        };
      });
    }
    return acc;
  }, {});

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
            let notOverridden = (packageName) => !packageOverrides[version]?.includes(packageName);
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
  return (
    version.padStart(SINGLE_INDENT + version.length)
    + "\n"
    + dependencyTypeStrings.join("\n")
  );
}

/**
 * Get a string in the format:
 *  [type]: [...names], e.g.:
 *  direct: name1, name2
 */
function getTypeString({ type, names }) {
  const padded = type.padStart(DOUBLE_INDENT + type.length);
  return `${padded}: ` + names.join(", ");
}

function prettify(packages) {
  return packages
    .map(([name, versions]) => {
      const str = name;

      const versionsStr = Object.entries(versions)
        .map(([version, depTypes]) => {
          const depTypeStrings = Object.entries(depTypes).map(([type, names]) => getTypeString({ type, names }));

          return getVersionString(version, depTypeStrings);
        })
        .join("\n");

      return `${str}\n${versionsStr}`;
    })
    .join("\n");
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
export async function start({ rootDirectory, logger, args, exit }) {
  let [firstArg] = args;

  switch (firstArg) {
    case "check": {
      let initialConfig = loadConfig({ rootDirectory });
      if (!initialConfig.packageManager) {
        initialConfig.packageManager = inferPackageManager({ rootDirectory });
      }
      debug("Initial config", JSON.stringify(initialConfig, null, 2));
      let workspaces = getWorkspaces({ rootDirectory, packageManager: initialConfig.packageManager });
      debug("Workspaces", JSON.stringify(workspaces, null, 2));

      let workspaceDependencies = workspaces.map(({ path }) => getDependencies({ path }));
      debug("Workspaces Dependencies", JSON.stringify(workspaceDependencies, null, 2));

      let duplicateDependencies = getDuplicateDependencies({
        workspaceDependencies,
        overrides: initialConfig.overrides,
      });
      debug("Duplicate dependencies", JSON.stringify(duplicateDependencies, null, 2));

      if (duplicateDependencies.length > 0) {
        logger.log(
          "You shall not pass!\n",
          "🚫 One Version Rule Failure - found multiple versions of the following dependencies:\n",
          prettify(duplicateDependencies),
        );

        logger.error("More than one version of dependencies found. See above output.");
        return Promise.resolve({
          statusCode: 1,
        });
      }

      logger.log(
        "My preciousss\n",
        "✨ One Version Rule Success - found no version conflicts!",
      );
      return Promise.resolve({
        statusCode: 0,
      });
    }
    case "help": {
      logger.log(`one-version - a strict dependency conformance tool for (mono)repos!`);
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
