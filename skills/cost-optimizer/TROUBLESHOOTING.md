# Cost Optimizer - 故障排除指南

本文档提供 Cost Optimizer Skill 的常见问题诊断、错误排查和性能优化建议。

---

## 🚨 常见问题

### Q1: 缓存命中率过低 (<10%)

**症状**:
```
📊 性能指标:
  缓存命中率: 5%
```

**可能原因**:

1. **缓存 TTL 过短**
   - 默认 300 秒可能不够，重复请求间隔太长
   - 高频查询应 ↑ TTL 到 600-1800 秒

2. **请求参数不固定**
   - 每次请求参数不同（如随机数、时间戳）
   - 导致缓存键不同，无法命中

3. **`cacheable: false`**
   - 请求显式标记为不可缓存
   - 检查是否有不必要的 `cacheable: false`

4. **缓存容量不足**
   - `CACHE_MAX_SIZE` 太小，旧条目被提前驱逐
   - 内存不足时 LRU 会快速淘汰

**解决方案**:

```javascript
// ✅ 方案 1: 增加 TTL
const optimizer = new CostOptimizer({
  cacheTTL: 1200  // 从 300 增加到 1200 秒
});

// ✅ 方案 2: 规范化缓存键
// 确保相同语义的请求生成相同缓存键
function normalizeParams(params) {
  // 移除不影响结果的参数
  const { timestamp, random, nonce, ...stable } = params;
  return stable;
}

// ✅ 方案 3: 增大缓存容量
const optimizer = new CostOptimizer({
  cacheMaxSize: 5000  // 从 1000 增加到 5000
});

// ✅ 方案 4: 检查请求设置
// 确保真正可缓存的请求设置了 cacheable: true
const requests = [
  { id: 1, type: 'search', params: { q: 'OpenClaw' }, cacheable: true } // ✅
  // { id: 2, ..., cacheable: false } // ❌ 仅对实时性要求高的禁用
];
```

**验证**:

```bash
# 运行测试，观察命中率是否改善
CACHE_TTL=1200 CACHE_MAX_SIZE=5000 npm test
期望: 缓存命中率 >60%
```

---

### Q2: 内存占用过高

**症状**:
- Node.js 进程内存持续增长
- `top` 或 `htop` 显示内存占用 > 500MB

**可能原因**:

1. **缓存过大**
   - `CACHE_MAX_SIZE` 设置过高
   - 缓存值太大（大对象未压缩）

2. **批处理队列积压**
   - `BATCH_SIZE` 太大，批次处理慢
   - 请求速率 > 处理速率

3. **内存泄漏**
   - 缓存键未清理
   - 外部引用未释放

**解决方案**:

```javascript
// ✅ 方案 1: 限制缓存大小
const optimizer = new CostOptimizer({
  cacheMaxSize: 1000,  // 降低
  cacheTTL: 300        // 缩短 TTL，加速老化
});

// ✅ 方案 2: 主动清理（定期）
setInterval(() => {
  console.log(`清理前缓存大小: ${optimizer.cache.size}`);
  // LRU 会自动驱逐，也可手动 reset（会清空所有缓存）
  // optimizer.cache.delete('some-key'); // 选择性删除
}, 60 * 60 * 1000); // 每小时

// ✅ 方案 3: 监控内存
setInterval(() => {
  const mem = process.memoryUsage();
  console.log(`RSS: ${Math.round(mem.rss / 1024 / 1024)}MB`);
  if (mem.rss > 500 * 1024 * 1024) {
    console.warn('⚠️  内存过高，考虑优化');
  }
}, 60 * 1000);
```

---

### Q3: 批处理未生效

**症状**:
- 预期批处理合并多个请求，但实际每次都是独立请求
- `batchesProcessed` 数量接近 `totalRequests`

**可能原因**:

1. **请求发送间隔 > 100ms**
   - 当前实现超时窗口为 100ms
   - 请求分散发送，未达到 `batchSize` 且超时前只有单请求

2. **请求类型/参数差异大**
   - 缓存键不同，但批处理逻辑也考虑类型一致性
   - 需检查 `generateCacheKey` 实现

3. **异步处理顺序问题**
   - 多个 `batchRequest()` 调用的 promise 顺序问题

**解决方案**:

```javascript
// ✅ 方案 1: 聚合请求再提交
const requests = [];
for (let i = 0; i < 100; i++) {
  requests.push({
    id: i,
    type: 'api-call',
    params: { q: `query-${i}` },
    cacheable: true
  });
}

// 一次性提交
await optimizer.batchRequest(requests);

// ✅ 方案 2: 调整 batch timeout (需修改源码)
// 在 optimizer.js 中调整:
// this.batchTimeout = setTimeout(() => this.processBatch(), 200); // 改为 200ms

// ✅ 方案 3: 减小 batchSize，更快触发
const optimizer = new CostOptimizer({
  batchSize: 5  // 5 个请求即触发批处理
});
```

**验证**:

```javascript
// 在代码中插入调试日志
console.log(`队列长度: ${optimizer.batchQueue.length}`);
console.log(`待处理批次: ${optimizer.batchQueue.length}`);

const metrics = optimizer.getMetrics();
console.log(`批处理次数: ${metrics.batchesProcessed}`);
console.log(`平均批次大小: ${metrics.avgBatchSize}`);
期望: avgBatchSize 接近 config.batchSize
```

---

### Q4: 路由决策不准确

**症状**:
- 期望选择低成本端点，但选择了高成本端点
- 成本节省不明显

**可能原因**:

1. **成本矩阵缺失**
   - 自定义端点未添加到 `costMatrix`
   - 默认矩阵不包含您的端点

2. **路由策略设置错误**
   - 使用 `adaptive` 但期望成本优先
   - 误设为 `performance-first`

3. **评分算法误解**
   - `adaptive` 权重: cost 0.5, latency 0.7, reliability 0.6
   - 某些端点因延迟/可用性优势得分更高，即使成本略高

**解决方案**:

```javascript
// ✅ 方案 1: 自定义成本矩阵
optimizer.costMatrix['my-endpoint'] = {
  cost: 0.01,        // 极低成本
  latency: 50,       // 中等延迟
  reliability: 0.99  // 高可用性
};

// ✅ 方案 2: 明确指定策略
const optimizer = new CostOptimizer({
  routingStrategy: 'cost-first'  // 保证成本优先
});

// ✅ 方案 3: 调试路由决策
const debugRoute = (type) => {
  const decision = optimizer.selectOptimalRoute(type);
  console.log(`端点: ${decision.endpoint}`);
  console.log(`成本: $${decision.estimatedCost}`);
  console.log(`延迟: ${decision.estimatedLatency}ms`);
  console.log(`评分: ${decision.score.toFixed(4)}`);

  // 遍历所有端点，对比
  for (const [endpoint, data] of Object.entries(optimizer.costMatrix)) {
    console.log(`  ${endpoint}: 成本$${data.cost}, 延迟${data.latency}ms, 可用性${data.reliability}`);
  }
};

debugRoute('api-call');
```

**验证**:

```javascript
// 多次测试，统计端点分布
const counts = {};
for (let i = 0; i < 100; i++) {
  const { endpoint } = optimizer.selectOptimalRoute('test', 'cost-first');
  counts[endpoint] = (counts[endpoint] || 0) + 1;
}
console.log('端点分布:', counts);
期望: 最低成本端点占比 >80%
```

---

### Q5: 压缩未生效

**症状**:
- `compressionSavings` 始终为 0
- 大对象缓存后大小未减少

**可能原因**:

1. **压缩阈值过高**
   - 代码中阈值固定为 1024 字节
   - 小于 1KB 的对象不压缩

2. **数据本身已高度压缩**
   - JSON 已经是紧凑格式， whitespace 移除效果有限
   - 二进制数据未处理

3. **压缩实现简单**
   - 当前仅移除 whitespace，压缩比有限
   - 生产环境应使用 zlib/gzip

**解决方案**:

当前实现为演示级压缩（仅移除 JSON whitespace）。如需更强压缩：

```javascript
// ✅ 方案: 使用实际压缩库（需修改源码）
// 修改 optimizer.js 中的 compressData:
import { gzip } from 'zlib';
import { promisify } from 'util';
const gzipAsync = promisify(gzip);

async compressData(data) {
  const str = JSON.stringify(data);
  if (str.length < 1024) return data;

  try {
    const compressed = await gzipAsync(str, { level: this.config.compressionLevel });
    return {
      __compressed: true,
      data: compressed.toString('base64'),
      __originalSize: str.length
    };
  } catch (e) {
    return data; // 压缩失败，返回原数据
  }
}

// 相应修改 decompressIfIfNeeded:
async decompressIfNeeded(cached) {
  if (cached?.__compressed) {
    const buffer = Buffer.from(cached.data, 'base64');
    const decompressed = await promisify(zlib.gunzip)(buffer);
    return JSON.parse(decompressed.toString());
  }
  return cached;
}
```

**验证**:

```javascript
const bigData = { text: 'A'.repeat(10000) }; // 10KB
const result = await optimizer.set('test', bigData);
console.log(`原始: ${result.originalSize}, 压缩后: ${result.compressedSize}, 节省: ${result.saved}`);
```

---

## 🐛 已知限制

### 1. 批处理异步合并

当前批次在 100ms 超时窗口或达到 `batchSize` 时触发。如果请求间隔 >100ms，可能无法合并。

**影响**: 大文件上传、流式场景批处理效果不佳。

**workaround**: 主动聚合请求，一次性调用 `batchRequest()`。

### 2. 缓存键生成简单

`generateCacheKey` 仅基于 `type` 和 `params` 的 JSON stringify。

**问题**:
- 参数顺序不同但语义相同会被视为不同键
- 大型参数对象导致键过长

**建议**: 根据业务实现自定义 `generateCacheKey`，使用 hash 或规范化。

### 3. 单实例内存缓存

默认使用内存 LRU，多实例部署时缓存不共享。

**影响**: 集群场景缓存利用率低。

**解决方案**: 集成 Redis（需扩展 `CostOptimizer` 类，覆盖 `get/set`）。

---

## 🔧 性能调优排查流程

### Step 1: 收集基准数据

```bash
# 运行 benchmark，记录 baseline
npm run benchmark > baseline.txt

# 记录当前配置
env | grep -E 'CACHE|BATCH|ROUTING' > config.txt
```

### Step 2: 分析指标

```javascript
// 插入代码打印详细指标
const m = optimizer.getMetrics();
console.table({
  '总请求': m.totalRequests,
  '缓存命中率': `${m.cacheHitRate}%`,
  '吞吐量': `${m.requestsPerSecond} req/s`,
  '平均批次大小': m.avgBatchSize,
  '缓存使用': `${m.cacheSize}/${m.cacheLimit}`,
  '压缩节省': `${m.compressionSavings} bytes`,
  '路由决策': m.routingOptimizations
});
```

### Step 3: 针对性调整

根据指标调整参数（参考 [README.md](README.md) 的调优指南）。

### Step 4: 对比验证

```bash
# 调整配置后重新 benchmark
CACHE_TTL=600 npm run benchmark > tuned.txt

# 对比关键指标
grep -E 'Cache hit rate|Throughput' tuned.txt
```

---

## 🎯 诊断工具

### 内置诊断命令

```bash
# 1. 完整测试运行（包含示例）
npm test

# 2. 性能基准测试
npm run benchmark

# 3. 自定义迭代次数
npm run benchmark -- --iterations 1000

# 4. 查看环境变量
node -e "console.log(process.env.CACHE_TTL, process.env.BATCH_SIZE)"
```

### 自定义诊断脚本

```javascript
// diagnose.js
import { CostOptimizer } from './scripts/optimizer.js';

async function diagnose() {
  const optimizer = new CostOptimizer();

  console.log('=== Cost Optimizer 诊断 ===\n');

  // 1. 检查配置
  console.log('📋 当前配置:');
  console.log(optimizer.config);

  // 2. 检查成本矩阵
  console.log('\n🗺️  成本矩阵:');
  for (const [endpoint, data] of Object.entries(optimizer.costMatrix)) {
    console.log(`  ${endpoint}: $${data.cost}/${data.latency}ms/${data.reliability}`);
  }

  // 3. 测试路由决策
  console.log('\n🧭 路由测试 (10次):');
  const routeCounts = {};
  for (let i = 0; i < 10; i++) {
    const { endpoint } = optimizer.selectOptimalRoute('test');
    routeCounts[endpoint] = (routeCounts[endpoint] || 0) + 1;
  }
  console.log(routeCounts);

  // 4. 测试缓存
  console.log('\n💾 缓存测试:');
  await optimizer.set('key1', { large: 'data'.repeat(1000) });
  const { hit } = await optimizer.get('key1');
  console.log(`  测试命中: ${hit ? '✅' : '❌'}`);
  console.log(`  缓存大小: ${optimizer.cache.size}`);

  // 5. 测试批处理
  console.log('\n📦 批处理测试 (20请求):');
  const reqs = Array.from({ length: 20 }, (_, i) => ({
    id: i, type: 'test', params: { i }, cacheable: true
  }));
  await optimizer.batchRequest(reqs);
  const m = optimizer.getMetrics();
  console.log(`  批次处理数: ${m.batchesProcessed}`);
  console.log(`  平均批次大小: ${m.avgBatchSize}`);

  // 6. 总结建议
  console.log('\n💡 建议:');
  if (m.cacheHitRate < 30) {
    console.log('  - 缓存命中率低，建议增大 CACHE_TTL 或 CACHE_MAX_SIZE');
  }
  if (m.avgBatchSize < optimizer.config.batchSize * 0.8) {
    console.log('  - 批处理未充分利用，检查请求发送频率或减小 BATCH_SIZE');
  }
}

diagnose().catch(console.error);
```

运行:
```bash
node diagnose.js
```

---

## 🆘 求助渠道

### 1. 查看日志

启用详细日志（修改 `optimizer.js` 或设置 `LOG_LEVEL=debug`）:

```javascript
// 在 optimizer.js 构造函数中添加
if (process.env.LOG_LEVEL === 'debug') {
  this.debug = true;
  this.on('debug', console.debug);
}
```

### 2. 检查依赖

```bash
# 确保依赖安装正确
npm ls

# 重新安装
rm -rf node_modules package-lock.json
npm install
```

### 3. Node.js 版本

要求 >= 18.0.0:

```bash
node --version  # 应显示 v18.x 或更高
```

### 4. OpenClaw 兼容性

确认 OpenClaw 版本支持 ES Modules:

```bash
openclaw --version  # >= 1.5.0
```

---

## 📊 性能问题自查表

| 问题 | 检查点 | 解决 |
|------|--------|------|
| 缓存命中率低 | TTL 太短？参数不固定？ | ↑ TTL, 规范化参数 |
| 内存占用高 | 缓存容量太大？对象太大？ | ↓ cacheMaxSize, 压缩 |
| 吞吐量低 | 批处理未触发？批次太小？ | 聚合请求, ↑ batchSize |
| 路由不合理 | 成本矩阵不全？策略错误？ | 添加矩阵, 设 cost-first |
| 压缩无效 | 对象 <1KB？压缩阈值？ | 检查大小, 降低阈值 |

---

## 🔍 调试技巧

### 1. 插入断点

```javascript
// 在 optimizer.js 中关键位置
console.debug('[DEBUG]', { key, value, hit });  // get()
console.debug('[DEBUG]', { route, score });      // selectOptimalRoute()
```

### 2. 追踪单个请求

```javascript
const req = { id: 'debug-1', type: 'test', params: { q: 'test' }, cacheable: true };

console.time('batch');
await optimizer.batchRequest([req]);
console.timeEnd('batch');

console.log('指标:', optimizer.getMetrics());
console.log('缓存大小:', optimizer.cache.size);
```

### 3. 内存分析

```bash
# 使用 Node.js 内置检查器
node --inspect scripts/optimizer.js --test

# Chrome 打开 chrome://inspect，查看堆内存
```

---

## 📝 日志级别

建议的日志配置:

```javascript
const logLevel = process.env.LOG_LEVEL || 'info';

const logger = {
  debug: (...args) => { if (logLevel === 'debug') console.debug('[DEBUG]', ...args); },
  info: (...args) => { if (['info','debug'].includes(logLevel)) console.info('[INFO]', ...args); },
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};
```

---

## 🚀 升级检查清单

从旧版本升级时:

- [ ] 阅读 [CHANGELOG.md](CHANGELOG.md)（如有）
- [ ] 备份当前配置和缓存（如需保留数据）
- [ ] 检查配置项变更（新增/废弃参数）
- [ ] 运行 `npm install` 更新依赖
- [ ] 执行 `npm test` 确保功能正常
- [ ] 运行 benchmark 对比性能
- [ ] 监控生产环境至少 24 小时

---

## 📞 获取帮助

如果以上步骤仍无法解决问题:

1. **查看 API 文档**: [API.md](API.md)
2. **搜索 Issues**: https://github.com/openclaw/openclaw/issues?q=cost-optimizer
3. **提交 Issue**，提供:
   - Node.js 版本
   - OpenClaw 版本
   - 完整错误日志
   - 复现步骤
   - 配置片段（移除敏感信息）

---

**文档版本**: 1.0.0  
**最后更新**: 2025-03-08
