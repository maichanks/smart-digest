#!/usr/bin/env node

/**
 * Cost Optimizer Skill - Core Implementation
 * Features: Intelligent Routing, Cache Management, Batch Compression, Performance Monitoring
 */

import { LRUCache } from 'lru-cache';

class CostOptimizer {
  constructor(config = {}) {
    // Configuration with defaults
    this.config = {
      cacheTTL: config.cacheTTL || 300,
      cacheMaxSize: config.cacheMaxSize || 1000,
      batchSize: config.batchSize || 10,
      routingStrategy: config.routingStrategy || 'adaptive',
      compressionLevel: config.compressionLevel || 6,
      monitorInterval: config.monitorInterval || 60,
      ...config
    };

    // Metrics storage
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      batchesProcessed: 0,
      compressionSavings: 0,
      routingOptimizations: 0,
      startTime: Date.now()
    };

    // Initialize cache
    this.cache = new LRUCache({
      max: this.config.cacheMaxSize,
      ttl: this.config.cacheTTL * 1000 // Convert to ms
    });

    // Request batching queue
    this.batchQueue = [];
    this.batchTimeout = null;

    // Endpoint performance tracking
    this.endpoints = new Map();

    // Cost tracking by region/endpoint
    this.costMatrix = {
      'us-east-1': { cost: 0.10, latency: 20, reliability: 0.99 },
      'us-west-2': { cost: 0.12, latency: 25, reliability: 0.98 },
      'eu-central-1': { cost: 0.14, latency: 30, reliability: 0.97 },
      'ap-southeast-1': { cost: 0.11, latency: 35, reliability: 0.96 }
    };
  }

  /**
   * Intelligent Routing - Select optimal endpoint based on cost, latency, reliability
   */
  selectOptimalRoute(requestType, priority = 'balanced') {
    const weights = {
      'cost-first': { cost: 1.0, latency: 0.1, reliability: 0.3 },
      'performance-first': { cost: 0.1, latency: 1.0, reliability: 0.5 },
      'balanced': { cost: 0.5, latency: 0.7, reliability: 0.6 }
    };

    const w = weights[priority] || weights.balanced;
    let bestScore = -Infinity;
    let bestEndpoint = null;

    for (const [endpoint, data] of Object.entries(this.costMatrix)) {
      // Normalize metrics (lower cost, latency = better; higher reliability = better)
      const costValues = Object.values(this.costMatrix).map(e => e.cost);
      const latencyValues = Object.values(this.costMatrix).map(e => e.latency);
      const costScore = 1 - (data.cost / Math.max(...costValues));
      const latencyScore = 1 - (data.latency / Math.max(...latencyValues));
      const reliabilityScore = data.reliability;

      // Weighted score
      const score = (costScore * w.cost) + (latencyScore * w.latency) + (reliabilityScore * w.reliability);

      if (score > bestScore) {
        bestScore = score;
        bestEndpoint = endpoint;
      }
    }

    this.metrics.routingOptimizations++;
    return {
      endpoint: bestEndpoint,
      score: bestScore,
      estimatedCost: this.costMatrix[bestEndpoint].cost,
      estimatedLatency: this.costMatrix[bestEndpoint].latency
    };
  }

  /**
   * Cache Management - Get with cache hit/miss tracking
   */
  async get(key) {
    this.metrics.totalRequests++;
    const cached = this.cache.get(key);

    if (cached !== undefined) {
      this.metrics.cacheHits++;
      const value = this.decompressIfNeeded(cached);
      return { value, source: 'cache', hit: true };
    }

    this.metrics.cacheMisses++;
    return { source: 'origin', hit: false };
  }

  /**
   * Cache Management - Set with auto-compression for large values
   */
  async set(key, value, options = {}) {
    const ttl = options.ttl || this.config.cacheTTL;
    const compressThreshold = 1024; // Compress values > 1KB

    let storedValue = value;
    let originalSize = JSON.stringify(value).length;
    let compressedSize = originalSize;

    if (originalSize > compressThreshold) {
      // Simple compression simulation (in production use zlib/gzip)
      const compressionResult = this.compressData(value);
      storedValue = compressionResult;
      // Calculate actual storage size: if compressed, use content size plus small overhead
      compressedSize = compressionResult.__compressed
        ? compressionResult.data.length + 50 // estimate wrapper overhead
        : JSON.stringify(compressionResult).length;
      this.metrics.compressionSavings += Math.max(0, originalSize - compressedSize);
    }

    this.cache.set(key, storedValue, { ttl: ttl * 1000 });
    const saved = originalSize - compressedSize;
    return { key, originalSize, compressedSize, saved: saved > 0 ? saved : 0 };
  }

  /**
   * Batch Compression - Queue requests and process in batches
   */
  async batchRequest(requests) {
    return new Promise((resolve) => {
      this.batchQueue.push({ requests, resolve, timestamp: Date.now() });

      if (this.batchQueue.length >= this.config.batchSize) {
        this.processBatch();
      } else if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.processBatch();
        }, 100); // Process within 100ms
      }
    });
  }

  async processBatch() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    if (this.batchQueue.length === 0) return;

    const batch = this.batchQueue.splice(0, this.config.batchSize);
    this.metrics.batchesProcessed++;

    // Simulate batch processing (in production, actual API batch calls)
    const results = await Promise.all(batch.map(async ({ requests, resolve }) => {
      const processed = await Promise.all(requests.map(req => this.processSingleRequest(req)));
      resolve({ batchId: Date.now(), results: processed, count: requests.length });
      return processed;
    }));

    return results;
  }

  async processSingleRequest(request) {
    // Intelligent routing decision
    const route = this.selectOptimalRoute(request.type, this.config.routingStrategy);

    // Cache lookup (using our managed get method for metrics and decompression)
    const cacheKey = this.generateCacheKey(request);
    const { value: cachedValue, hit } = await this.get(cacheKey);

    if (hit && cachedValue !== undefined) {
      return {
        id: request.id,
        source: 'cache',
        route: route.endpoint,
        data: cachedValue,
        cost: 0
      };
    }

    // Simulate processing (would call actual API in production)
    const processingCost = this.costMatrix[route.endpoint].cost;
    const result = {
      id: request.id,
      source: 'origin',
      route: route.endpoint,
      data: { processed: true, timestamp: Date.now() },
      cost: processingCost
    };

    // Auto-cache if cacheable
    if (request.cacheable !== false) {
      this.cache.set(this.generateCacheKey(request), result.data);
    }

    return result;
  }

  generateCacheKey(request) {
    return `${request.type}:${JSON.stringify(request.params)}`;
  }

  /**
   * Simple data compression (simulated - use zlib in production)
   * Returns the compressed representation ready for caching
   */
  compressData(data) {
    const str = JSON.stringify(data);
    // In production: return zlib.gzipSync(str, { level: this.config.compressionLevel });

    if (str.length > 100) {
      // Remove all whitespace for basic compression
      const compressed = str.replace(/\s+/g, '');
      const saved = str.length - compressed.length;
      return {
        __compressed: true,
        data: compressed,
        __saved: saved
      };
    }
    return data;
  }

  /**
   * Decompress cached data if needed
   */
  decompressIfNeeded(cachedValue) {
    if (cachedValue && typeof cachedValue === 'object' && cachedValue.__compressed) {
      // Parse the compressed JSON string
      try {
        return JSON.parse(cachedValue.data);
      } catch (e) {
        // If parsing fails, return as-is
        return cachedValue;
      }
    }
    return cachedValue;
  }

  /**
   * Performance Monitoring - Get current metrics
   */
  getMetrics() {
    const runtime = (Date.now() - this.metrics.startTime) / 1000;
    const requestsPerSecond = this.metrics.totalRequests / runtime;

    return {
      ...this.metrics,
      runtime,
      requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
      cacheHitRate: this.metrics.totalRequests > 0
        ? Math.round((this.metrics.cacheHits / this.metrics.totalRequests) * 10000) / 100
        : 0,
      avgBatchSize: this.metrics.batchesProcessed > 0
        ? Math.round((this.metrics.totalRequests / this.metrics.batchesProcessed) * 100) / 100
        : 0,
      cacheSize: this.cache.size,
      cacheLimit: this.config.cacheMaxSize
    };
  }

  /**
   * Performance Monitoring - Get cost savings report
   */
  getCostReport() {
    const metrics = this.getMetrics();
    const estimatedRoutingSavings = this.metrics.routingOptimizations * 0.05; // $0.05 per optimization
    const estimatedCompressionSavings = (metrics.compressionSavings / 1024) * 0.01; // $0.01 per KB saved

    return {
      totalRequests: metrics.totalRequests,
      cacheHitRate: metrics.cacheHitRate,
      routingOptimizations: this.metrics.routingOptimizations,
      estimatedRoutingSavings: `$${estimatedRoutingSavings.toFixed(4)}`,
      estimatedCompressionSavings: `$${estimatedCompressionSavings.toFixed(4)}`,
      totalEstimatedSavings: `$${(estimatedRoutingSavings + estimatedCompressionSavings).toFixed(4)}`,
      avgResponseTime: 'N/A', // Would track in production
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Performance Monitoring - Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      batchesProcessed: 0,
      compressionSavings: 0,
      routingOptimizations: 0,
      startTime: Date.now()
    };
    this.cache.clear();
    return { status: 'metrics reset' };
  }

  /**
   * Expose methods for CLI usage
   */
  async optimizeSample() {
    console.log('\n=== Cost Optimizer - Sample Run ===\n');

    // Sample requests
    const sampleRequests = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      type: 'api-call',
      params: { endpoint: 'data', query: `q=${i}` },
      cacheable: true
    }));

    console.log('Processing sample requests...\n');

    // Process in batches
    const batches = [];
    for (let i = 0; i < sampleRequests.length; i += this.config.batchSize) {
      const batch = sampleRequests.slice(i, i + this.config.batchSize);
      await this.batchRequest(batch);
      batches.push(batch);
      await new Promise(r => setTimeout(r, 10)); // Simulate delay
    }

    // Show metrics
    const metrics = this.getMetrics();
    console.log('\n=== Metrics ===');
    Object.entries(metrics).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    // Show cost report
    const report = this.getCostReport();
    console.log('\n=== Cost Savings Report ===');
    Object.entries(report).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });

    // Show routing decisions
    console.log('\n=== Routing Decisions Sample ===');
    for (let i = 0; i < 3; i++) {
      const route = this.selectOptimalRoute('api-call', this.config.routingStrategy);
      console.log(`  Request ${i + 1}: ${route.endpoint} (score: ${route.score.toFixed(3)}, cost: $${route.estimatedCost}/req, latency: ${route.estimatedLatency}ms)`);
    }

    console.log('\n=== Cache Stats ===');
    console.log(`  Cache size: ${this.cache.size}/${this.cache.max}`);
    console.log(`  Hit rate: ${metrics.cacheHitRate}%`);

    return { metrics, report };
  }

  /**
   * Benchmark mode
   */
  async runBenchmark(iterations = 100) {
    console.log(`\n=== Running Benchmark (${iterations} iterations) ===\n`);

    const start = Date.now();
    const requests = Array.from({ length: iterations }, (_, i) => ({
      id: i,
      type: 'benchmark',
      params: { test: true, index: i },
      cacheable: i % 2 === 0
    }));

    // Process all requests
    for (let i = 0; i < requests.length; i += this.config.batchSize) {
      const batch = requests.slice(i, i + this.config.batchSize);
      await this.batchRequest(batch);
    }

    // Wait for all batches to complete
    await new Promise(resolve => setTimeout(resolve, 200));

    const end = Date.now();
    const duration = end - start;
    const rps = Math.round((iterations / duration) * 1000);

    const metrics = this.getMetrics();
    console.log(`\nBenchmark Results:`);
    console.log(`  Total time: ${duration}ms`);
    console.log(`  Requests: ${iterations}`);
    console.log(`  Throughput: ${rps} req/s`);
    console.log(`  Cache hit rate: ${metrics.cacheHitRate}%`);
    console.log(`  Batches: ${metrics.batchesProcessed}`);
    console.log(`  Avg batch size: ${metrics.avgBatchSize}`);

    return { duration, iterations, rps, metrics };
  }
}

/**
 * CLI Entry Point
 */
async function main() {
  const args = process.argv.slice(2);
  const config = {
    cacheTTL: parseInt(process.env.CACHE_TTL) || 300,
    cacheMaxSize: parseInt(process.env.CACHE_MAX_SIZE) || 1000,
    batchSize: parseInt(process.env.BATCH_SIZE) || 10,
    routingStrategy: process.env.ROUTING_STRATEGY || 'adaptive',
    compressionLevel: parseInt(process.env.COMPRESSION_LEVEL) || 6,
    monitorInterval: parseInt(process.env.MONITOR_INTERVAL) || 60
  };

  const optimizer = new CostOptimizer(config);

  if (args.includes('--test') || args.includes('--benchmark')) {
    if (args.includes('--benchmark')) {
      const iterationsArg = args.find(arg => !isNaN(parseInt(arg)));
      const iterations = iterationsArg ? parseInt(iterationsArg) : 100;
      await optimizer.runBenchmark(iterations);
    } else {
      await optimizer.optimizeSample();
      console.log('\n✅ Sample run completed successfully');
    }
  } else {
    // Default: print help
    console.log(`
Cost Optimizer Skill - CLI Usage

Environment Variables:
  CACHE_TTL          Cache TTL in seconds (default: 300)
  CACHE_MAX_SIZE     Max cache entries (default: 1000)
  BATCH_SIZE         Max batch size (default: 10)
  ROUTING_STRATEGY   Routing: adaptive, cost-first, performance-first (default: adaptive)
  COMPRESSION_LEVEL  Compression level 1-9 (default: 6)
  MONITOR_INTERVAL   Monitoring interval in seconds (default: 60)

Commands:
  npm run optimize    Run sample optimization
  npm test           Run test suite
  npm run benchmark  Run benchmark (default 100 iterations)

Examples:
  CACHE_TTL=600 BATCH_SIZE=20 npm run optimize
  npm run benchmark -- --iterations 500
    `);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

// Export for use as a module
export { CostOptimizer };
export default CostOptimizer;