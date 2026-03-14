#!/usr/bin/env node
// Debug oil query with detailed logging
const fs = require('fs');
const yaml = require('yaml');
const axios = require('axios');

async function main() {
  const cfg = yaml.parse(fs.readFileSync('config.yaml', 'utf-8')).smartDigest;
  const queries = cfg.userInterests || cfg.searchSources.queries || ['石油'];
  console.log('Queries:', queries);

  // Fetch SearXNG
  const fetchSearxng = async (query) => {
    const sx = cfg.searchSources;
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      categories: sx.categories || 'general',
    });
    const url = `${sx.searxngUrl}/search?${params}`;
    console.log(`Fetching: ${url}`);
    const resp = await axios.get(url, { timeout: 10000 });
    const data = resp.data;
    return data.results.slice(0, sx.maxResults || 10).map(r => ({
      title: r.title,
      link: r.url,
      content: r.content || '',
      publishedDate: r.publishedDate || null,
      query: query,
    }));
  };

  const all = (await Promise.all(queries.map(q => fetchSearxng(q)))).flat();
  console.log(`Fetched ${all.length} items`);

  // Show sample
  all.slice(0, 3).forEach((it, i) => {
    console.log(`Item ${i+1}:`, { title: it.title.substring(0, 30), publishedDate: it.publishedDate });
  });
}

main();
