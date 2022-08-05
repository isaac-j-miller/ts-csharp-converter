module.exports = {
  presets: [
    [
      "@babel/preset-env",
      {
        modules: "commonjs",
        targets: { node: "current" },
      },
    ],
    "@babel/preset-typescript",
  ],
  sourceMap: "inline",
  retainLines: true,
  plugins: [
    "@babel/plugin-transform-typescript",
    "@babel/transform-runtime",
    "@babel/plugin-proposal-nullish-coalescing-operator",
    "@babel/plugin-proposal-class-properties",
    "@babel/plugin-proposal-object-rest-spread",
    "@babel/plugin-proposal-optional-chaining",
  ],
};
