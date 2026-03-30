const path = require("node:path");

const distPath = path.resolve(__dirname, "dist");
const publicPath = path.resolve(__dirname, "public");

module.exports = (_, argv = {}) => {
	const isProduction = argv.mode === "production";

	return {
		mode: isProduction ? "production" : "development",
		entry: "./src/index.ts",
		devtool: isProduction ? "source-map" : "eval-source-map",
		cache: {
			type: "filesystem",
		},
		devServer: {
			static: {
				directory: publicPath,
			},
		},
		module: {
			rules: [
				{
					test: /\.ts$/,
					use: "ts-loader",
					exclude: /node_modules/,
				},
			],
		},
		resolve: {
			extensions: [".ts", ".js"],
		},
		output: {
			filename: "bundle.js",
			path: distPath,
		},
	};
};
