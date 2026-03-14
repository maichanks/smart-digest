#!/usr/bin/env node
// Quick test: send a simple message without RSS
const { exec } = require('child_process');
const target = 'ou_336392c47a7171eca924e3caa0b284ff';
const channel = 'feishu';
const msg = `## 📰 Smart Digest (Test)\n\nTime: ${new Date().toLocaleString()}\n\nThis is a test message to verify delivery. RSS fetch skipped for debugging.`;
const safe = msg.replace(/"/g, '\\"').replace(/\n/g, ' ');
const cmd = `openclaw message send --channel ${channel} --target "${target}" --message "${safe}"`;
console.log('[Debug] Running:', cmd);
exec(cmd, (err, stdout, stderr) => {
  if (err) {
    console.error('[Debug] Failed:', stderr || err.message);
    process.exit(1);
  } else {
    console.log('[Debug] Success:', stdout);
    process.exit(0);
  }
});
