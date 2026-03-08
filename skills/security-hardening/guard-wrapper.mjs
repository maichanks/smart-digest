// Guard wrapper to protect and run an application
import RuntimeGuard from './scripts/guard.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runProtectedApp(appPath) {
  console.log(`🛡️  Starting Guard and loading: ${appPath}`);

  const guard = new RuntimeGuard({
    action: 'block',
    monitor: false,
    logLevel: 'info'
  });

  await guard.initialize(join(__dirname, 'rules'));

  // Protect current process
  guard.protect(process, 'main-app');

  // Dynamically load and execute the target application
  // Note: This uses import() which won't trigger require-based protections
  try {
    const appModule = await import(appPath);
    console.log('✅ Application loaded successfully');
  } catch (err) {
    console.error('❌ Application error:', err.message);
    if (err.message.includes('Security violation')) {
      console.log('✅ Guard successfully blocked a violation!');
      return 1; // Expected for blocked operations
    }
    throw err;
  }

  return 0;
}

// Get app path from command line
const appPath = process.argv[2];
if (!appPath) {
  console.error('Usage: node guard-wrapper.mjs <app-path>');
  process.exit(1);
}

runProtectedApp(appPath).then(exitCode => process.exit(exitCode)).catch(err => {
  console.error('Wrapper error:', err);
  process.exit(1);
});