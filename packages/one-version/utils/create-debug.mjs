export function createDebug(namespace) {
  let enabled = process.env.DEBUG?.includes(namespace);

  return function debug(...args) {
    if (enabled) {
      console.log(`[${namespace}]`, ...args);
    }
  };
}
