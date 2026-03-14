#!/usr/bin/env node
// Quick test of grouped output without long exec wait
const { exec } = require('child_process');
const cmd = `cd /home/admin/.openclaw/workspace/skills/smart-digest && timeout 8 node smart-digest.js 2>&1`;
exec(cmd, (err, stdout, stderr) => {
  if (err) {
    console.error('Run failed:', stderr || err.message);
  } else {
    console.log(stdout);
  }
});
