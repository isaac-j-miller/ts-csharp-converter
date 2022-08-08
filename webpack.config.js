const path = require("path");
const distPath = path.join(__dirname, "dist")
module.exports = {
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "babel-loader",
            options: {
              presets: [ "@babel/typescript"],
              plugins: [
                [
                  "babel-plugin-module-resolver",
                  {
                    root: ["./src"],
                    alias: {
                      src: "./src",
                    },
                  },
                ],
                "@babel/transform-runtime",
                "@babel/plugin-proposal-nullish-coalescing-operator",
                "@babel/plugin-proposal-class-properties",
                "@babel/plugin-proposal-object-rest-spread",
                "@babel/plugin-proposal-optional-chaining",
                "@babel/plugin-transform-typescript",
              ],
            },
          },
        ],
      },
    ],
  },
  resolve: {
    extensions: [".ts"],
  },
  externalsPresets: { node: true },
  mode: "development",
  // devtool: "source-map",
  entry: {
    cli: "./src/cli.ts",
    index: "./src/index.ts",
  },
  target: "node",
  output: {
    filename: "[name].js",
    libraryTarget: "commonjs2",
    path: distPath
  },
};
