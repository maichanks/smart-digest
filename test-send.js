#!/usr/bin/env node
// Test message send via openclaw CLI
const { exec } = require('child_process');
const testMsg = `## 📰 Smart Digest (Test)\n\nTotal items: 0\n\n---\n\n这是测试消息，验证配置是否正确。\n\n---`;
const safeMsg = testMsg.replace(/"/g, '\\"').replace(/\n/g, ' ');
const cmd = `openclaw message send --channel feishu --target "ou_336392c47a7171eca924e3caa0b284ff" --message "${safeMsg}"`;
console.log('[Test] Running:', cmd);
exec(cmd, (err, stdout, stderr) => {
  if (err) {
    console.error('[Test] Failed:', err.message);
    console.error('[Test] stderr:', stderr);
    process.exit(1);
  } else {
    console.log('[Test] Success:', stdout);
    process.exit(0);
  }
});
