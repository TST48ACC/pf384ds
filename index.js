const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();

const EDU = 'https://eduphoria.pages.dev';
const SANTA = 'https://smartfoloosanta.pages.dev';

// Fixes assets like Geometry Dash levels/music
app.use('/game-assets', createProxyMiddleware({
  target: SANTA,
  changeOrigin: true,
  pathRewrite: {'^/game-assets': ''},
  onProxyRes: p => p.headers['Access-Control-Allow-Origin'] = '*'
}));

// Loads the main site and removes blocks
app.use('/', createProxyMiddleware({
  target: EDU,
  changeOrigin: true,
  onProxyRes: p => {
    delete p.headers['x-frame-options'];
    delete p.headers['content-security-policy'];
  }
}));

app.listen(process.env.PORT || 3000);
