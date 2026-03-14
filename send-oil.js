#!/usr/bin/env node
// Send oil-related news digest (optimized, non-blocking)
const fs = require('fs');
const yaml = require('yaml');
const axios = require('axios');
const { exec } = require('child_process');

(async () => {
  const cfg = yaml.parse(fs.readFileSync('config.yaml', 'utf-8')).smartDigest;
  const queries = ['latest news', 'oil price', '能源新闻', '原油']; // mixed Chinese/English
  const target = cfg.target || 'ou_336392c47a7171eca924e3caa0b284ff';
  const channel = cfg.channel || 'feishu';
  const apiKey = cfg.llm?.openrouterApiKey || process.env.OPENROUTER_API_KEY;
  const model = cfg.llm?.model || 'anthropic/claude-3-haiku';

  console.log('[OilDigest] Starting with queries:', queries);

  // Serial fetch
  const fetch = async (q) => {
    try {
      const params = new URLSearchParams({ q, format: 'json', categories: 'general' });
      const resp = await axios.get(`http://localhost:8080/search?${params}`, { timeout: 10000 });
      return (resp.data.results || []).slice(0, 8).map(r => ({ title: r.title, link: r.url, content: r.content || '', source: r.engine || 'SearXNG', query: q }));
    } catch (e) {
      console.error('[OilDigest] Fetch error:', q, e.message);
      return [];
    }
  };

  const all = [];
  for (const q of queries) {
    const res = await fetch(q);
    all.push(...res);
    await new Promise(r => setTimeout(r, 400)); // rate limit friendly
  }
  console.log('[OilDigest] Total items:', all.length);

  // Dedup by link
  const unique = Array.from(new Map(all.map(it => [it.link, it])).values());
  console.log('[OilDigest] After dedup:', unique.length);

  if (unique.length === 0) {
    console.log('[OilDigest] No items, sending mock alert...');
    exec(`openclaw message send --channel ${channel} --target "${target}" --message "Smart Digest: 未找到石油相关新闻，请稍后重试。"`, (err, stdout, stderr) => {
      if (err) console.error('[Sender] Failed:', stderr || err.message);
      else console.log('[Sender] Success:', stdout.trim());
      process.exit(err ? 1 : 0);
    });
    return;
  }

  // Summarize
  const summarize = async (text) => {
    if (!apiKey) return (text || '').substring(0, 120) + '...';
    try {
      const resp = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model,
        messages: [
          { role: 'system', content: '用1-2句中文总结以下新闻内容，突出重点。' },
          { role: 'user', content: (text || '').slice(0, 1500) }
        ],
        max_tokens: 120,
      }, { headers: { Authorization: `Bearer ${apiKey}`, 'HTTP-Referer': 'https://openclaw.ai', 'X-Title': 'OpenClaw Smart Digest' }, timeout: 10000 });
      return resp.data.choices[0].message.content.trim();
    } catch (e) {
      console.error('[OilDigest] Summarize error:', e.message);
      return (text || '').substring(0, 120) + '...';
    }
  };

  const summarized = await Promise.all(unique.map(async it => ({ ...it, summary: await summarize(it.content || it.title) })));

  // Group by query
  const groups = summarized.reduce((acc, it) => {
    const q = it.query || '其它';
    if (!acc[q]) acc[q] = [];
    acc[q].push(it);
    return acc;
  }, {});

  // Build message
  const date = new Date().toLocaleDateString('zh-CN', { dateStyle: 'full' });
  let md = `## 📰 Smart Digest (${date})\n\n发现 ${summarized.length} 条石油相关资讯\n\n---\n\n`;
  for (const [group, items] of Object.entries(groups)) {
    md += `### 🔍 ${group}\n\n`;
    for (const it of items.slice(0, 6)) {
      md += `**${it.title}**\n📝 摘要：${it.summary}\n🔗 [阅读原文](${it.link})\n\n`;
    }
    md += `\n`;
  }
  md += `---\n\n🤖 Powered by OpenClaw Smart Digest | SearXNG + AI`;

  console.log('\n=== MESSAGE READY ===\n' + md + '\n=== END ===\n');

  // Send with quoting to handle special chars
  const safeMsg = JSON.stringify(md);
  exec(`openclaw message send --channel ${channel} --target "${target}" --message ${safeMsg}`, (err, stdout, stderr) => {
    if (err) console.error('[Sender] Failed:', stderr || err.message);
    else console.log('[Sender] Success:', stdout.trim());
    process.exit(err ? 1 : 0);
  });
})();
