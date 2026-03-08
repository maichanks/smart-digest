// Manual test to verify log file creation and permissions
import { mkdir, writeFile, chmod, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logsDir = join(__dirname, 'logs');
const logFile = join(logsDir, `security-${new Date().toISOString().split('T')[0]}.json`);

async function testLogProtection() {
  console.log('📝 Testing Log File Protection\n');

  try {
    // Create logs directory
    await mkdir(logsDir, { recursive: true });
    console.log('✅ Logs directory created/exists');

    // Write a test log entry
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      rule_id: 'TEST-001',
      description: 'Test log entry',
      file: 'test.js',
      line: 1,
      action: 'log'
    };

    await writeFile(logFile, JSON.stringify(logEntry) + '\n');
    console.log(`✅ Log file created: ${logFile}`);

    // Check and set permissions
    await chmod(logFile, 0o600);
    console.log('✅ Set log file permissions to 0o600');

    // Verify permissions
    const { stat } = await import('fs/promises');
    const stats = await stat(logFile);
    const perms = (stats.mode & 0o777).toString(8);
    console.log(`📊 Current permissions: 0o${perms}`);

    if (perms === '600') {
      console.log('✅ PASS: Log file has correct permissions (0o600)');
    } else {
      console.log(`❌ FAIL: Expected 0o600, got 0o${perms}`);
    }

    // Test log rotation or additional writes
    for (let i = 0; i < 3; i++) {
      await writeFile(logFile, JSON.stringify({ ...logEntry, seq: i }) + '\n', { flag: 'a' });
    }
    console.log('✅ Additional log entries written');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testLogProtection().catch(console.error);