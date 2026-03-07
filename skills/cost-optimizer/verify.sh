#!/bin/bash

# Cost Optimizer - 快速验证脚本
# 确保用户在 5 分钟内完成基本验证

echo "======================================"
echo "Cost Optimizer 快速验证"
echo "======================================"
echo ""

# 1. 检查 Node 版本
echo "1️⃣ 检查 Node.js 版本..."
NODE_VERSION=$(node --version 2>/dev/null || echo "未安装")
if [[ $NODE_VERSION == v18* ]] || [[ $NODE_VERSION == v20* ]] || [[ $NODE_VERSION == v22* ]]; then
  echo "✅ Node.js 版本: $NODE_VERSION"
else
  echo "❌ Node.js 未安装或版本过低（需要 >= 18）"
  exit 1
fi

# 2. 检查依赖安装
echo ""
echo "2️⃣ 检查依赖..."
if [ -d "node_modules" ]; then
  echo "✅ node_modules 存在"
else
  echo "⚠️  node_modules 不存在，运行: npm install"
  exit 1
fi

# 3. 运行测试
echo ""
echo "3️⃣ 运行测试示例..."
if npm test 2>&1 | grep -q "✅ Sample run completed successfully"; then
  echo "✅ 测试通过"
else
  echo "❌ 测试失败"
  exit 1
fi

# 4. 运行基准测试
echo ""
echo "4️⃣ 运行基准测试..."
npm run benchmark 2>&1 | grep -E "Benchmark Results|Throughput|Cache hit rate" || true

# 5. 检查文档
echo ""
echo "5️⃣ 检查文档..."
for doc in README.md API.md TROUBLESHOOTING.md; do
  if [ -f "$doc" ]; then
    echo "✅ $doc"
  else
    echo "❌ 缺失: $doc"
  fi
done

echo ""
echo "======================================"
echo "🎉 验证完成！建议下一步："
echo "  1. 阅读 README.md 了解使用方法"
echo "  2. 查看 API.md 学习高级功能"
echo "  3. 参考 TROUBLESHOOTING.md 解决疑难"
echo "======================================"
