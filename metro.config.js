const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

config.watchFolders = (config.watchFolders || []).filter(
  (folder) => !folder.includes(".local")
);

config.resolver.blockList = [
  /\.local\/.*/,
  ...(config.resolver.blockList ? [config.resolver.blockList] : []),
];

module.exports = config;
