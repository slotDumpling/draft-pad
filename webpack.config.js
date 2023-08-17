var path = require("path");

module.exports = {
  mode: "production",
  entry: {
    index: "./src/index.tsx",
    lib: "./src/lib",
  },
  output: {
    path: path.resolve("dist"),
    filename: "[name].js",
    libraryTarget: "commonjs2",
  },
  devtool: "source-map",
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
      {
        test: /\.(png|jpg|gif|svg)$/i,
        use: "url-loader",
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },
  externals: {
    react: "react",
    "react-dom": "react-dom",
    immutable: "immutable",
  },
};
