const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Allow Metro to bundle HTML files for WebView
config.resolver.assetExts.push('html');

module.exports = config;
