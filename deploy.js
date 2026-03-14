#!/usr/bin/env node
// Smart Digest - One-click deployment script
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT = 'smart-digest';
const REPO_URL = 'https://github.com/maichanks/smart-digest.git';
const INSTALL_DIR = path.join(process.env.HOME || '/home/admin', '.openclaw', 'workspace', 'skills', PROJECT);

console.log(`🚀 Deploying ${PROJECT}...`);

// 1. Clone
if (!fs.existsSync(INSTALL_DIR)) {
  console.log('📥 Cloning repository...');
  execSync(`git clone ${REPO_URL} "${INSTALL_DIR}"`, { stdio: 'inherit' });
} else {
  console.log('✅ Already exists, skipping clone');
}

// 2. Install dependencies
console.log('📦 Installing dependencies (npm install)...');
try {
  execSync('npm install', { cwd: INSTALL_DIR, stdio: 'inherit' });
} catch (e) {
  console.error('❌ npm install failed, try pnpm?');
  try {
    execSync('pnpm install', { cwd: INSTALL_DIR, stdio: 'inherit' });
  } catch (e2) {
    console.error('❌ Dependency installation failed:', e2.message);
    process.exit(1);
  }
}

// 3. Copy config example
const configExample = path.join(INSTALL_DIR, 'config.yaml.example');
const configTarget = path.join(INSTALL_DIR, 'config.yaml');
if (fs.existsSync(configExample) && !fs.existsSync(configTarget)) {
  console.log('🔧 Creating config.yaml from example...');
  fs.copyFileSync(configExample, configTarget);
  console.log('⚠️ ACTION REQUIRED: Please edit config.yaml:');
  console.log('   - Set target: your open_id (e.g., "ou_xxxx")');
  console.log('   - Adjust userInterests: topics you care about (e.g., ["石油","科技"]');
  console.log('   - Optionally set OPENROUTER_API_KEY for AI summaries');
} else {
  console.log('✅ Config already exists');
}

// 4. Verify installation
console.log('\n✅ Deployment complete!');
console.log('\n📝 Next steps:');
console.log(`   1. Review config: ${configTarget}`);
console.log(`   2. Test manually: node ${path.join(INSTALL_DIR, 'preview.js')} (preview)`);
console.log(`      or: node ${path.join(INSTALL_DIR, 'smart-digest-v2.js')} (full run)`);
console.log(`   3. Add to cron (optional):`);
console.log(`      openclaw cron add --name "SmartDigest" --cron "0 21 * * *" --session isolated --message "node ${ path.join(INSTALL_DIR, 'smart-digest-v2.js') }"`);
