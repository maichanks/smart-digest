#!/usr/bin/env node
// Quick test: fetch from SearXNG and print
const axios = require('axios');
const url = 'http://localhost:8080/search';
const params = new URLSearchParams({
  q: 'latest news',
  format: 'json',
  categories: 'general',
  language: 'zh-CN',
});
axios.get(`${url}?${params}`, { timeout: 10000 })
  .then(res => {
    console.log('SearXNG response:', JSON.stringify(res.data, null, 2).slice(0, 2000));
  })
  .catch(err => {
    console.error('SearXNG error:', err.message);
  });
