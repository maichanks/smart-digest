#!/usr/bin/env node
// Debug Smart Digest step by step
const fs = require('fs');
const yaml = require('yaml');
const axios = require('axios');
const { exec } = require('child_process');

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function testRss(url, name) {
  log(`Testing RSS: ${name} - ${url}`);
  try {
    const resp = await axios.get(url, { timeout: 10000 });
    log(`  Status: ${resp.status}, Length: ${resp.data.length}`);
    // Simple check for <item> or <entry>
    if (resp.data.includes('<item>') || resp.data.includes('<entry>')) {
      log(`  RSS format detected`);
      return true;
    } else {
      log(`  No RSS items found in content`);
      return false;
    }
  } catch (err) {
    log(`  Error: ${err.message}`);
    return false;
  }
}

async function main() {
  log('=== Smart Digest Debug Start ===');
  
  // Load config
  const configPath = 'config.yaml';
  if (!fs.existsSync(configPath)) {
    log(`ERROR: Config file not found: ${configPath}`);
    return;
  }
  const content = fs.readFileSync(configPath, 'utf-8');
  const parsed = yaml.parse(content);
  const cfg = parsed.smartDigest;
  
  if (!cfg || !cfg.rssSources) {
    log('ERROR: Invalid config, missing smartDigest.rssSources');
    return;
  }
  
  log(`Loaded config: ${cfg.rssSources.length} RSS sources`);
  log(`Channel: ${cfg.channel}, Target: ${cfg.target || 'NOT SET'}`);
  log(`OpenRouter API: ${cfg.llm?.openrouterApiKey ? 'SET' : 'NOT SET'}`);
  
  // Test each RSS source
  for (const src of cfg.rssSources) {
    const ok = await testRss(src.url, src.name);
    if (!ok) {
      log(`WARNING: RSS source failed: ${src.name} (${src.url})`);
    }
  }
  
  // Check if openclaw message send is available
  log('Testing openclaw message send...');
  const testMsg = 'Smart Digest debug test';
  const cmd = `openclaw message send --channel ${cfg.channel || 'feishu'} --target "${cfg.target || ''}" --message "${testMsg}" 2>&1`;
  log(`Running: ${cmd}`);
  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      log(`Message send failed: ${stderr || err.message}`);
    } else {
      log(`Message send output: ${stdout}`);
    }
    
    log('=== Debug End ===');
    log('Please forward this output for analysis.');
  });
}

main();
