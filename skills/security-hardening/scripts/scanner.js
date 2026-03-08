#!/usr/bin/env node

import { RuleEngine } from '../lib/engine.js';
import { Reporter } from '../lib/reporter.js';
import { readFile, mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..', '..');

class Scanner {
  constructor() {
    this.engine = new RuleEngine();
    this.reporter = new Reporter();
  }

  async run(args) {
    try {
      await this.engine.loadRules(join(__dirname, 'rules'));

      let result;
      if (args.file) {
        result = await this.engine.scanFile(args.file);
        const results = result ? [result] : [];
        console.log(this.reporter.formatResults(results, this.engine.stats));
      } else if (args.dir) {
        const results = await this.engine.scanDirectory(args.dir, {
          fileTypes: ['.js', '.mjs', '.cjs', '.ts', '.json', '.yaml', '.yml', '.sh']
        });
        console.log(this.reporter.formatResults(results, this.engine.stats));

        // Write JSON report if requested
        if (args.output) {
          const report = {
            scan_date: new Date().toISOString(),
            stats: this.engine.stats,
            results
          };
          await writeFile(args.output, JSON.stringify(report, null, 2));
          console.log(`📝 Report saved to: ${args.output}`);
        }
      } else if (args.test) {
        await this.runTests();
      } else {
        this.printHelp();
      }
    } catch (err) {
      console.error('❌ Error:', err.message);
      process.exit(1);
    }
  }

  async runTests() {
    console.log('🧪 Running scanner tests...\n');

    // Create test files
    const testDir = join(__dirname, 'test-data');
    await mkdir(testDir, { recursive: true });

    // Test 1: eval() detection
    const test1 = join(testDir, 'test-eval.js');
    await writeFile(test1, "eval('console.log(1)');");
    const result1 = await this.engine.scanFile(test1);
    console.assert(result1.violations.length > 0, 'Should detect eval()');

    // Test 2: No issues
    const test2 = join(testDir, 'test-clean.js');
    await writeFile(test2, "console.log('Hello');");
    const result2 = await this.engine.scanFile(test2);
    console.assert(result2.violations.length === 0, 'Should be clean');

    // Cleanup
    await rm(testDir, { recursive: true, force: true });

    console.log('✅ All tests passed!');
  }

  printHelp() {
    console.log(`
🔍 Security Hardening Scanner

Usage:
  node scripts/scanner.js [options]

Options:
  --file <path>          Scan a single file
  --dir <path>           Scan entire directory recursively
  --output <path>        Save JSON report to file
  --format <format>      Output format: text|json|compact (default: text)
  --test                 Run self-tests
  --help                 Show this help

Examples:
  node scripts/scanner.js --file app.js
  node scripts/scanner.js --dir skills/
  node scripts/scanner.js --dir . --format json --output scan-report.json

Rules loaded: ${this.engine.rules.length || 55}
    `);
  }
}

// Import additional functions
if (import.meta.url === `file://${process.argv[1]}`) {
  // Parse command line arguments
  const args = {};
  for (let i = 2; i < process.argv.length; i++) {
    switch (process.argv[i]) {
      case '--file':
        args.file = process.argv[++i];
        break;
      case '--dir':
        args.dir = process.argv[++i];
        break;
      case '--output':
        args.output = process.argv[++i];
        break;
      case '--format':
        args.format = process.argv[++i];
        break;
      case '--test':
        args.test = true;
        break;
      case '--help':
        args.help = true;
        break;
    }
  }
  const scanner = new Scanner();
  scanner.run(args).catch(console.error);
}
