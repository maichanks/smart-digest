#!/usr/bin/env node
// Smart Digest v2 - Preview mode (no send)
const fs = require('fs');
const yaml = require('yaml');
const axios = require('axios');

const cfg = yaml.parse(fs.readFileSync('config.yaml', 'utf-8')).smartDigest;
const queries = ['oil news', 'energy news', 'latest news', '原油价格', '石油'];

async function main() {
  console.log('[Preview] Queries:', queries);

  // Fetch from SearXNG (serial)
  const baseUrl = cfg.searchSources?.searxngUrl || 'http://localhost:8080';
  const items = [];
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    try {
      const params = new URLSearchParams({ q, format: 'json', categories: 'general' });
      const resp = await axios.get(`${baseUrl}/search?${params}`, { timeout: 10000 });
      const results = (resp.data.results || []).slice(0, 8);
      const blocked = ['zhihu.com', 'zhuanlan.zhihu.com', 'baike.baidu.com', 'iciba.com', 'dictionary.cambridge.org'];
      const filtered = results.filter(r => !blocked.some(b => (r.url || '').includes(b)));
      items.push(...filtered.map(r => ({ title: r.title, link: r.url, content: r.content || '', query: q })));
      console.log(`  ${q}: +${filtered.length}`);
    } catch (e) {
      console.error(`  ${q}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`[Preview] Total items: ${items.length}`);

  if (items.length === 0) {
    console.log('No results found.');
    return;
  }

  // Dedup
  const unique = Array.from(new Map(items.map(it => [it.link, it])).values());
  console.log(`[Preview] After dedup: ${unique.length}`);

  // Summarize (snippet if no API key)
  const apiKey = cfg.llm?.openrouterApiKey || process.env.OPENROUTER_API_KEY;
  const summarized = await Promise.all(unique.map(async it => {
    if (!apiKey) return { ...it, summary: (it.content || it.title).slice(0, 120) + '...' };
    try {
      const resp = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: cfg.llm?.model || 'anthropic/claude-3-haiku',
        messages: [{ role: 'system', content: '用1-2句中文总结。' }, { role: 'user', content: (it.content || it.title).slice(0, 1500) }],
        max_tokens: 120,
      }, { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 8000 });
      const summary = resp.data.choices?.[0]?.message?.content?.trim();
      return { ...it, summary: summary || (it.content || it.title).slice(0, 120) + '...' };
    } catch (e) {
      return { ...it, summary: (it.content || it.title).slice(0, 120) + '...' };
    }
  }));

  // Group and print
  const groups = summarized.reduce((acc, it) => {
    const q = it.query || '其它';
    if (!acc[q]) acc[q] = [];
    acc[q].push(it);
    return acc;
  }, {});

  console.log('\n=== DIGEST PREVIEW ===\n');
  const date = new Date().toLocaleDateString('zh-CN', { dateStyle: 'full' });
  console.log(`## 📰 Smart Digest (${date})\n`);
  console.log(`共整理 ${summarized.length} 条资讯\n`);
  console.log('---\n');

  for (const [group, items] of Object.entries(groups)) {
    console.log(`### 🔍 ${group}\n`);
    for (const it of items.slice(0, 6)) {
      console.log(`**${it.title}**`);
      console.log(`📝 ${it.summary}`);
      console.log(`🔗 ${it.link}\n`);
    }
    console.log('');
  }
  console.log('---');
  console.log(`🕒 ${new Date().toLocaleString('zh-CN')}`);
  console.log('🤖 Powered by OpenClaw Smart Digest | SearXNG + OpenRouter');
  console.log('\n=== END ===');
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
