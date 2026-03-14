#!/usr/bin/env node
// Smart Digest v2 - Harness Engineering Edition (CommonJS)
const fs = require('fs');
const yaml = require('yaml');
const axios = require('axios');
const { exec } = require('child_process');

const LOG_PREFIX = '[SmartDigest v2]';
function log(msg) { console.log(`${LOG_PREFIX} ${msg}`); }

// Config
let cfg;
try {
  cfg = yaml.parse(fs.readFileSync('config.yaml', 'utf-8')).smartDigest;
} catch (e) {
  log('Config error: ' + e.message);
  process.exit(1);
}

// Data Sources
const DataSources = {
  async fetchFromSearxng(queries) {
    const baseUrl = cfg.searchSources?.searxngUrl || 'http://localhost:8080';
    const maxPerQuery = cfg.searchSources?.maxResults || 8;
    const results = [];
    log(`SearXNG: ${queries.length} queries`);

    for (let i = 0; i < queries.length; i++) {
      const q = queries[i];
      try {
        const params = new URLSearchParams({ q, format: 'json', categories: 'general' });
        const resp = await axios.get(`${baseUrl}/search?${params}`, { timeout: 10000 });
        const items = (resp.data.results || []).slice(0, maxPerQuery);
        const blocked = ['zhihu.com', 'zhuanlan.zhihu.com', 'baike.baidu.com', 'iciba.com', 'dictionary.cambridge.org'];
        const filtered = items.filter(r => {
          const host = (r.url || '').split('/')[2]?.toLowerCase() || '';
          return !blocked.some(b => host.includes(b));
        }).map(r => ({ title: r.title, link: r.url, content: r.content || '', source: `SearXNG: ${q}`, query: q }));
        results.push(...filtered);
        log(`  "${q}": +${filtered.length}`);
      } catch (e) {
        log(`  "${q}" error: ${e.message}`);
      }
      if (i < queries.length - 1) await new Promise(r => setTimeout(r, 500));
    }
    return results;
  },

  async fetchFromLocalJson() {
    const path = 'news.json';
    if (!fs.existsSync(path)) return [];
    try {
      const data = JSON.parse(fs.readFileSync(path, 'utf-8'));
      log(`Local JSON: ${data.length} items`);
      return data;
    } catch (e) {
      log(`Local JSON error: ${e.message}`);
      return [];
    }
  },

  getMockData() {
    const mock = [
      { title: '石油市场动态', link: 'https://example.com/oil-1', content: 'OPEC+讨论新的减产方案以稳定油价。', source: 'Mock', query: 'Mock' },
      { title: '能源转型加速', link: 'https://example.com/energy-1', content: '全球电动车销量增长影响石油需求。', source: 'Mock', query: 'Mock' },
    ];
    log(`Mock: ${mock.length} items`);
    return mock;
  },
};

// Send with robust timeout
function sendMessage(content, attempt = 1) {
  const target = cfg.target || 'ou_336392c47a7171eca924e3caa0b284ff';
  const channel = cfg.channel || 'feishu';
  const safeMsg = content.replace(/"/g, '\\"').replace(/\n/g, ' ');
  const cmd = `openclaw message send --channel ${channel} --target "${target}" --message "${safeMsg}"`;

  return new Promise((resolve, reject) => {
    log(`Sending attempt ${attempt}...`);
    const child = exec(cmd, { timeout: 15000 }, (err, stdout, stderr) => {
      if (err) {
        log(`Send failed: ${stderr || err.message}`);
        return reject(err);
      }
      log('Send OK: ' + (stdout || '').trim().split('\n').pop());
      resolve();
    });

    // Hard timeout (18s)
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Hard timeout'));
    }, 18000);

    child.on('exit', () => clearTimeout(timer));
  });
}

async function sendWithRetry(content, maxAttempts) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await sendMessage(content, i);
      log('Completed. Exiting.');
      process.exit(0);
    } catch (e) {
      log(`Attempt ${i} failed`);
      if (i === maxAttempts) {
        log('All attempts failed. Exiting with error.');
        process.exit(1);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// Main Pipeline
(async () => {
  try {
    log('Starting...');
    const queries = (cfg.userInterests || ['石油']).filter(Boolean);
    log('Queries:', queries);

    // Fetch
    let items = await DataSources.fetchFromSearxng(queries);
    if (items.length === 0) {
      log('SearXNG empty, trying local JSON...');
      items = await DataSources.fetchFromLocalJson();
    }
    if (items.length === 0) {
      log('Fallback to mock');
      items = DataSources.getMockData();
    }

    // Dedup
    const unique = Array.from(new Map(items.map(it => [it.link, it])).values());
    log(`Unique: ${unique.length}/${items.length}`);

    if (unique.length === 0) {
      log('No content after dedup');
      await sendMessage('Smart Digest: 今日无有效内容。');
      return;
    }

    // Summarize
    const apiKey = cfg.llm?.openrouterApiKey || process.env.OPENROUTER_API_KEY;
    let summarized = unique;
    if (apiKey) {
      log('Summarizing via OpenRouter...');
      summarized = await Promise.all(unique.map(async it => {
        try {
          const resp = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
            model: cfg.llm?.model || 'anthropic/claude-3-haiku',
            messages: [
              { role: 'system', content: '用1-2句中文总结。' },
              { role: 'user', content: (it.content || it.title).slice(0, 1500) }
            ],
            max_tokens: 120,
          }, {
            headers: { Authorization: `Bearer ${apiKey}`, 'HTTP-Referer': 'https://openclaw.ai', 'X-Title': 'OpenClaw Smart Digest' },
            timeout: 10000,
          });
          const summary = resp.data.choices?.[0]?.message?.content?.trim();
          return { ...it, summary: summary || (it.content || it.title).slice(0, 120) + '...' };
        } catch (e) {
          return { ...it, summary: (it.content || it.title).slice(0, 120) + '...' };
        }
      }));
    } else {
      log('No API key, using raw snippets');
      summarized = unique.map(it => ({ ...it, summary: (it.content || it.title).slice(0, 120) + '...' }));
    }

    // Group
    const groups = summarized.reduce((acc, it) => {
      const q = it.query || '其它';
      if (!acc[q]) acc[q] = [];
      acc[q].push(it);
      return acc;
    }, {});

    // Build
    const date = new Date().toLocaleDateString('zh-CN', { dateStyle: 'full' });
    let md = `## 📰 Smart Digest (${date})\n\n${summarized.length} 条资讯\n\n---\n\n`;
    for (const [g, items] of Object.entries(groups)) {
      md += `### 🔍 ${g}\n\n`;
      for (const it of items.slice(0, 6)) {
        md += `**${it.title}**\n📝 ${it.summary}\n🔗 ${it.link}\n\n`;
      }
      md += `\n`;
    }
    md += `---\n🕒 ${new Date().toLocaleString('zh-CN')}\n🤖 Powered by OpenClaw Smart Digest\n`;

    log(`Built: ${md.length} chars`);
    await sendWithRetry(md, 3);

  } catch (err) {
    log('Fatal: ' + err);
    process.exit(1);
  }
})();
