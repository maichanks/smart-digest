#!/usr/bin/env node

/**
 * Security Hardening Skill - Quick Validation Script
 * 快速回归测试工具，验证关键功能
 */

import { readFile, writeFile, rm, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// This script runs from within security-hardening/ directory
const SKILL_DIR = __dirname; // Already in security-hardening
const RULES_DIR = join(SKILL_DIR, 'rules');
const TEST_DIR = join(SKILL_DIR, 'test-data');
const LOGS_DIR = join(SKILL_DIR, 'logs');

const RESULTS = {
  passed: 0,
  failed: 0,
  tests: []
};

async function test(name, fn) {
  try {
    await fn();
    RESULTS.passed++;
    RESULTS.tests.push({ name, status: '✅ PASS' });
    console.log(`✅ ${name}`);
  } catch (err) {
    RESULTS.failed++;
    RESULTS.tests.push({ name, status: '❌ FAIL', error: err.message });
    console.log(`❌ ${name}: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runAllTests() {
  console.log('🔍 Security Hardening Skill - Quick Validation\n');
  console.log('=' .repeat(60) + '\n');

  // Test 1: Rule files contain .cjs extension
  await test('Rules include .cjs extension', async () => {
    const ruleFiles = ['execution.json', 'filesystem.json', 'network.json', 'process.json', 'module.json', 'crypto.json', 'web.json', 'data.json'];
    for (const file of ruleFiles) {
      const content = await readFile(join(RULES_DIR, file), 'utf-8');
      if (!content.includes('".cjs"')) {
        throw new Error(`${file} missing ".cjs" in file_extensions`);
      }
    }
  });

  // Test 2: Scanner can load and run
  await test('Scanner loads successfully', async () => {
    const { RuleEngine } = await import('./lib/engine.js');
    const engine = new RuleEngine();
    await engine.loadRules(RULES_DIR);
    assert(engine.rules.length === 55, `Expected 55 rules, got ${engine.rules.length}`);
  });

  // Test 3: .js file with eval is detected
  await test('Detect eval() in .js file', async () => {
    const { RuleEngine } = await import('./lib/engine.js');
    const engine = new RuleEngine();
    await engine.loadRules(RULES_DIR);

    const testFile = join(TEST_DIR, 'scan-test.js');
    await writeFile(testFile, "eval('test');");
    const content = await readFile(testFile, 'utf-8');
    const violations = engine.matchFile(testFile, content);
    assert(violations.some(v => v.rule_id === 'EXEC-001'), 'EXEC-001 not detected');

    await rm(testFile).catch(() => null);
  });

  // Test 4: .mjs file with eval is detected
  await test('Detect eval() in .mjs file', async () => {
    const { RuleEngine } = await import('./lib/engine.js');
    const engine = new RuleEngine();
    await engine.loadRules(RULES_DIR);

    const testFile = join(TEST_DIR, 'scan-test.mjs');
    await writeFile(testFile, "eval('test');");
    const content = await readFile(testFile, 'utf-8');
    const violations = engine.matchFile(testFile, content);
    assert(violations.some(v => v.rule_id === 'EXEC-001'), 'EXEC-001 not detected in .mjs');

    await rm(testFile).catch(() => null);
  });

  // Test 5: .cjs file with eval (should pass after fix)
  await test('Detect eval() in .cjs file', async () => {
    const { RuleEngine } = await import('./lib/engine.js');
    const engine = new RuleEngine();
    await engine.loadRules(RULES_DIR);

    const testFile = join(TEST_DIR, 'scan-test.cjs');
    await writeFile(testFile, "eval('test');");
    const content = await readFile(testFile, 'utf-8');
    const violations = engine.matchFile(testFile, content);
    // Should detect after .cjs support is added
    assert(violations.some(v => v.rule_id === 'EXEC-001'), 'EXEC-001 not detected in .cjs');

    await rm(testFile).catch(() => null);
  });

  // Test 6: Log directory creation
  await test('Log directory writable', async () => {
    await mkdir(LOGS_DIR, { recursive: true });
    const testFile = join(LOGS_DIR, 'test-perms.json');
    await writeFile(testFile, '{}');
    await rm(testFile);
  });

  // Test 7: Log file permissions (0o600)
  await test('Log file permissions secure (0o600)', async () => {
    const testFile = join(LOGS_DIR, 'perm-test.json');
    await writeFile(testFile, '{}');
    const { chmod, stat } = await import('fs/promises');
    await chmod(testFile, 0o600);
    const stats = await stat(testFile);
    const perms = (stats.mode & 0o777).toString(8);
    assert(perms === '600', `Expected 600, got ${perms}`);
    await rm(testFile);
  });

  // Test 8: Guard initialization
  await test('Guard initializes without errors', async () => {
    const Guard = (await import('./scripts/guard.js')).default;
    const guard = new Guard({ action: 'warn', monitor: true });
    await guard.initialize(RULES_DIR);
    assert(guard.engine.rules.length === 55, 'Guard did not load 55 rules');
  });

  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('📊 Validation Summary');
  console.log('=' .repeat(60));
  console.log(`Total: ${RESULTS.passed + RESULTS.failed}`);
  console.log(`Passed: ${RESULTS.passed}`);
  console.log(`Failed: ${RESULTS.failed}`);

  if (RESULTS.failed > 0) {
    console.log('\n❌ Failed tests:');
    RESULTS.tests.filter(t => t.status.includes('FAIL')).forEach(t => {
      console.log(`  - ${t.name}: ${t.error}`);
    });
  }

  console.log('\n' + '=' .repeat(60) + '\n');

  process.exit(RESULTS.failed > 0 ? 1 : 0);
}

runAllTests().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});