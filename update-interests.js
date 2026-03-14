#!/usr/bin/env node
/**
 * Smart Digest - Update user interests dynamically
 * Usage:
 *   node update-interests.js add "人工智能"
 *   node update-interests.js set "科技,财经,体育"
 *   node update-interests.js list
 *   node update-interests.js clear
 */

const fs = require('fs');
const yaml = require('yaml');

const configPath = 'config.yaml';
const statePath = 'interests-state.json';

function loadConfig() {
  const raw = fs.readFileSync(configPath, 'utf-8');
  return yaml.parse(raw);
}

function saveConfig(cfg) {
  fs.writeFileSync(configPath, yaml.stringify(cfg, { lineWidth: -1, indent: 2 }), 'utf-8');
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
  } catch (e) {
    return { userInterests: [], history: [] };
  }
}

function saveState(st) {
  fs.writeFileSync(statePath, JSON.stringify(st, null, 2), 'utf-8');
}

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.log(`
Usage:
  node update-interests.js list                - Show current interests
  node update-interests.js add "keyword"      - Add a keyword
  node update-interests.js set "a,b,c"       - Replace all keywords
  node update-interests.js clear             - Clear all interests
    `);
    process.exit(0);
  }

  const cmd = args[0];
  const cfg = loadConfig();
  const st = loadState();

  // Ensure smartDigest section exists
  if (!cfg.smartDigest) cfg.smartDigest = {};
  if (!cfg.smartDigest.userInterests) cfg.smartDigest.userInterests = [];

  switch (cmd) {
    case 'list':
      console.log('Current interests:', cfg.smartDigest.userInterests);
      console.log('State weights:', st.interestWeights || '{}');
      break;

    case 'add':
      if (!args[1]) {
        console.error('Missing keyword');
        process.exit(1);
      }
      const keyword = args[1].trim();
      if (!cfg.smartDigest.userInterests.includes(keyword)) {
        cfg.smartDigest.userInterests.push(keyword);
        saveConfig(cfg);
        console.log(`Added: ${keyword}`);
      } else {
        console.log(`Already exists: ${keyword}`);
      }
      break;

    case 'set':
      if (!args[1]) {
        console.error('Missing comma-separated keywords');
        process.exit(1);
      }
      const keywords = args[1].split(',').map(k => k.trim()).filter(k => k);
      cfg.smartDigest.userInterests = keywords;
      // Reset weights for these interests? Keep existing for persistence
      saveConfig(cfg);
      console.log('Interests set to:', keywords);
      break;

    case 'clear':
      cfg.smartDigest.userInterests = [];
      saveConfig(cfg);
      console.log('Cleared all interests');
      break;

    default:
      console.error(`Unknown command: ${cmd}`);
      process.exit(1);
  }
}

main();
