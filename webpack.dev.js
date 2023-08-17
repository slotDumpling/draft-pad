var path = require("path");
const config = require("./webpack.config");
config.mode = "development";
config.watch = true;

module.exports = config;
