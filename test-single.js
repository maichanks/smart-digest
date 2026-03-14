#!/usr/bin/env node
// Single query test to see if any results come through
const axios = require('axios');
const query = 'oil';

(async () => {
  const params = new URLSearchParams({ q: query, format: 'json', categories: 'general' });
  try {
    const resp = await axios.get(`http://localhost:8080/search?${params}`, { timeout: 12000 });
    const results = resp.data.results || [];
    console.log(`Query "${query}" returned ${results.length} results`);
    if (results.length > 0) {
      console.log('First result:', { title: results[0].title.substring(0, 40), url: results[0].url });
    }
  } catch (e) {
    console.error('ERROR:', e.message);
  }
})();
