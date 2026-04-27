// webpack.config.js
const path              = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack           = require('webpack')

module.exports = (env, argv) => {
  const isDev  = argv.mode === 'development'
  const outDir = isDev ? 'dist' : 'build'

  return {
    mode: argv.mode || 'development',

    entry: './src/index.js',
    target: 'web',

    output: {
      path: path.resolve(__dirname, 'build'),
      filename: 'renderer.js',
      clean: true, // Nettoie automatiquement le dossier build
      publicPath: isDev ? '/' : './',
      chunkFilename: isDev
        ? '[name].renderer.js'
        : '[name].[contenthash].renderer.js',
      globalObject: 'window'
    },

    module: {
      rules: [
        { test: /\.jsx?$/, exclude: /node_modules/, use: 'babel-loader' },
        { test: /\.css$/i, use: ['style-loader', 'css-loader'] },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: 'asset/resource',
          generator: { filename: 'static/media/[name].[hash][ext]' }
        }
      ]
    },

    resolve: {
      modules: [path.resolve(__dirname, 'src'), 'node_modules'],
      extensions: ['.js', '.jsx'],
      alias: { '@api': path.resolve(__dirname, 'src/api.js') }
    },

    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
        filename: 'index.html'
      }),
      new webpack.ProvidePlugin({
        global: require.resolve('global')
      }),
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(argv.mode)
      })
    ],

    optimization: {
      splitChunks: false
    },

    devtool: isDev ? 'source-map' : false,

    node: {
      __dirname: false,
      __filename: false
    },

    // Fixed dev server port for the renderer (prevents port hopping)
    devServer: isDev ? {
      port: 3000,
      host: 'localhost',
      hot: true,
      historyApiFallback: true,
      allowedHosts: 'all',
      client: {
        overlay: true
      }
    } : undefined
  }
}
