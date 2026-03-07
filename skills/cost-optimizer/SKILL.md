# Cost Optimizer Skill

A comprehensive cost optimization system for OpenClaw that provides intelligent routing, caching management, batch compression, and performance monitoring to minimize operational costs while maintaining performance.

## Features

- **Intelligent Routing**: Route requests to the most cost-effective endpoints based on real-time metrics
- **Cache Management**: Multi-level caching with configurable TTL and eviction policies
- **Batch Compression**: Compress multiple operations into batches to reduce API calls
- **Performance Monitoring**: Track metrics and provide cost-performance insights
- **Auto-Scaling**: Dynamically adjust optimization strategies based on load

## Configuration

The skill uses the following configuration (can be provided via environment variables or config file):

```
CACHE_TTL=300                # Cache TTL in seconds
CACHE_MAX_SIZE=1000         # Maximum cache entries
BATCH_SIZE=10               # Maximum batch size
ROUTING_STRATEGY=adaptive   # routing strategy: adaptive, cost-first, performance-first
COMPRESSION_LEVEL=6         # Compression level 1-9
MONITOR_INTERVAL=60         # Monitoring interval in seconds
```

## Usage

```bash
# Install dependencies
npm install

# Run optimizer
npm run optimize

# Run tests
npm test

# Run benchmark
npm run benchmark
```

## Output

The optimizer provides:
- Cost savings recommendations
- Cache hit rates
- Compression ratios
- Performance metrics
- Routing efficiency reports

## Integration

This skill integrates with OpenClaw's skill system and can be invoked by other skills via the standard skill interface.

```javascript
// Example invocation
const result = await invoke('cost-optimizer', {
  action: 'optimize',
  data: [...]
});
```

## Metrics Exposed

- `cache_hit_rate`: Percentage of requests served from cache
- `compression_ratio`: Average compression achieved
- `routing_cost_saved`: Estimated cost savings from optimal routing
- `batch_efficiency`: Number of operations per batch
- `total_requests`: Total requests processed
- `avg_response_time`: Average response time in ms

## License

MIT