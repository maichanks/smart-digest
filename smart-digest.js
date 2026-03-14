#!/usr/bin/env node
/**
 * Smart Digest v2.0 - OpenClaw Plugin
 * Features: Dynamic interests, content filtering, grouped output, personalization.
 */

const fs = require('fs');
const yaml = require('yaml');
const axios = require('axios');
const crypto = require('crypto');

// ---------- Helpers ----------
const log = console.log;
const err = console.error;

function nowStr() {
  return new Date().toISOString();
}

// Load JSON file safely
function loadJSON(path, fallback = {}) {
  try {
    if (!fs.existsSync(path)) return fallback;
    return JSON.parse(fs.readFileSync(path, 'utf-8'));
  } catch (e) {
    return fallback;
  }
}

// Save JSON file
function saveJSON(path, data) {
  fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

// Compute age in days
function daysAgo(dateStr) {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Infinity;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// Simple language detection (Chinese check)
function containsChinese(str) {
  return /[\u4e00-\u9fa5]/.test(str || '');
}

// ---------- Main ----------
async function main() {
  try {
    log(`[SmartDigest] ${nowStr()} Starting...`);
    const configPath = process.env.CONFIG_PATH || 'config.yaml';
    const raw = fs.readFileSync(configPath, 'utf-8');
    const cfg = yaml.parse(raw).smartDigest;
    if (!cfg) throw new Error('Invalid config: missing smartDigest');

    // Prepare state file for feedback
    const statePath = process.env.STATE_PATH || 'state.json';
    const state = loadJSON(statePath, { feedback: [], interestWeights: {} });

    // Determine queries to use
    let queries = [];
    if (cfg.userInterests && Array.isArray(cfg.userInterests) && cfg.userInterests.length > 0) {
      queries = cfg.userInterests;
      log('[SmartDigest] Using userInterests:', queries);
    } else if (cfg.searchSources?.queries && cfg.searchSources.queries.length > 0) {
      queries = cfg.searchSources.queries;
      log('[SmartDigest] Using default searchSources.queries:', queries);
    } else {
      throw new Error('No search queries configured');
    }

    // ---------- 1) Fetch from SearXNG for each query ----------
    const fetchSearxng = async (query) => {
      if (!cfg.searchSources?.enabled) return [];
      try {
        const sx = cfg.searchSources;
        const params = new URLSearchParams({
          q: query,
          format: 'json',
          categories: sx.categories || 'general',
          // No language restriction - fetch all languages
        });
        const url = `${sx.searxngUrl}/search?${params}`;
        log(`[SearXNG] Query: ${query} -> ${url}`);
        const resp = await axios.get(url, { timeout: 10000 });
        const data = resp.data;
        if (!data.results || !Array.isArray(data.results)) return [];
        // Transform
        return data.results.slice(0, sx.maxResults || 10).map(r => ({
          title: r.title,
          link: r.url,
          content: r.content || '',
          source: `SearXNG: ${query}`,
          query: query,
          publishedDate: r.publishedDate || null,
          engine: r.engine,
        }));
      } catch (err) {
        err(`[SearXNG] Query "${query}" failed:`, err.message);
        return [];
      }
    };

    // Gather all items and tag with query (parallel)
    const fetchPromises = queries.map(q => fetchSearxng(q));
    const results = await Promise.all(fetchPromises);
    let allItems = results.flat();

    // ---------- 2) Optional: Fetch RSS (if network available) ----------
    if (cfg.rssSources && cfg.rssSources.length > 0 && allItems.length < 5) {
      log('[SmartDigest] SearXNG returned few items, attempting RSS...');
      const fetchRss = async (src) => {
        try {
          const resp = await axios.get(src.url, { timeout: 8000 });
          const body = resp.data;
          const items = [];
          const titleRe = /<title[^>]*>([^<]*)<\/title>/gi;
          const linkRe = /<link[^>]*>([^<]*)<\/link>/gi;
          let title, link, count = 0;
          while ((title = titleRe.exec(body)) && (link = linkRe.exec(body)) && count < 5) {
            items.push({
              title: title[1].trim(),
              link: link[1].trim(),
              content: '',
              source: src.name,
              query: src.name, // treat each RSS as its own "query"
              publishedDate: null,
              engine: 'rss',
            });
            count++;
          }
          return items;
        } catch (e) {
          err(`[RSS] ${src.name} failed:`, e.message);
          return [];
        }
      };
      for (const src of cfg.rssSources) {
        const rssItems = await fetchRss(src);
        allItems.push(...rssItems);
        if (allItems.length >= (cfg.format?.maxItems || 15) * 2) break;
      }
    }

    // ---------- 3) Deduplication ----------
    const seen = new Set();
    const unique = [];
    for (const item of allItems) {
      const h = crypto.createHash('md5').update(item.link).digest('hex');
      if (!seen.has(h)) {
        seen.add(h);
        unique.push(item);
      }
    }
    log(`[SmartDigest] Items after dedup: ${unique.length}`);

    // ---------- 4) Content Filtering ----------
    const filters = cfg.filters || {};
    let filtered = unique;
    // Filter by age
    if (filters.maxAgeDays) {
      const maxDays = parseInt(filters.maxAgeDays);
      filtered = filtered.filter(it => {
        const age = daysAgo(it.publishedDate);
        // If no publishedDate, keep it (don't filter out)
        return age === Infinity || age <= maxDays;
      });
      log(`[Filter] After age (<=${maxDays}d): ${filtered.length}`);
    }
    // Filter by allowed sources
    if (filters.allowedSources && filters.allowedSources.length > 0) {
      const allowed = new Set(filters.allowedSources.map(s => s.toLowerCase()));
      filtered = filtered.filter(it => allowed.has(it.link.split('/')[2]?.toLowerCase()));
      log(`[Filter] After allowed sources: ${filtered.length}`);
    }
    // Filter by blocked sources
    if (filters.blockedSources && filters.blockedSources.length > 0) {
      const blocked = new Set(filters.blockedSources.map(s => s.toLowerCase()));
      filtered = filtered.filter(it => !blocked.has(it.link.split('/')[2]?.toLowerCase()));
      log(`[Filter] After blocked sources: ${filtered.length}`);
    }
    // Language: prefer Chinese content if configured
    if (filters.languages && filters.languages.length > 0) {
      const langPref = filters.languages;
      // If we have both zh-CN and en, we might sort but not filter aggressively
      // For now, we don't filter out, but could assign scores later.
    }

    // If still empty, use mock
    let items = filtered;
    if (items.length === 0) {
      log('[SmartDigest] No items after filtering, using mock.');
      items = [
        { title: 'Mock News 1', link: 'https://example.com/1', content: 'Mock content 1', source: 'Mock', query: 'Mock' },
        { title: 'Mock News 2', link: 'https://example.com/1', content: 'Mock content 2', source: 'Mock', query: 'Mock' },
      ];
    } else {
      log(`[SmartDigest] Final items: ${items.length}`);
    }

    // ---------- 5) Summarization ----------
    const apiKey = cfg.llm?.openrouterApiKey || process.env.OPENROUTER_API_KEY;
    const model = cfg.llm?.model || 'anthropic/claude-3-haiku';
    const maxTokens = cfg.llm?.maxTokens || 150;
    const summaryLength = cfg.format?.summaryLength || 'brief';

    const summarize = async (text) => {
      if (!apiKey) {
        return (text || '').substring(0, 150) + '...';
      }
      try {
        const resp = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model,
            messages: [
              { role: 'system', content: 'You are a multilingual assistant. Summarize the content in Chinese (Simplified), keeping key points.' },
              { role: 'user', content: (text || '').slice(0, 2000) },
            ],
            max_tokens: maxTokens,
            temperature: cfg.llm?.temperature || 0.7,
          },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'HTTP-Referer': 'https://openclaw.ai',
              'X-Title': 'OpenClaw Smart Digest',
            },
            timeout: 12000,
          }
        );
        return resp.data.choices[0].message.content.trim();
      } catch (err) {
        err('[Summarizer]', err.response?.data || err.message);
        return (text || '').substring(0, 150) + '... (error)';
      }
    };

    // Process each item
    const processed = await Promise.all(items.map(async (it, idx) => {
      const summary = await summarize(it.content || it.title);
      // Apply personalization weight if enabled
      let weight = 1.0;
      if (cfg.personalization?.enabled && state.interestWeights[it.query]) {
        weight = state.interestWeights[it.query];
      }
      return { ...it, summary, weight, index: idx };
    }));

    // ---------- 6) Grouping ----------
    const grouping = cfg.format?.grouping || 'by-interest';
    let grouped = {};
    if (grouping === 'by-interest') {
      // Group by query (interest)
      for (const item of processed) {
        const q = item.query || 'General';
        if (!grouped[q]) grouped[q] = [];
        grouped[q].push(item);
      }
    } else {
      grouped['All'] = processed;
    }

    // Sort within groups: by weight (personalization) or index (original order)
    for (const q in grouped) {
      grouped[q].sort((a, b) => b.weight - a.weight);
      // Limit per group
      const max = cfg.format?.maxItems || 15;
      if (grouped[q].length > max) grouped[q] = grouped[q].slice(0, max);
    }

    // ---------- 7) Build Digest ----------
    const date = new Date().toLocaleDateString('zh-CN', { dateStyle: 'full' });
    let md = `## 📰 Smart Digest (${date})\n\n`;
    md += `Total items: ${processed.length}\n\n---\n\n`;

    for (const [group, items] of Object.entries(grouped)) {
      if (grouping === 'by-interest') {
        md += `### 🏷️ ${group}\n\n`;
      }
      for (const item of items) {
        md += `**${item.title}**\n`;
        if (cfg.format?.showSource) md += `*Source*: ${item.source}\n`;
        md += `*Summary*: ${item.summary}\n`;
        if (cfg.format?.showLink) md += `*Link*: ${item.link}\n\n`;
        md += `---\n\n`;
      }
    }

    md += `---\n\nPowered by OpenClaw Smart Digest | SearXNG + AI`;

    log('\n=== SMART DIGEST OUTPUT ===\n');
    log(md);
    log('=== END ===\n');

    // ---------- 8) Send ----------
    const channel = cfg.channel || 'feishu';
    const target = cfg.target || '';
    if (!target) {
      err('[Sender] No target configured. Set smartDigest.target in config.yaml');
      process.exit(1);
    }
    const safeMsg = md.replace(/"/g, '\\"').replace(/\n/g, ' ');
    const cmd = `openclaw message send --channel ${channel} --target "${target}" --message "${safeMsg}"`;
    log('[Sender] Executing...');
    const { exec } = require('child_process');
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        err('[Sender] Failed:', stderr || err.message);
        process.exit(1);
      } else {
        log('[Sender] Success:', stdout.trim());
        process.exit(0);
      }
    });

    // ---------- 9) Update feedback weights (learning) ----------
    // Placeholder: In future, listen for feedback messages to adjust state.interestWeights
    // Save state
    saveJSON(statePath, state);

  } catch (err) {
    err('Fatal:', err.message);
    process.exit(1);
  }
}

main();
