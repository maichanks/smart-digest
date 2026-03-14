#!/usr/bin/env node
// Test multiple queries for oil news
const axios = require('axios');

async function testQuery(q) {
  const params = new URLSearchParams({ q, format: 'json', categories: 'news' });
  try {
    const resp = await axios.get(`http://localhost:8080/search?${params}`, { timeout: 10000 });
    const results = (resp.data.results || []).filter(r => !r.url.includes('zhihu.com'));
    console.log(`Query "${q}": ${results.length} results (non-zhihu)`);
    if (results.length > 0) {
      const domains = {};
      results.forEach(r => {
        const d = r.url.split('/')[2];
        domains[d] = (domains[d] || 0) + 1;
      });
      console.log('  Domains:', domains);
      console.log(`  Sample: "${results[0].title}" (${results[0].url})`);
    }
  } catch (e) {
    console.error(`Query "${q}" error:`, e.message);
  }
}

(async () => {
  await testQuery('oil news');
  await testQuery('energy news');
  await testQuery('petroleum');
  await testQuery('原油');
})();
