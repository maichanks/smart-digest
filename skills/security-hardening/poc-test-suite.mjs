#!/usr/bin/env node

/**
 * Comprehensive POC Attack Detection Test Suite
 * 测试 14 种攻击模式的检测率
 */

import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SKILL_DIR = __dirname; // This script is in security-hardening/
const RULES_DIR = join(SKILL_DIR, 'rules');
const POC_DIR = join(SKILL_DIR, 'poc-tests');
const LOGS_DIR = join(SKILL_DIR, 'logs');

// Import Guard
const Guard = (await import('./scripts/guard.js')).default;

const POC_TESTS = [
  { id: '1', file: '1-eval.js', rule: 'EXEC-001', desc: 'eval() injection' },
  { id: '2', file: '2-function.js', rule: 'EXEC-002', desc: 'Function() constructor' },
  { id: '3', file: '3-setTimeout.js', rule: 'EXEC-003', desc: 'setTimeout string' },
  { id: '4', file: '4-path.js', rule: 'FS-001', desc: 'Path traversal' },
  { id: '5', file: '5-keys.js', rule: 'FS-003', desc: 'Private key read' },
  { id: '6', file: '6-network.js', rule: 'NET-001', desc: 'Cloud metadata (169.254.169.254)' },
  { id: '7', file: '7-metadata.js', rule: 'NET-002', desc: 'Cloud metadata fetch' },
  { id: '8', file: '8-exit.js', rule: 'PROC-001', desc: 'process.exit()' },
  { id: '9', file: '9-require.js', rule: 'MOD-001', desc: 'Dynamic require' },
  { id: '10', file: '10-crypto.js', rule: 'CRYPTO-001', desc: 'Weak crypto (MD5)' },
  { id: '11', file: '11-xss.js', rule: 'WEB-001', desc: 'innerHTML XSS' },
  { id: '12', file: '12-pollution.js', rule: 'DATA-003', desc: 'Prototype pollution' },
  { id: '13', file: '13-test.cjs', rule: 'EXEC-001', desc: '.cjs eval detection' },
  { id: '14', file: '14-test.mjs', rule: 'EXEC-001', desc: '.mjs eval detection' }
];

const RESULTS = { passed: 0, failed: 0, details: [] };

function expectViolation(violations, ruleId) {
  return violations && violations.length > 0 && violations.some(v => v.rule_id === ruleId);
}

async function testPoc(test) {
  try {
    // Initialize fresh Guard for each test to collect violations
    const guard = new Guard({ action: 'block', monitor: false, logLevel: 'error' });
    await guard.initialize(RULES_DIR);

    const pocPath = join(POC_DIR, test.file);
    const content = await readFile(pocPath, 'utf-8');

    // Use engine directly to scan the file
    const violations = guard.engine.matchFile(pocPath, content);

    const detected = expectViolation(violations, test.rule);

    if (detected) {
      RESULTS.passed++;
      RESULTS.details.push({ ...test, status: '✅ PASS' });
      console.log(`✅ ${test.id}. ${test.desc} (${test.rule})`);
    } else {
      RESULTS.failed++;
      RESULTS.details.push({ ...test, status: '❌ FAIL', violations });
      console.log(`❌ ${test.id}. ${test.desc} (${test.rule}) - NOT DETECTED`);
      if (violations && violations.length > 0) {
        console.log(`   其他违规: ${violations.map(v => v.rule_id).join(', ')}`);
      }
    }
  } catch (err) {
    RESULTS.failed++;
    RESULTS.details.push({ ...test, status: '❌ ERROR', error: err.message });
    console.log(`❌ ${test.id}. ${test.desc} - ERROR: ${err.message}`);
  }
}

async function runAllTests() {
  console.log('🎯 Security Hardening Skill - POC Attack Detection Test Suite');
  console.log('=' .repeat(70));
  console.log(`测试时间: ${new Date().toISOString()}`);
  console.log(`规则目录: ${RULES_DIR}`);
  console.log(`POC 目录: ${POC_DIR}`);
  console.log('=' .repeat(70) + '\n');

  // Load Guard to get rule count
  const guard = new Guard();
  await guard.initialize(RULES_DIR);
  console.log(`🛡️  加载规则数: ${guard.engine.rules.length}`);
  console.log(`📝 审计日志: ${guard.logger.options.logFile || '未配置'}`);
  console.log('');

  // Run all POC tests sequentially
  for (const test of POC_TESTS) {
    await testPoc(test);
  }

  // Summary
  console.log('\n' + '=' .repeat(70));
  console.log('📊 测试摘要');
  console.log('=' .repeat(70));
  console.log(`总计: ${POC_TESTS.length}`);
  console.log(`通过: ${RESULTS.passed}`);
  console.log(`失败: ${RESULTS.failed}`);
  const rate = ((RESULTS.passed / POC_TESTS.length) * 100).toFixed(1);
  console.log(`通过率: ${rate}%`);
  console.log('=' .repeat(70));

  if (RESULTS.failed > 0) {
    console.log('\n❌ 失败项目:');
    RESULTS.details.filter(t => t.status.includes('FAIL')).forEach(t => {
      console.log(`  ${t.id}. ${t.desc} (期望规则: ${t.rule})`);
    });
    console.log('');
  }

  console.log('=' .repeat(70) + '\n');

  // Exit with code based on pass/fail
  // For final regression, we expect 100% pass rate
  const allPassed = RESULTS.failed === 0;
  console.log(allPassed ? '🎉 所有 POC 攻击检测通过！' : `⚠️  检测通过率: ${rate}% (目标: 100%)`);
  console.log('');

  process.exit(allPassed ? 0 : 1);
}

runAllTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
