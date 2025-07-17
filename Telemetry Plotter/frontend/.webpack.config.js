const path = require('path');

module.exports = {
  entry: './src/timeline.js',
  output: {
    path: path.resolve(__dirname, 'public'),
    filename: 'timeline.bundle.js'
  },
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      }
    ]
  },
  externals: {
    // Avoid bundling large libraries unnecessarily
    'react': 'React',
    'react-dom': 'ReactDOM',
    'chart.js': 'Chart',
    'react-chartjs-2': 'ReactChartJS2',
    'chartjs-adapter-date-fns': 'ChartJSAdapterDateFns',
    'chartjs-plugin-annotation': 'ChartJSPluginAnnotation'
  }
};