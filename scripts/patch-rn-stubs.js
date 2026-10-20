#!/usr/bin/env node
// Recreates stubs for react-native files removed in RN 0.81
// but still imported by @expo/metro-runtime 6.x.
// Runs automatically via postinstall.

const fs = require("fs");
const path = require("path");

const STUB = "// Stub — removed in RN 0.81, required by @expo/metro-runtime\n";

const MISSING = [
  "Libraries/Core/Devtools/getDevServer",
  "Libraries/Core/Devtools/openFileInEditor",
  "Libraries/Core/Devtools/parseErrorStack",
  "Libraries/Core/ExceptionsManager",
  "Libraries/Core/InitializeCore",
  "Libraries/NativeModules/specs/NativeLogBox",
  "Libraries/Utilities/DevLoadingView",
  "Libraries/Utilities/HMRClient",
  "Libraries/Utilities/PolyfillFunctions",
];

const rnBase = path.resolve(__dirname, "../node_modules/react-native");

for (const rel of MISSING) {
  const full = path.join(rnBase, rel + ".js");
  if (!fs.existsSync(full)) {
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, STUB);
    console.log("patched:", rel);
  }
}
