// Learn more: https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// tslib's "import" entry wraps its UMD build, which comes out empty in Metro, so pdf-lib (the PDF export)
// fails with "Cannot destructure property '__extends'". Point tslib at its plain ES module build instead.
const resolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'tslib') return context.resolveRequest(context, 'tslib/tslib.es6.js', platform);
  return (resolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
