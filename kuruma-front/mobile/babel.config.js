module.exports = function (api) {
  api.cache(true);
  let plugins = [];

  plugins.push(require('react-native-css-interop/dist/babel-plugin').default);
  plugins.push([
    '@babel/plugin-transform-react-jsx',
    {
      runtime: 'automatic',
      importSource: 'react-native-css-interop',
    },
  ]);
  plugins.push('react-native-worklets/plugin');

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
