#!/usr/bin/env node

/**
 * Comprehensive QA Test Suite for Cost-Optimizer Skill
 * Tests: Code Quality, Feature Completeness, Core Functions, Performance
 */

import { CostOptimizer } from './scripts/optimizer.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class QATester {
  constructor() {
    this.testResults = [];
    this.passed = 0;
    this.failed = 0;
    this.defects = [];
  }

  // Helper to log test results
  log(testName, passed, message = '', details = null) {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${testName}`);
    if (message) console.log(`   ${message}`);
    if (details) console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
    console.log('');

    if (passed) {
      this.passed++;
    } else {
      this.failed++;
      this.defects.push({ test: testName, message, details });
    }

    this.testResults.push({ test: testName, passed, message, details });
  }

  // Test 1: Code Quality Checks
  async testCodeQuality() {
    console.log('\n=== CODE QUALITY TESTS ===\n');

    // Check file structure
    const fs = await import('fs');
    const path = await import('path');

    const skillDir = '/home/admin/.openclaw/workspace/skills/cost-optimizer';
    const requiredFiles = [
      'scripts/optimizer.js',
      'package.json',
      'README.md',
      'SKILL.md'
    ];

    let allFilesExist = true;
    for (const file of requiredFiles) {
      const filePath = path.join(skillDir, file);
      try {
        await fs.promises.access(filePath);
      } catch {
        allFilesExist = false;
        this.log('Required Files Exist', false, `Missing: ${file}`);
      }
    }
    if (allFilesExist) {
      this.log('Required Files Exist', true, 'All required files present');
    }

    // Check package.json structure
    try {
      const pkgContent = await fs.promises.readFile(path.join(skillDir, 'package.json'), 'utf8');
      const pkg = JSON.parse(pkgContent);

      const hasRequiredFields = pkg.name && pkg.version && pkg.main && pkg.scripts;
      this.log('package.json Structure', hasRequiredFields,
        `name: ${pkg.name}, version: ${pkg.version}`);

      const hasDeps = pkg.dependencies && pkg.dependencies['lru-cache'];
      this.log('Dependencies Declaration', !!hasDeps, 'lru-cache dependency present');

      const hasNodeEngine = pkg.engines && pkg.engines.node;
      this.log('Node Version Requirement', !!hasNodeEngine, `Requires Node ${pkg.engines.node}`);
    } catch (e) {
      this.log('package.json Valid', false, `Parse error: ${e.message}`);
    }

    // Check ES Module vs CommonJS consistency
    try {
      const optimizerContent = await fs.promises.readFile(
        path.join(skillDir, 'scripts/optimizer.js'), 'utf8');

      const hasESM = optimizerContent.includes('import ') && optimizerContent.includes('export ');
      const hasCommonJS = optimizerContent.includes('require(') || optimizerContent.includes('module.exports');

      this.log('Module System Consistency', !(hasESM && hasCommonJS),
        hasESM ? 'Uses ES Modules (import/export)' : 'Uses CommonJS');
    } catch (e) {
      this.log('Module System Check', false, e.message);
    }

    // Check error handling patterns
    try {
      const optimizerContent = await fs.promises.readFile(
        path.join(skillDir, 'scripts/optimizer.js'), 'utf8');

      const hasTryCatch = optimizerContent.includes('try') && optimizerContent.includes('catch');
      const hasPromiseErrorHandling = optimizerContent.includes('.catch(');
      const validatesInput = optimizerContent.includes('if (') || optimizerContent.includes('throw');

      this.log('Error Handling', hasTryCatch || hasPromiseErrorHandling,
        'Contains try/catch or promise error handling');
      this.log('Input Validation', validatesInput, 'Contains conditional checks');
    } catch (e) {
      this.log('Error Handling Check', false, e.message);
    }
  }

  // Test 2: Feature Completeness
  async testFeatureCompleteness() {
    console.log('\n=== FEATURE COMPLETENESS TESTS ===\n');

    const optimizer = new CostOptimizer();

    // Test Intelligent Routing
    const route = optimizer.selectOptimalRoute('api-call', 'adaptive');
    const hasRouting = route && route.endpoint && route.score !== undefined;
    this.log('Intelligent Routing Feature', hasRouting,
      `Selected endpoint: ${route?.endpoint}`);

    // Test different strategies
    const strategies = ['adaptive', 'cost-first', 'performance-first'];
    for (const strategy of strategies) {
      const r = optimizer.selectOptimalRoute('api-call', strategy);
      this.log(`Routing Strategy: ${strategy}`, r && r.endpoint,
        `endpoint=${r?.endpoint}, score=${r?.score?.toFixed(3)}`);
    }

    // Test Cache Management
    try {
      await optimizer.set('test-key', { value: 123, large: 'data'.repeat(100) });
      const getResult = await optimizer.get('test-key');
      const cacheWorks = getResult.value && getResult.hit === true;
      this.log('Cache Set/Get', cacheWorks, `Retrieved value: ${JSON.stringify(getResult.value)?.substring(0, 50)}...`);
    } catch (e) {
      this.log('Cache Set/Get', false, e.message);
    }

    // Test cache miss
    const missResult = await optimizer.get('non-existent-key');
    this.log('Cache Miss Handling', missResult.hit === false && missResult.source === 'origin',
      `Miss source: ${missResult.source}`);

    // Test compression for large values
    const largeValue = { data: 'x'.repeat(2000) };
    const setResult = await optimizer.set('large-key', largeValue);
    const hasCompression = setResult.compressedSize < setResult.originalSize ||
                          setResult.saved > 0;
    this.log('Compression for Large Values', hasCompression,
      `Original: ${setResult.originalSize}, Compressed: ${setResult.compressedSize}, Saved: ${setResult.saved}`);

    // Test Batch Compression
    const batchResults = await optimizer.batchRequest([
      { id: 1, type: 'test', params: { a: 1 }, cacheable: true },
      { id: 2, type: 'test', params: { a: 2 }, cacheable: true }
    ]);
    const batchWorks = batchResults && batchResults.batchId;
    this.log('Batch Request Processing', !!batchWorks,
      `Batch ID: ${batchResults?.batchId}, Count: ${batchResults?.count}`);

    // Test multiple batches
    await Promise.all([
      optimizer.batchRequest([{ id: 10, type: 'batch1', params: { x: 1 } }]),
      optimizer.batchRequest([{ id: 11, type: 'batch2', params: { x: 2 } }])
    ]);
    this.log('Concurrent Batch Requests', true, 'Multiple batches processed');

    // Test Performance Monitoring
    const metrics = optimizer.getMetrics();
    const hasMetrics = metrics &&
      typeof metrics.totalRequests === 'number' &&
      typeof metrics.cacheHitRate === 'number' &&
      typeof metrics.runtime === 'number';
    this.log('Metrics Object Structure', hasMetrics,
      `totalRequests: ${metrics?.totalRequests}, cacheHitRate: ${metrics?.cacheHitRate}%`);

    // Test Cost Report
    const report = optimizer.getCostReport();
    const hasReport = report &&
      typeof report.totalEstimatedSavings === 'string' &&
      report.totalEstimatedSavings.startsWith('$');
    this.log('Cost Report Structure', hasReport,
      `Total Savings: ${report?.totalEstimatedSavings}`);

    // Test Metrics Reset
    const resetResult = optimizer.resetMetrics();
    const resetWorks = resetResult && resetResult.status === 'metrics reset';
    this.log('Metrics Reset Function', resetWorks);

    const metricsAfterReset = optimizer.getMetrics();
    const isReset = metricsAfterReset.totalRequests === 0 &&
                    metricsAfterReset.cacheHits === 0;
    this.log('Metrics Reset Effect', isReset, 'All counters reset to 0');

    // Test benchmark method
    try {
      const benchmarkResult = await optimizer.runBenchmark(10);
      this.log('Benchmark Method', benchmarkResult.duration > 0,
        `Duration: ${benchmarkResult.duration}ms, RPS: ${benchmarkResult.rps}`);
    } catch (e) {
      this.log('Benchmark Method', false, e.message);
    }

    // Test sample optimize method
    try {
      const sampleResult = await optimizer.optimizeSample();
      this.log('Sample Optimization', !!sampleResult.metrics && !!sampleResult.report,
        'Generates metrics and cost report');
    } catch (e) {
      this.log('Sample Optimization', false, e.message);
    }
  }

  // Test 3: Functional Tests with Edge Cases
  async testEdgeCases() {
    console.log('\n=== EDGE CASE & ROBUSTNESS TESTS ===\n');

    const optimizer = new CostOptimizer();

    // Test empty configuration
    try {
      const emptyOpt = new CostOptimizer();
      const defaultsWork = emptyOpt.config.cacheTTL === 300 &&
                          emptyOpt.config.batchSize === 10;
      this.log('Default Configuration', defaultsWork, 'Uses sensible defaults');
    } catch (e) {
      this.log('Default Configuration', false, e.message);
    }

    // Test custom configuration
    try {
      const customOpt = new CostOptimizer({
        cacheTTL: 600,
        cacheMaxSize: 5000,
        batchSize: 20,
        routingStrategy: 'cost-first'
      });
      const customWorks = customOpt.config.cacheTTL === 600 &&
                         customOpt.config.batchSize === 20 &&
                         customOpt.config.routingStrategy === 'cost-first';
      this.log('Custom Configuration', customWorks, 'Accepts and applies custom config');
    } catch (e) {
      this.log('Custom Configuration', false, e.message);
    }

    // Test cache key generation with special characters
    try {
      const key1 = optimizer.generateCacheKey({
        type: 'special',
        params: { q: 'hello world', filter: 'a=b&c=d' }
      });
      const key2 = optimizer.generateCacheKey({
        type: 'special',
        params: { q: 'hello world', filter: 'a=b&c=d' }
      });
      const consistentKeys = key1 === key2;
      this.log('Cache Key Consistency', consistentKeys, `Generated key: ${key1.substring(0, 50)}...`);
    } catch (e) {
      this.log('Cache Key Consistency', false, e.message);
    }

    // Test cache TTL
    try {
      await optimizer.set('ttl-key', { ttlTest: true }, { ttl: 1 });
      const get1 = await optimizer.get('ttl-key');
      await new Promise(r => setTimeout(r, 1100));
      const get2 = await optimizer.get('ttl-key');
      const ttlWorks = get1.hit === true && get2.hit === false;
      this.log('Cache TTL Expiration', ttlWorks, `Hit before: ${get1.hit}, after: ${get2.hit}`);
    } catch (e) {
      this.log('Cache TTL Expiration', false, e.message);
    }

    // Test cache size limit
    try {
      const smallOpt = new CostOptimizer({ cacheMaxSize: 3 });
      await smallOpt.set('key1', { v: 1 });
      await smallOpt.set('key2', { v: 2 });
      await smallOpt.set('key3', { v: 3 });
      await smallOpt.set('key4', { v: 4 }); // Should evict key1
      const missOnOld = !(await smallOpt.get('key1')).hit;
      const hitOnNew = (await smallOpt.get('key4')).hit;
      this.log('Cache Size Limit (LRU)', missOnOld && hitOnNew,
        `Eviction works: key1 miss=${!missOnOld}, key4 hit=${hitOnNew}`);
    } catch (e) {
      this.log('Cache Size Limit', false, e.message);
    }

    // Test batch with 0 requests
    try {
      const emptyBatch = await optimizer.batchRequest([]);
      this.log('Empty Batch Handling', true, 'Handles empty batch gracefully');
    } catch (e) {
      this.log('Empty Batch Handling', false, e.message);
    }

    // Test batch with 1 request
    try {
      const singleBatch = await optimizer.batchRequest([{ id: 99, type: 'single', params: {} }]);
      const singleWorks = singleBatch && singleBatch.results && singleBatch.results.length > 0;
      this.log('Single Request Batch', singleWorks, 'Handles single-item batch');
    } catch (e) {
      this.log('Single Request Batch', false, e.message);
    }

    // Test cacheable flag
    try {
      const cacheableReq = { id: 100, type: 'test', params: {}, cacheable: true };
      const nonCacheableReq = { id: 101, type: 'test', params: {}, cacheable: false };
      await optimizer.processSingleRequest(cacheableReq);
      await optimizer.processSingleRequest(nonCacheableReq);
      const metrics = optimizer.getMetrics();
      const cacheWorks = metrics.cacheSize > 0;
      this.log('Cacheable Flag Handling', cacheWorks, 'Cacheable items are stored');
    } catch (e) {
      this.log('Cacheable Flag Handling', false, e.message);
    }

    // Test compression for small values (should not compress)
    try {
      const smallValue = { small: true };
      const result = await optimizer.set('small-key', smallValue);
      const noCompression = result.saved === 0 || result.originalSize === result.compressedSize;
      this.log('Small Value No-Compression', noCompression,
        `Original: ${result.originalSize}, Compressed: ${result.compressedSize}`);
    } catch (e) {
      this.log('Small Value No-Compression', false, e.message);
    }

    // Test invalid routing strategy fallback
    try {
      const route = optimizer.selectOptimalRoute('test', 'invalid-strategy');
      const fallbackWorks = route && route.endpoint;
      this.log('Invalid Strategy Fallback', fallbackWorks, `Falls back to default`);
    } catch (e) {
      this.log('Invalid Strategy Fallback', false, e.message);
    }

    // Test round-trip data integrity
    try {
      const original = {
        number: 42,
        string: 'hello',
        array: [1, 2, 3],
        nested: { a: { b: { c: 'deep' } } },
        special: 'a b c&d=e'
      };
      await optimizer.set('integrity-key', original);
      const retrieved = await optimizer.get('integrity-key');
      const integrityOk = JSON.stringify(retrieved.value) === JSON.stringify(original);
      this.log('Data Integrity (Round Trip)', integrityOk,
        integrityOk ? 'Data preserved correctly' : 'Data corrupted after retrieval');
    } catch (e) {
      this.log('Data Integrity', false, e.message);
    }
  }

  // Test 4: Performance & Benchmarking
  async testPerformance() {
    console.log('\n=== PERFORMANCE TESTS ===\n');

    console.log('Running extended benchmark (1000 iterations)...');
    const optimizer = new CostOptimizer({ batchSize: 20 });

    const startTime = Date.now();
    const iterations = 1000;

    const requests = Array.from({ length: iterations }, (_, i) => ({
      id: i,
      type: 'perf-test',
      params: { index: i },
      cacheable: i % 2 === 0
    }));

    // Process in batches
    for (let i = 0; i < requests.length; i += optimizer.config.batchSize) {
      const batch = requests.slice(i, i + optimizer.config.batchSize);
      await optimizer.batchRequest(batch);
    }
    await new Promise(resolve => setTimeout(resolve, 200));

    const endTime = Date.now();
    const duration = endTime - startTime;
    const rps = Math.round((iterations / duration) * 1000);
    const metrics = optimizer.getMetrics();

    console.log(`\nExtended Benchmark Results:`);
    console.log(`  Iterations: ${iterations}`);
    console.log(`  Total time: ${duration}ms`);
    console.log(`  Throughput: ${rps} req/s`);
    console.log(`  Batches: ${metrics.batchesProcessed}`);
    console.log(`  Cache size: ${metrics.cacheSize}`);
    console.log(`  Cache hit rate: ${metrics.cacheHitRate}%`);
    console.log(`  Avg batch size: ${metrics.avgBatchSize}`);
    console.log(`  Requests per second: ${metrics.requestsPerSecond}`);

    // Performance thresholds
    const rpsThreshold = 50; // Should handle at least 50 req/s
    this.log('Throughput Performance', rps >= rpsThreshold,
      `Throughput: ${rps} req/s (threshold: ${rpsThreshold})`);

    const batchEfficiency = metrics.avgBatchSize >= 8;
    this.log('Batch Efficiency', batchEfficiency,
      `Average batch size: ${metrics.avgBatchSize} (target: >=8)`);

    const noErrors = metrics.batchesProcessed > 0 && metrics.totalRequests === iterations;
    this.log('Processing Completeness', noErrors,
      `Processed all ${iterations} requests in ${metrics.batchesProcessed} batches`);

    // Memory test - check cache is clearing properly
    const resetMetrics = optimizer.resetMetrics();
    const afterReset = optimizer.getMetrics();
    const memoryReleased = afterReset.totalRequests === 0 && afterReset.cacheSize === 0;
    this.log('Memory Release on Reset', memoryReleased, 'Memory properly released');
  }

  // Generate final test report
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('  COST-OPTIMIZER SKILL - QA TEST REPORT');
    console.log('='.repeat(60) + '\n');

    const totalTests = this.passed + this.failed;
    const passRate = ((this.passed / totalTests) * 100).toFixed(1);

    console.log('TEST SUMMARY');
    console.log('-'.repeat(40));
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${this.passed} (${passRate}%)`);
    console.log(`Failed: ${this.failed} (${(100 - parseFloat(passRate)).toFixed(1)}%)`);
    console.log('');

    if (this.defects.length > 0) {
      console.log('DEFECT LIST');
      console.log('-'.repeat(40));
      this.defects.forEach((defect, index) => {
        console.log(`${index + 1}. ${defect.test}`);
        console.log(`   Issue: ${defect.message}`);
        if (defect.details) {
          console.log(`   Details: ${JSON.stringify(defect.details)}`);
        }
        console.log('');
      });
    }

    console.log('PERFORMANCE DATA');
    console.log('-'.repeat(40));
    console.log('(See detailed benchmark output above)');

    // Save report to file
    const reportData = {
      generated: new Date().toISOString(),
      summary: {
        totalTests,
        passed: this.passed,
        failed: this.failed,
        passRate: parseFloat(passRate)
      },
      results: this.testResults,
      defects: this.defects
    };

    const reportPath = path.join(__dirname, 'qa-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

    console.log(`\nDetailed report saved: ${reportPath}`);

    // Also generate markdown report
    const mdReport = this.generateMarkdownReport(reportData);
    const mdPath = path.join(__dirname, 'qa-test-report.md');
    fs.writeFileSync(mdPath, mdReport);
    console.log(`Markdown report saved: ${mdPath}`);

    console.log('\n' + '='.repeat(60));
    console.log(`FINAL VERDICT: ${passRate >= 80 ? '✅ PASSED' : '❌ FAILED'} (${passRate}% pass rate)`);
    console.log('='.repeat(60));
  }

  generateMarkdownReport(reportData) {
    const { summary, defects, results } = reportData;
    const passRate = summary.passRate.toFixed(1);

    let md = `# Cost-Optimizer Skill - QA Test Report\n\n`;
    md += `**Generated:** ${new Date().toISOString()}\n\n`;
    md += `## Test Summary\n\n`;
    md += `| Metric | Value |\n`;
    md += `|--------|-------|\n`;
    md += `| Total Tests | ${summary.totalTests} |\n`;
    md += `| Passed | ${summary.passed} |\n`;
    md += `| Failed | ${summary.failed} |\n`;
    md += `| Pass Rate | **${passRate}%** |\n\n`;

    md += `## Test Results\n\n`;
    md += `| Test | Status | Details |\n`;
    md += `|------|--------|---------|\n`;
    results.forEach(r => {
      const status = r.passed ? '✅ PASS' : '❌ FAIL';
      const details = r.message.substring(0, 50).replace(/\|/g, '\\|');
      md += `| ${r.test} | ${status} | ${details} |\n`;
    });

    if (defects.length > 0) {
      md += `\n## Defect List\n\n`;
      defects.forEach((d, i) => {
        md += `${i + 1}. **${d.test}**\n`;
        md += `   - Issue: ${d.message}\n\n`;
      });
    }

    md += `## Recommendations\n\n`;
    if (passRate >= 95) {
      md += `- ✅ **Excellent quality** - Skill is production-ready\n`;
      md += `- All core functions working as expected\n`;
      md += `- Performance metrics meet expectations\n`;
    } else if (passRate >= 80) {
      md += `- ⚠️ **Good quality with minor issues** - Skill mostly ready\n`;
      md += `- Address failed tests before production\n`;
      md += `- Consider adding more error handling edge cases\n`;
    } else {
      md += `- ❌ **Significant issues found** - Not production-ready\n`;
      md += `- Review all failed tests and fix critical defects\n`;
      md += `- Add comprehensive error handling\n`;
      md += `- Verify all core features fully implemented\n`;
    }

    md += `\n---\n*Report generated by QA Tester for Cost-Optimizer Skill*`;

    return md;
  }

  async runAllTests() {
    console.log('\n' + '='.repeat(60));
    console.log('  COST-OPTIMIZER SKILL - COMPREHENSIVE QA TESTING');
    console.log('='.repeat(60));

    try {
      await this.testCodeQuality();
      await this.testFeatureCompleteness();
      await this.testEdgeCases();
      await this.testPerformance();

      this.generateReport();
    } catch (e) {
      console.error('Test suite failed:', e);
      process.exit(1);
    }
  }
}

// Run the QA tests
const tester = new QATester();
tester.runAllTests().catch(console.error);
