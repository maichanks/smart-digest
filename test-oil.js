#!/usr/bin/env node
// Quick test: send oil-related test message
const { exec } = require('child_process');
const target = 'ou_336392c47a7171eca924e3caa0b284ff';
const channel = 'feishu';
const msg = `## 📰 Smart Digest (石油专题)\n\n时间：${new Date().toLocaleString()}\n\n这是关于石油的测试摘要。\n\n1. **国际油价动态**：布伦特原油价格本周上涨5%，主要受OPEC+减产消息推动。\n2. **新能源转型**：全球电动车销量增长，预计2030年石油需求达峰。\n3. **地缘政治**：中东局势影响原油供应，短期价格波动加剧。\n\n---\n\nPowered by OpenClaw Smart Digest`;
const safe = msg.replace(/"/g, '\\"').replace(/\n/g, ' ');
const cmd = `openclaw message send --channel ${channel} --target "${target}" --message "${safe}"`;
console.log('[Test] Sending oil digest...');
exec(cmd, (err, stdout, stderr) => {
  if (err) console.error('[Test] Failed:', stderr || err.message);
  else console.log('[Test] Success:', stdout);
});
