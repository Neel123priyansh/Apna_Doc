// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);


if (!config.resolver.assetExts.includes('glb')) {
  config.resolver.assetExts.push('glb');
}


// Force react-native-vision-camera to resolve from compiled lib/commonjs
// instead of TypeScript src/ (which Metro picks via the "react-native" field).
// Without this override Metro tries to load unbuilt Nitro source files.
const visionCameraRoot = path.resolve(
  __dirname,
  'node_modules/react-native-vision-camera'
);

config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    // Intercept any import that resolves inside vision-camera's src/
    if (moduleName === 'react-native-vision-camera') {
      return {
        filePath: path.join(visionCameraRoot, 'lib/commonjs/index.js'),
        type: 'sourceFile',
      };
    }
    // Default resolution for everything else
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
