module.exports = function (api) {
    api.cache(true);

    // babel-preset-expo adds the react-native-worklets plugin (Reanimated 4) itself
    return {
        presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    };
};
