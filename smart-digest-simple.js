#!/usr/bin/env node
// Smart Digest Simple - No filtering, just SearXNG + send
const fs = require('fs');
const yaml = require('yaml');
const axios = require('axios');

async function main() {
  const cfg = yaml.parse(fs.readFileSync('config.yaml', 'utf-8')).smartDigest;
  const queries = (cfg.userInterests && cfg.userInterests.length > 0) ? cfg.userInterests : ['latest news', 'breaking news', 'oil news'];
  const target = cfg.target || 'ou_336392c47a7171eca924e3caa0b284ff';
  const channel = cfg.channel || 'feishu';
  const apiKey = cfg.llm?.openrouterApiKey || process.env.OPENROUTER_API_KEY;
  const model = cfg.llm?.model || 'anthropic/claude-3-haiku';

  console.log('[Simple] Queries:', queries);

  // Fetch from SearXNG (serial with error tolerance)
  const fetch = async (q) => {
    try {
      const params = new URLSearchParams({ q, format: 'json', categories: 'general' });
      const resp = await axios.get(`http://localhost:8080/search?${params}`, { timeout: 12000 });
      return (resp.data.results || []).slice(0, 10).map(r => ({ title: r.title, link: r.url, content: r.content || '', source: `SearXNG: ${q}`, query: q }));
    } catch (e) {
      console.error('[Simple] Fetch error:', e.message);
      return [];
    }
  };
  const resultsPerQuery = [];
  for (const q of queries) {
    const res = await fetch(q);
    resultsPerQuery.push(res);
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }
  const all = resultsPerQuery.flat();
  console.log('[Simple] Fetched total:', all.length);

  if (all.length === 0) {
    console.log('[Simple] No results, using mock...');
    // fallback mock
  }

  // Summarize (no filtering)
  const summarize = async (text) => {
    if (!apiKey) return (text || '').substring(0, 150) + '...';
    try {
      const resp = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model,
        messages: [{ role: 'system', content: 'Summarize in 1-2 sentences in Chinese.' }, { role: 'user', content: (text || '').slice(0, 2000) }],
        max_tokens: 150,
      }, { headers: { Authorization: `Bearer ${apiKey}`, 'HTTP-Referer': 'https://openclaw.ai', 'X-Title': 'OpenClaw Smart Digest' }, timeout: 10000 });
      return resp.data.choices[0].message.content.trim();
    } catch (e) {
      console.error('[Simple] Summarize error:', e.message);
      return (text || '').substring(0, 150) + '...';
    }
  };

  const summarized = await Promise.all(all.map(async (it) => ({ ...it, summary: await summarize(it.content || it.title) })));

  // Group by query
  const groups = summarized.reduce((acc, it) => {
    const q = it.query || 'General';
    if (!acc[q]) acc[q] = [];
    acc[q].push(it);
    return acc;
  }, {});

  // Build digest
  const date = new Date().toLocaleDateString('zh-CN', { dateStyle: 'full' });
  let md = `## 📰 Smart Digest (${date})\n\nTotal items: ${summarized.length}\n\n---\n\n`;
  for (const [group, items] of Object.entries(groups)) {
    md += `### 🏷️ ${group}\n\n`;
    for (const it of items) {
      md += `**${it.title}**\n*Source*: ${it.source}\n*Summary*: ${it.summary}\n*Link*: ${it.link}\n\n---\n\n`;
    }
  }
  md += '---\n\nPowered by OpenClaw Smart Digest | SearXNG';

  console.log('\n=== OUTPUT ===\n' + md + '\n=== END ===\n');

  // Send
  const safeMsg = md.replace(/"/g, '\\"').replace(/\n/g, ' ');
  const { exec } = require('child_process');
  exec(`openclaw message send --channel ${channel} --target "${target}" --message "${safeMsg}"`, (err, stdout, stderr) => {
    if (err) console.error('[Sender] Failed:', stderr || err.message);
    else console.log('[Sender] Success:', stdout.trim());
    process.exit(err ? 1 : 0);
  });
}

main();
