#!/usr/bin/env node
// Test SearXNG to see what sources we get
const axios = require('axios');

async function main() {
  const query = '石油';
  const params = new URLSearchParams({ q: query, format: 'json' });
  const resp = await axios.get(`http://localhost:8080/search?${params}`, { timeout: 10000 });
  const results = resp.data.results || [];
  console.log(`Total results: ${results.length}`);
  // Show domain distribution
  const domains = {};
  results.forEach(r => {
    const d = r.url.split('/')[2];
    domains[d] = (domains[d] || 0) + 1;
  });
  console.log('Domains:', domains);
  // Show first 3 items
  results.slice(0, 3).forEach((r, i) => {
    console.log(`\nItem ${i+1}:`, { title: r.title.substring(0, 50), url: r.url, engine: r.engine });
  });
}

main();
