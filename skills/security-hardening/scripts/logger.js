import { readFile, writeFile, appendFile, mkdir, chmod, unlink, rename } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..', '..');

export class Logger {
  constructor(options = {}) {
    this.options = {
      level: options.level || 'info', // error|warn|info|debug
      logFile: options.logFile || join(__dirname, 'logs', `security-${new Date().toISOString().split('T')[0]}.json`),
      maxSize: options.maxSize || 104857600, // 100 MB
      rotate: options.rotate !== false,
      format: options.format || 'json', // json|text
      secure: options.secure !== false, // enable file permissions
      remoteForward: options.remoteForward || null // { url, auth }
    };

    this.logCount = 0;
  }

  async log(entry) {
    try {
      await this.ensureLogDir();

      // Filter by level
      if (!this.shouldLog(entry.level)) return;

      // Add timestamp if not present
      if (!entry.timestamp) {
        entry.timestamp = new Date().toISOString();
      }

      // Write based on format
      if (this.options.format === 'json') {
        await this.writeJson(entry);
      } else {
        await this.writeText(entry);
      }

      this.logCount++;

      // Check rotation
      if (this.options.rotate && this.logCount % 1000 === 0) {
        await this.checkRotation();
      }
    } catch (err) {
      console.error('Logger error:', err.message);
      // Fallback to console
      console.log('LOG:', JSON.stringify(entry));
    }
  }

  async ensureLogDir() {
    const logDir = dirname(this.options.logFile);
    try {
      await mkdir(logDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }

  shouldLog(entryLevel) {
    const levels = ['error', 'warn', 'info', 'debug'];
    const entryIdx = levels.indexOf(entryLevel);
    const currentIdx = levels.indexOf(this.options.level);

    return entryIdx >= currentIdx;
  }

  async writeJson(entry) {
    const line = JSON.stringify(entry) + '\n';
    // Write to temp file then rename for atomicity
    const tempFile = this.options.logFile + '.tmp';
    await appendFile(tempFile, line);
    await rename(tempFile, this.options.logFile);
    // Set secure permissions (read/write for owner only)
    if (this.options.secure) {
      await chmod(this.options.logFile, 0o600);
    }
    // Remote forward if configured
    if (this.options.remoteForward) {
      await this.forwardRemote(entry);
    }
  }

  async writeText(entry) {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = this.colorize(entry.level, entry.level.toUpperCase());
    const message = `[${timestamp}] ${level} ${entry.message || entry.description || ''}\n`;

    await appendFile(this.options.logFile, message);

    if (entry.suggestion) {
      await appendFile(this.options.logFile, `   💡 ${entry.suggestion}\n`);
    }
  }

  colorize(level, text) {
    const colors = {
      error: '\x1b[31m',  // red
      warn: '\x1b[33m',   // yellow
      info: '\x1b[36m',   // cyan
      debug: '\x1b[90m'   // gray
    };
    const reset = '\x1b[0m';
    return colors[level] ? `${colors[level]}${text}${reset}` : text;
  }

  async checkRotation() {
    try {
      const stats = await this.getStats();
      if (stats.size > this.options.maxSize) {
        await this.rotate();
      }
    } catch (err) {
      console.warn('Rotation check failed:', err.message);
    }
  }

  async getStats() {
    try {
      const { stat } = await import('fs/promises');
      const stats = await stat(this.options.logFile);
      return { size: stats.size };
    } catch {
      return { size: 0 };
    }
  }

  async rotate() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `${this.options.logFile}.${timestamp}.bak`;

    try {
      // Rename current log
      await this.rename(this.options.logFile, backupFile);

      // Start fresh
      this.logCount = 0;
      console.log(`📦 Log rotated: ${backupFile}`);
    } catch (err) {
      console.error('Rotation failed:', err.message);
    }
  }

  async query(options = {}) {
    // Read and parse logs
    try {
      const content = await readFile(this.options.logFile, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      let entries = lines.map(line => JSON.parse(line));

      // Filter by level
      if (options.level) {
        entries = entries.filter(e => e.level === options.level);
      }

      // Filter by rule
      if (options.rule) {
        entries = entries.filter(e => e.rule_id === options.rule);
      }

      // Filter by date range
      if (options.since) {
        const since = new Date(options.since);
        entries = entries.filter(e => new Date(e.timestamp) >= since);
      }

      // Limit results
      if (options.limit) {
        entries = entries.slice(-options.limit);
      }

      return entries;
    } catch (err) {
      console.error('Query failed:', err.message);
      return [];
    }
  }

  tail(options = {}) {
    // Simpler async generator for tailing logs
    return this.tailLogs(options);
  }

  async *tailLogs(options = {}) {
    const lastSize = options.lastSize || 0;

    // Get current file size
    try {
      const { stat } = await import('fs/promises');
      const stats = await stat(this.options.logFile);
      const currentSize = stats.size;

      if (currentSize <= lastSize) {
        return;
      }

      // Read new content
      const content = await readFile(this.options.logFile, 'utf-8');
      const lines = content.split('\n');

      // Skip already read lines
      const startLine = this.estimateLinePosition(content, lastSize);

      for (let i = startLine; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          try {
            yield JSON.parse(line);
          } catch {
            // Skip malformed lines
          }
        }
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.error('Tail error:', err.message);
      }
    }
  }

  estimateLinePosition(content, byteOffset) {
    // Crude estimation: count newlines up to byteOffset
    let count = 0;
    let bytes = 0;
    for (let i = 0; i < content.length && bytes < byteOffset; i++) {
      if (content[i] === '\n') count++;
      bytes++;
    }
    return count;
  }

  async forwardRemote(entry) {
    if (!this.options.remoteForward) return;
    const { url, auth } = this.options.remoteForward;
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(auth && { 'Authorization': `Bearer ${auth}` })
        },
        body: JSON.stringify(entry)
      });
    } catch (err) {
      // Silent fail to avoid blocking main flow
      if (this.options.level === 'debug') {
        console.warn('Remote log forward failed:', err.message);
      }
    }
  }
}

export default Logger;
