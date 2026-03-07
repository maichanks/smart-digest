# Cost Optimizer - API 参考手册

本手册详细描述 Cost Optimizer Skill 的所有公开 API、配置选项、返回数据结构以及使用示例。

---

## 📑 目录

1. [构造函数](#构造函数)
2. [核心方法](#核心方法)
3. [数据结构](#数据结构)
4. [配置选项](#配置选项)
5. [错误处理](#错误处理)
6. [示例代码](#示例代码)
7. [与 OpenClaw 集成](#与-openclaw-集成)

---

## 📐 构造函数

### `new CostOptimizer(config?)`

创建 Cost Optimizer 实例。

**参数**:

| 参数名 | 类型 | 必需 | 默认值 | 描述 |
|--------|------|------|--------|------|
| `config` | `CostOptimizerConfig` | 否 | `{}` | 配置对象 |

**示例**:

```javascript
const optimizer = new CostOptimizer({
  cacheTTL: 600,
  cacheMaxSize: 2000,
  batchSize: 20,
  routingStrategy: 'cost-first'
});
```

---

## 🔧 核心方法

### 1. `selectOptimalRoute(requestType, priority?)`

选择最优路由端点。

**参数**:

| 参数名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| `requestType` | `string` | 是 | 请求类型（如 `'api-call'`, `'chat'`） |
| `priority` | `string` | 否 | 覆盖全局路由策略: `'adaptive'`, `'cost-first'`, `'performance-first'` |

**返回值**: `Promise<RouteDecision>`

```typescript
interface RouteDecision {
  endpoint: string;           // 选中的端点 (如 'us-east-1')
  score: number;              // 综合评分 (0-1)
  estimatedCost: number;      // 预估成本 (美元/请求)
  estimatedLatency: number;   // 预估延迟 (ms)
}
```

**示例**:

```javascript
const route = await optimizer.selectOptimalRoute('llm', 'cost-first');
console.log(`路由到: ${route.endpoint}, 成本: $${route.estimatedCost}`);
```

---

### 2. `get(key)`

从缓存获取值，自动跟踪缓存命中率。

**参数**:

| 参数名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| `key` | `string` | 是 | 缓存键 (由 `generateCacheKey` 生成) |

**返回值**: `Promise<CacheResult>`

```typescript
interface CacheResult {
  value?: any;    // 缓存值（如果命中）
  source: 'cache' | 'origin';  // 数据来源
  hit: boolean;   // 是否命中
}
```

**示例**:

```javascript
const { value, hit, source } = await optimizer.get('api-call:{"id":123}');
if (hit) {
  console.log('✅ 缓存命中:', value);
} else {
  console.log('❌ 缓存未命中，需从源获取');
}
```

---

### 3. `set(key, value, options?)`

设置缓存值，自动压缩大数据。

**参数**:

| 参数名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| `key` | `string` | 是 | 缓存键 |
| `value` | `any` | 是 | 要缓存的值 |
| `options` | `SetOptions` | 否 | 附加选项 |

**SetOptions**:

| 字段 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `ttl` | `number` | `config.cacheTTL` | 缓存时间（秒） |

**返回值**: `Promise<SetResult>`

```typescript
interface SetResult {
  key: string;
  originalSize: number;   // 原始数据大小（bytes）
  compressedSize: number; // 压缩后大小（bytes）
  saved: number;          // 节省的字节数
}
```

**示例**:

```javascript
const result = await optimizer.set('user:123', largeObject, { ttl: 600 });
console.log(`压缩节省: ${result.saved} bytes`);
```

---

### 4. `batchRequest(requests)`

批量处理请求队列，自动批处理压缩。

**参数**:

| 参数名 | 类型 | 必需 | 描述 |
|--------|------|------|------|
| `requests` | `Request[]` | 是 | 请求对象数组 |

**Request 对象**:

```typescript
interface Request {
  id: number | string;          // 请求ID
  type: string;                 // 请求类型
  params: Record<string, any>;  // 请求参数
  cacheable?: boolean;          // 是否可缓存（默认 true）
}
```

**返回值**: `Promise<BatchResult[]>`

每个 `BatchResult` 包含:

```typescript
interface BatchResult {
  batchId: number;
  results: ProcessedRequest[];
  count: number;
}

interface ProcessedRequest {
  id: number | string;
  source: 'cache' | 'origin';
  route: string;       // 使用的端点
  data: any;           // 处理结果
  cost?: number;       // 成本（仅 origin）
}
```

**示例**:

```javascript
const requests = [
  { id: 1, type: 'api-call', params: { action: 'get', id: 123 }, cacheable: true },
  { id: 2, type: 'api-call', params: { action: 'get', id: 456 }, cacheable: true }
];

const results = await optimizer.batchRequest(requests);
results.forEach(batch => {
  batch.results.forEach(req => {
    console.log(`请求 ${req.id}: ${req.source === 'cache' ? '缓存' : '源'}`);
  });
});
```

---

### 5. `getMetrics()`

获取当前性能指标快照。

**返回值**: `Metrics`

**Metrics 结构**:

```typescript
interface Metrics {
  totalRequests: number;         // 总请求数
  cacheHits: number;            // 缓存命中数
  cacheMisses: number;          // 缓存未命中数
  cacheHitRate: number;         // 缓存命中率 (%) 0-100
  batchesProcessed: number;     // 已处理批次数
  compressionSavings: number;   // 压缩节省字节数
  routingOptimizations: number; // 路由优化决策数
  startTime: number;            // 启动时间戳
  runtime: number;              // 运行时间 (秒)
  requestsPerSecond: number;    // 吞吐量 (req/s)
  avgBatchSize: number;         // 平均批大小
  cacheSize: number;            // 当前缓存条目数
  cacheLimit: number;           // 缓存容量上限
}
```

**示例**:

```javascript
const metrics = optimizer.getMetrics();
console.log(`📊 性能指标:`);
console.log(`  总请求: ${metrics.totalRequests}`);
console.log(`  缓存命中率: ${metrics.cacheHitRate}%`);
console.log(`  吞吐量: ${metrics.requestsPerSecond} req/s`);
console.log(`  运行时间: ${metrics.runtime}s`);
```

---

### 6. `getCostReport()`

获取成本节省报告。

**返回值**: `CostReport`

**CostReport 结构**:

```typescript
interface CostReport {
  totalRequests: number;              // 总请求数
  cacheHitRate: number;              // 缓存命中率 (%)
  routingOptimizations: number;      // 路由优化次数
  estimatedRoutingSavings: string;   // 预估路由节省 (如 "$0.0750")
  estimatedCompressionSavings: string; // 预估压缩节省
  totalEstimatedSavings: string;     // 总预估节省
  timestamp: string;                 // 报告生成时间 (ISO 8601)
}
```

**注意**: 节省金额为估算值，基于配置的 cost matrix 和压缩率。实际节省取决于具体使用场景。

**示例**:

```javascript
const report = optimizer.getCostReport();
console.log('💰 成本报告:');
console.log(`  总节省: ${report.totalEstimatedSavings}`);
console.log(`  - 路由节省: ${report.estimatedRoutingSavings}`);
console.log(`  - 压缩节省: ${report.estimatedCompressionSavings}`);
```

---

### 7. `resetMetrics()`

重置所有指标并清空缓存。

**返回值**: `{ status: string }`

**示例**:

```javascript
// 每月初或测试后清理
optimizer.resetMetrics();
console.log('✅ 指标和缓存已重置');
```

---

### 8. `runBenchmark(iterations?)`

运行性能基准测试。

**参数**:

| 参数名 | 类型 | 必需 | 默认值 | 描述 |
|--------|------|------|--------|------|
| `iterations` | `number` | 否 | `100` | 测试迭代次数 |

**返回值**: `Promise<BenchmarkResult>`

**BenchmarkResult 结构**:

```typescript
interface BenchmarkResult {
  duration: number;       // 总耗时 (ms)
  iterations: number;     // 迭代次数
  rps: number;           // 吞吐量 (req/s)
  metrics: Metrics;      // 最终指标
}
```

**示例**:

```javascript
// 运行 500 次迭代的基准测试
const result = await optimizer.runBenchmark(500);
console.log(`🚀 基准测试:`);
console.log(`  耗时: ${result.duration}ms`);
console.log(`  吞吐量: ${result.rps} req/s`);
console.log(`  缓存命中率: ${result.metrics.cacheHitRate}%`);
```

---

## 📊 数据结构

### 配置接口

```typescript
interface CostOptimizerConfig {
  cacheTTL?: number;           // 缓存 TTL（秒），默认 300
  cacheMaxSize?: number;      // 缓存最大条目数，默认 1000
  batchSize?: number;         // 批处理大小，默认 10
  routingStrategy?: string;   // 路由策略: 'adaptive' | 'cost-first' | 'performance-first'
  compressionLevel?: number;  // 压缩级别 1-9，默认 6
  monitorInterval?: number;   // 监控间隔（秒），默认 60
}
```

### 默认成本矩阵 (costMatrix)

内置 4 个端点的成本、延迟、可用性数据：

```javascript
{
  'us-east-1':      { cost: 0.10, latency: 20,  reliability: 0.99 },
  'us-west-2':      { cost: 0.12, latency: 25,  reliability: 0.98 },
  'eu-central-1':   { cost: 0.14, latency: 30,  reliability: 0.97 },
  'ap-southeast-1': { cost: 0.11, latency: 35,  reliability: 0.96 }
}
```

**自定义成本矩阵**:

```javascript
optimizer.costMatrix['my-custom-endpoint'] = {
  cost: 0.05,            // 每请求成本
  latency: 15,           // 延迟 ms
  reliability: 0.995     // 可用性 0-1
};
```

### 路由策略权重

```javascript
const weights = {
  'cost-first': {
    cost: 1.0,         // 成本权重 100%
    latency: 0.1,      // 延迟权重 10%
    reliability: 0.3   // 可用性权重 30%
  },
  'performance-first': {
    cost: 0.1,
    latency: 1.0,      // 延迟权重 100%
    reliability: 0.5
  },
  'adaptive': {        // 默认平衡模式
    cost: 0.5,
    latency: 0.7,
    reliability: 0.6
  }
};
```

---

## ⚙️ 配置选项详解

### 环境变量（CLI 模式）

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `CACHE_TTL` | number | 300 | 缓存生存时间（秒） |
| `CACHE_MAX_SIZE` | number | 1000 | 最大缓存条目数 |
| `BATCH_SIZE` | number | 10 | 批处理最大请求数 |
| `ROUTING_STRATEGY` | string | `adaptive` | 路由策略 |
| `COMPRESSION_LEVEL` | number | 6 | 压缩级别（1-9，仅作参考） |
| `MONITOR_INTERVAL` | number | 60 | 监控间隔（秒） |

**使用示例**:

```bash
# 通过环境变量配置
CACHE_TTL=600 BATCH_SIZE=20 ROUTING_STRATEGY=cost-first npm run optimize

# 或导出到环境
export CACHE_TTL=600
export BATCH_SIZE=20
npm run optimize
```

### 配置建议矩阵

| 场景 | CACHE_TTL | CACHE_MAX_SIZE | BATCH_SIZE | ROUTING_STRATEGY |
|------|-----------|----------------|------------|------------------|
| 高频重复查询（天气、汇率） | 600-1800 | 2000-5000 | 10-20 | adaptive |
| 实时对话（聊天机器人） | 60-120 | 500-1000 | 5-10 | performance-first |
| 批量作业（数据处理） | 300-600 | 1000-2000 | 20-50 | cost-first |
| 成本优先（预算有限） | 600-1200 | 1000-2000 | 20-30 | cost-first |
| 通用默认 | 300 | 1000 | 10 | adaptive |

---

## ❌ 错误处理

### 常见错误类型

| 错误场景 | 错误信息 | 处理建议 |
|----------|----------|----------|
| 缓存已满 | 自动驱逐最旧条目 | 增大 `CACHE_MAX_SIZE` |
| 批处理超时 | 未触发，默认 100ms 窗口 | 调整 batch timeout 逻辑 |
| 路由决策失败 | 使用 fallback 端点 | 检查 `costMatrix` 配置 |
| 内存不足 | Node.js 抛出 OOM | 减小 `cacheMaxSize` |

### 错误处理示例

```javascript
try {
  await optimizer.batchRequest(requests);
} catch (error) {
  console.error('批处理失败:', error.message);

  // 降级处理：单个发送
  for (const req of requests) {
    try {
      await optimizer.batchRequest([req]);
    } catch (e) {
      console.error(`请求 ${req.id} 失败:`, e.message);
    }
  }
}
```

---

## 💻 示例代码

### 示例 1：基础使用

```javascript
import { CostOptimizer } from './scripts/optimizer.js';

// 创建实例（使用默认配置）
const optimizer = new CostOptimizer();

// 处理单个请求
const result = await optimizer.batchRequest([{
  id: 1,
  type: 'test',
  params: { data: 'hello' },
  cacheable: true
}]);

console.log(result);

// 查看指标
console.log(optimizer.getMetrics());
```

---

### 示例 2：Web API 集成（Express）

```javascript
import express from 'express';
import { CostOptimizer } from './scripts/optimizer.js';

const app = express();
const optimizer = new CostOptimizer({ cacheTTL: 600 });

app.use(express.json());

// 代理 LLM 请求
app.post('/v1/chat/completions', async (req, res) => {
  const { model, messages, ...rest } = req.body;

  // 构造 optimizer 请求
  const requests = [{
    id: Date.now(),
    type: 'chat',
    params: { model, messages, ...rest },
    cacheable: false  // 对话不缓存
  }];

  const [batchResult] = await optimizer.batchRequest(requests);
  const { data, route, cost } = batchResult.results[0];

  // 附加优化器 Headers
  res.set({
    'X-Cost-USD': cost || '0',
    'X-Routed-Model': route,
    'X-Cache-Hit': data.fromCache ? 'true' : 'false'
  });

  res.json(data);
});

// 获取指标
app.get('/metrics', (req, res) => {
  res.json(optimizer.getMetrics());
});

app.listen(3000);
```

---

### 示例 3：自定义成本矩阵

```javascript
const optimizer = new CostOptimizer({
  routingStrategy: 'cost-first'
});

// 添加自定义端点
optimizer.costMatrix['ollama-local'] = {
  cost: 0,           // 免费
  latency: 5,        // 5ms 超低延迟
  reliability: 0.98
};

optimizer.costMatrix['openai-gpt4'] = {
  cost: 0.03,        // $0.03 / 1K tokens
  latency: 200,      // 200ms
  reliability: 0.99
};

// 路由决策将优先选择 local（成本为 0）
const route = await optimizer.selectOptimalRoute('llm');
console.log(`最佳端点: ${route.endpoint}`); // 输出: ollama-local
```

---

### 示例 4：监控与告警

```javascript
const optimizer = new CostOptimizer();

// 每 5 分钟检查一次指标
setInterval(() => {
  const metrics = optimizer.getMetrics();
  const report = optimizer.getCostReport();

  console.log(`[${new Date().toISOString()}]`);
  console.log(`  吞吐量: ${metrics.requestsPerSecond} req/s`);
  console.log(`  缓存命中率: ${metrics.cacheHitRate}%`);
  console.log(`  节省金额: ${report.totalEstimatedSavings}`);

  // 告警条件
  if (metrics.cacheHitRate < 30) {
    console.warn('⚠️  缓存命中率过低，考虑增大 CACHE_TTL 或 CACHE_MAX_SIZE');
  }
  if (metrics.requestsPerSecond < 10) {
    console.warn('⚠️  吞吐量偏低，检查配置或负载');
  }
}, 5 * 60 * 1000);
```

---

### 示例 5：多租户隔离

```javascript
class MultiTenantOptimizer {
  constructor() {
    this.tenants = new Map();
  }

  getOrCreate(tenantId, config) {
    if (!this.tenants.has(tenantId)) {
      const optimizer = new CostOptimizer({
        ...config,
        // 隔离缓存前缀
        cacheKeyPrefix: `tenant:${tenantId}:`
      });
      this.tenants.set(tenantId, optimizer);
    }
    return this.tenants.get(tenantId);
  }
}

const multi = new MultiTenantOptimizer();

// 租户 A 的 optimizer
const tenantA = multi.getOrCreate('tenant-a', { cacheMaxSize: 500 });

// 租户 B 的 optimizer
const tenantB = multi.getOrCreate('tenant-b', { cacheMaxSize: 2000 });

// 两者完全隔离
```

---

## 🔌 与 OpenClaw 集成

### 作为 Skill 调用

Cost Optimizer 已注册为 OpenClaw Skill，可通过标准 `invoke` 机制调用：

```javascript
// 在其他 skill 中
const result = await invoke('cost-optimizer', {
  action: 'optimize',
  data: {
    requests: [
      { id: 1, type: 'search', params: { q: 'OpenClaw' }, cacheable: true },
      // ...
    ],
    strategy: 'adaptive'
  }
});

console.log(result); // { metrics, report, processedCount }
```

**支持的 action**:

| action | 描述 | 参数 |
|--------|------|------|
| `optimize` | 批量优化请求 | `{ requests, strategy? }` |
| `metrics` | 获取指标 | `{}` |
| `report` | 获取成本报告 | `{}` |
| `reset` | 重置状态 | `{}` |

**示例调用**:

```javascript
const result = await invoke('cost-optimizer', {
  action: 'metrics'
});
console.log(result.metrics);
```

---

## 🎯 最佳实践

### 1. 合理设置 TTL

- **数据更新频繁**: 60-120 秒
- **一般查询**: 300-600 秒（默认）
- **静态数据**: 1800-3600 秒
- **历史数据**: 86400 秒（1 天）

### 2. 批处理大小调优

- **高吞吐离线作业**: 20-50
- **实时交互应用**: 5-10
- **默认值**: 10（适合大多数场景）

### 3. 路由策略选择

| 策略 | 适用场景 | 成本节省 | 性能影响 |
|------|----------|----------|----------|
| `cost-first` | 预算有限，非实时 | 40-50% | +3-5% |
| `performance-first` | 实时交互 | 10-20% | -1-2% (提升) |
| `adaptive` | 通用场景 | 25-35% | +2% |

### 4. 缓存策略

- 对**确定性输入**启用缓存（same input → same output）
- 对**对话、实时数据**禁用缓存（`cacheable: false`）
- 定期调用 `resetMetrics()` 清理旧数据

---

## 📖 附录

### 相关常量

```javascript
// 路由策略常量
CostOptimizer.STRATEGY_ADAPTIVE = 'adaptive';
CostOptimizer.STRATEGY_COST_FIRST = 'cost-first';
CostOptimizer.STRATEGY_PERFORMANCE_FIRST = 'performance-first';

// 默认配置
CostOptimizer.DEFAULT_CONFIG = {
  cacheTTL: 300,
  cacheMaxSize: 1000,
  batchSize: 10,
  routingStrategy: 'adaptive'
};
```

### 性能指标基准（参考）

| 指标 | 目标值 | 优秀值 |
|------|--------|--------|
| 缓存命中率 | ≥40% | ≥60% |
| 吞吐量 | ≥50 req/s | ≥100 req/s |
| 批处理效率 | 80%+ 批次满批 | 90%+ 批次满批 |
| 路由决策延迟 | <1ms | <0.1ms |

---

## 🔄 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0.0 | 2025-03-08 | 初始版本 |

---

**文档版本**: 1.0.0  
**对应 Skill 版本**: 1.0.0  
**最后更新**: 2025-03-08
