const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.resolver.unstable_enablePackageExports = false;

const shimPath = path.resolve(__dirname, "shims/InitializeCore.js");
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react-native/Libraries/Core/InitializeCore") {
    return { filePath: shimPath, type: "sourceFile" };
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.watcher = {
  ...config.watcher,
  additionalExts: config.watcher?.additionalExts || [],
  healthCheck: config.watcher?.healthCheck || {},
};

const originalBlockList = config.resolver?.blockList;
const localPattern = /[/\\]\.local[/\\]/;

if (!originalBlockList) {
  config.resolver.blockList = localPattern;
} else if (originalBlockList instanceof RegExp) {
  const combined = new RegExp(
    `(?:${originalBlockList.source})|(?:${localPattern.source})`,
    originalBlockList.flags
  );
  config.resolver.blockList = combined;
} else if (Array.isArray(originalBlockList)) {
  config.resolver.blockList = [...originalBlockList, localPattern];
}

module.exports = config;
