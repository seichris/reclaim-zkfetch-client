const webpack = require("webpack");
const NodePolyfillPlugin = require('node-polyfill-webpack-plugin');

module.exports = function override(config) {
  // Add polyfills for Node.js core modules
  const fallback = config.resolve.fallback || {};
  const alias = {
    koffi: false,
    "react-native-tcp-socket": false,
  }
  config.resolve.alias = alias;
  Object.assign(fallback, {
    crypto: require.resolve("crypto-browserify"),
    stream: require.resolve("stream-browserify"),
    assert: require.resolve("assert"),
    http: require.resolve("stream-http"),
    https: require.resolve("https-browserify"),
    os: require.resolve("os-browserify"),
    url: require.resolve("url"), // Polyfill for URL
    vm: require.resolve("vm-browserify"),
    path: require.resolve("path-browserify"),
    zlib: require.resolve("browserify-zlib"),
    fs: false,
    net: false,
    koffi: false,
    "react-native-tcp-socket": false,
    tls: false,
    worker_threads: false,
    readline: false,
    re2: false,
    child_process: false,
    constants: require.resolve("constants-browserify"),
    process: require.resolve("process/browser.js"),
  });

  // Set up alias for disabling node:url
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    'node:url': require.resolve("url/"), // Add this line
  };

  // Add alias for node:url to mock-url.js
  config.resolve = {
    ...config.resolve,
    alias: {
      ...config.resolve.alias,
     'node:url': require.resolve('url/'), 
    }
  };

  // Ensure fallback is applied
  config.resolve.fallback = fallback;

  // Add plugins
  config.plugins = (config.plugins || []).concat([
    new NodePolyfillPlugin(),
    new webpack.ProvidePlugin({
      process: "process/browser.js",
      Buffer: ["buffer", "Buffer"],
    }),
    new webpack.IgnorePlugin({
      resourceRegExp: /^node:url$/
    }),
  ]);

  // Source map loader
  config.module.rules.push({
    test: /\.js$/,
    enforce: 'pre',
    use: ['source-map-loader'],
    exclude: /node_modules/,
  });

  // Add extension-specific configurations
  config.output = {
    ...config.output,
    publicPath: '/',
  };

  // Enable WebAssembly
  config.experiments = {
    ...config.experiments,
    asyncWebAssembly: true,
  };

  // Update module rules for WebAssembly
  config.module.rules.push({
    test: /\.wasm$/,
    type: 'webassembly/async',
  });

  return config;
};
