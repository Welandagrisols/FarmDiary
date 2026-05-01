const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

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
