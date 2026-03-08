# 回归测试报告
## Security Hardening Skill - Final Report

**测试日期**: 2026-03-08  
**测试人员**: QA Tester (安全方向)  
**测试对象**: security-hardening skill  
**测试环境**: OpenClaw, Node.js v24.13.0, Linux  
**报告版本**: 1.0

---

## 执行摘要

对 security-hardening skill 进行了系统性回归测试，覆盖 **四个核心验证点**：

| 验证项 | 状态 | 优先级 | 说明 |
|--------|------|--------|------|
| 1️⃣ .cjs 文件扫描 | ❌ 失败 | P0 | 所有规则的 file_extensions 缺少 `.cjs` |
| 2️⃣ Guard ESM 模式 | ⚠️ 部分通过 | P0 | 类可工作，但缺少 CLI 入口，spawnSync 未导入 |
| 3️⃣ 日志文件保护 | ✅ 通过 | - | 权限 0o600 正确设置 |
| 4️⃣ POC 攻击测试 | ⚠️ 71.4% (10/14) | P1 | 多数攻击被阻断，4 项漏检 |

**总体评估**: ❌ **不建议生产部署**，关键问题需修复。

---

## 详细测试结果

### 1️⃣ .cjs 文件扫描测试

#### 测试方法
- 创建包含 `eval()` 的 `test.cjs` 文件
- 运行 `node scripts/scanner.js --file test.cjs`

#### 期望结果
应检测到 **EXEC-001** (eval 使用) 违规。

#### 实际结果
```
❌ 未检测到任何违规
```

#### 根本原因
所有 8 个规则文件的 `match.file_extensions` 仅包含:
```json
[".js", ".mjs", ".ts"]
```
**CommonJS 模块 (.cjs) 完全未被覆盖**。

#### 影响
- CommonJS 模块绕过安全检查
- 潜在的安全盲区
- 不符合现代 Node.js 双模块系统支持

#### 修复建议
**立即修改**: 在每个规则文件的 `file_extensions` 添加 `.cjs`:

```json
// 所有规则文件应修改为:
"file_extensions": [".js", ".mjs", ".cjs", ".ts"]
```

**建议工具脚本**:
```bash
# 批量添加 .cjs 支持
find rules/ -name '*.json' -exec sed -i 's/\[".js", ".mjs", ".ts"\]/[".js", ".mjs", ".cjs", ".ts"]/g' {} \;
```

---

### 2️⃣ Guard ESM 模式运行测试

#### 测试方法
- 通过编程方式实例化 `RuntimeGuard`
- 加载规则、初始化、测试匹配

#### 通过项 ✅
- **ESM 导入正常**: Guard 类可在 ESM 模块中正常 import
- **规则加载**: 成功加载 55 条规则
- **匹配引擎**: .js 和 .mjs 文件匹配正确
- **架构设计**: 类结构清晰，patch 机制合理

#### 发现 Bugs ❌

**Bug 1: spawnSync 未导入导致崩溃**
```javascript
// Line 59 in guard.js
const cp = { exec, execSync, spawn, spawnSync, fork };
//                               ^^^^^^^^^ missing import!
```

**Import 语句**:
```javascript
import { spawn, exec, execSync, fork } from 'child_process';
// spawnSync is NOT in the list
```

**影响**: 调用 `patchChildProcess()` 时抛出 `ReferenceError: spawnSync is not defined`

**修复**: 添加 `spawnSync` 到导入列表。

---

**Bug 2: 缺少 CLI 入口点**

guard.js **没有**类似 scanner.js 的 CLI 入口:
```javascript
if (import.meta.url === `file://${process.argv[1]}`) {
  // parse args and run
}
```

**影响**: 无法使用文档中的 `node guard.js --protect app.js` 命令。

**修复**: 添加 CLI 实现，包括:
1. 解析 `--protect`, `--monitor`, `--rules`, `--logFile`, `--logLevel` 参数
2. 加载规则并调用 `guard.protect(process)`
3. 动态加载并执行目标应用 (使用 `import()` 或 `eval` in sandbox)

---

**Bug 3: 日志文件路径未解析**

测试显示:
```
📝 Audit logging to: undefined
```

Logger 初始化可能失败或路径未正确拼接。

**排查**: `__dirname` 定义为 `join(__filename, '..', '..')`，应指向 skill 根目录，需验证 `join(__dirname, 'logs', filename)` 是否有效。

---

### 3️⃣ 日志文件保护测试 ✅

#### 测试方法
- 手动创建日志文件
- 检查权限设置
- 验证 Logger.chmod(0o600)

#### 结果
```
✅ 日志目录创建成功
✅ 日志文件写入正常
✅ 权限正确设置为 0o600 (rw-------)
✅ 追加写入功能正常
```

#### 结论
**日志文件保护机制正确实现**，符合安全最佳实践:
- 仅所有者可读写
- 原子写入 (tmp + rename)
- 支持轮转

---

### 4️⃣ POC 攻击测试

#### 测试覆盖
14 种常见攻击模式，涵盖 55 条规则中的关键项。

#### 通过率: 10/14 (71.4%)

| # | 攻击模式 | 规则 | 状态 | 说明 |
|---|----------|------|------|------|
| 1 | eval() 注入 | EXEC-001 | ✅ | 正确阻断 |
| 2 | Function() 构造器 | EXEC-002 | ✅ | 正确阻断 |
| 3 | setTimeout 字符串 | EXEC-003 | ✅ | 正确阻断 |
| 4 | 路径遍历 (`../`) | FS-001 | ✅ | 正确阻断 |
| 5 | 私钥读取 (`/home/user/.ssh/id_rsa`) | FS-003 | ❌ | 未检测 |
| 6 | 私有 IP 连接 (`169.254.169.254`) | NET-001 | ❌ | 未检测 |
| 7 | 云元数据访问 | NET-002 | ✅ | 正确阻断 |
| 8 | process.exit() | PROC-001 | ❌ | 未检测 |
| 9 | 动态 require | MOD-001 | ✅ | 正确阻断 |
|10 | 弱加密 (MD5) | CRYPTO-001 | ✅ | 正确阻断 |
|11 | innerHTML XSS | WEB-001 | ✅ | 正确阻断 |
|12 | 原型污染 (`Object.assign(Object.prototype, ...)`) | DATA-003 | ❌ | 未检测 |
|13 | .cjs 扩展支持 | - | ⚠️ | 按预期未检测 (不支持的扩展) |
|14 | .mjs 扩展支持 | EXEC-001 | ✅ | 正确阻断 |

#### 漏检分析

**1. FS-003 (私钥读取)**
- **测试代码**: `fs.readFileSync('/home/user/.ssh/id_rsa');`
- **规则模式**: 未明确看到路径匹配，可能需要更直接的路径检查
- **建议**: 添加 regex 路径检测:
  ```json
  "match": {
    "type": "regex",
    "pattern": "(?:/home/[^/]+/.ssh/id_rsa|/etc/ssh/ssh_host_|.pem\\b)",
    "file_extensions": [...]
  }
  ```

**2. NET-001 (私有 IP 连接)**
- **测试代码**: `http.request({hostname: '169.254.169.254'});`
- **规则类型**: AST 模式 `CallExpression[callee.name='http']` 可能不匹配
- **原因**: `http.request` 的调用方式 AST 为 `MemberExpression` (callee.property.name='request')
- **建议**: 扩展 AST 模式:
  ```
  CallExpression[callee.name='http'][callee.property.name='request']
  ```
  或增强 regex 后备

**3. PROC-001 (process.exit)**
- **测试代码**: `process.exit(0);`
- **规则类型**: AST 模式
- **问题**: scanner 的 `astToRegex` 后备可能未覆盖此模式
- **建议**: 确保 regex: `process\.exit\s*\("

**4. DATA-003 (原型污染)**
- **测试代码**: `Object.assign(Object.prototype, {isAdmin: true});`
- **当前 pattern**: `(?:\\.__proto__|constructor\\.prototype)\\s*[=:]`
- **漏检原因**: 测试代码使用 `Object.assign(Object.prototype, ...)` 不包含 `__proto__` 或 `constructor.prototype` 的赋值
- **建议**: 添加检测 `Object\.assign\s*\(\s*Object\.prototype\s*,` 的模式

---

## 总体评分

| 维度 | 评分 (满分 10) | 说明 |
|------|----------------|------|
| **功能完整性** | 7/10 | 核心扫描工作，但 Guard 不完整 |
| **ESM 兼容性** | 8/10 | 能在 ESM 下运行，CLI 缺失 |
| **规则覆盖** | 6/10 | 多数攻击可检测，存在盲区 |
| **代码质量** | 7/10 | 结构清晰，有小 bug |
| **可靠性** | 7/10 | 日志保护 OK，部分规则弱 |
| **文档一致性** | 5/10 | Guard CLI 文档与实际不符 |

**综合得分**: 6.5/10

---

## 关键问题汇总

### 🔴 P0 (立即修复)
| ID | 问题 | 影响 | 建议修复 |
|----|------|------|----------|
| P0-1 | 所有规则缺少 `.cjs` 扩展 | 安全盲区 | 批量添加 `.cjs` 到 file_extensions |
| P0-2 | guard.js: spawnSync 未导入 | 运行时崩溃 | `import { spawnSync }` |
| P0-3 | guard.js: 缺少 CLI 入口 | 无法按文档使用 | 实现 CLI (if import.meta.url) |
| P0-4 | Logger 路径显示 `undefined` | 日志可能丢失 | 修复路径拼接逻辑 |

### 🟠 P1 (高优先级)
| ID | 问题 | 影响 | 建议 |
|----|------|------|------|
| P1-1 | FS-003 漏检私钥读取 | 私钥泄露风险 | 增强路径匹配 pattern |
| P1-2 | NET-001 漏检私有 IP | 内网探测风险 | 扩展 AST pattern 覆盖 `http.request` |
| P1-3 | PROC-001 漏检 exit | 进程退出绕过 | 添加 regex: `process\.exit\s*\(` |

### 🟡 P2 (中等优先级)
| ID | 问题 | 建议 |
|----|------|------|
| P2-1 | DATA-003 漏检 Object.assign 原型污染 | 扩展 pattern 检测 `Object.assign(Object.prototype` |
| P2-2 | 部分规则 regex 后备弱 (AST 模式) | 增强 `astToRegex` 转换覆盖率 |
| P2-3 | 规则文件重复代码 | 提取公共配置模板 |
| P2-4 | 单元测试覆盖不足 | 增加集成测试套件 |

---

## 建议修复步骤

### 阶段 1: 紧急修复 (1-2 天)
1. ✅ 批量更新所有规则添加 `.cjs`
2. ✅ 修复 guard.js `spawnSync` 导入
3. ✅ 实现 guard.js CLI 入口
4. ✅ 修复 Logger 路径解析

### 阶段 2: 优化规则 (2-3 天)
1. 🔧 增强 FS-003 pattern
2. 🔧 优化 NET-001 AST 模式
3. 🔧 修复 PROC-001 regex 后备
4. 🔧 扩展 DATA-003 pattern

### 阶段 3: 测试验证 (1 天)
1. 🧪 重新运行全部 POC 测试 (预期 14/14 通过)
2. 🧪 验证 .cjs 文件扫描
3. 🧪 测试 Guard CLI 保护真实应用
4. 📋 更新文档和 README

### 阶段 4: 发布准备
1. 📝 更新版本号 (1.0.1)
2. 📄 生成新的发布报告
3. ✅ 最终回归测试通过
4. 🚀 部署到生产

---

## 测试结论

**当前状态**: ❌ **未通过回归测试**

**主要风险**:
- ❌ CommonJS 模块安全盲区 (P0)
- ❌ Guard CLI 不可用 (P0)
- ⚠️ 部分攻击模式漏检 (P1)

**修复后预期**: ✅ **通过**，所有 P0/P1 问题解决。

**建议**: 立即执行 **阶段 1** 修复，然后重新测试验证。

---

## 附件

### 测试脚本
- `test-data/guard-test-runner.mjs` - Guard 功能测试
- `test-data/poc-test-runner.mjs` - POC 攻击测试套件
- `validate.mjs` - 快速验证脚本
- `test-log-protection.mjs` - 日志保护测试

### 测试数据
- `test-data/test.cjs` - .cjs 测试文件
- `test-data/execution-test.mjs` - Guard 执行测试
- `poc-tests/` - POC 攻击样本

### 日志
- `logs/` - 审计日志目录 (自动生成)

---

**报告结束**
