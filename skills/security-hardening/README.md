# Security Hardening Suite

> 🛡️ Comprehensive security toolkit for OpenClaw with 55 security rules, static scanning, runtime protection, Docker sandbox, and audit logging.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-required-blue)](https://docker.com)
[![License](https://img.shields.io/badge/license-MIT-green)]()
[![Status](https://img.shields.io/badge/status-production%20ready-success)]()

## 📋 Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [The 55 Security Rules](#the-55-security-rules)
- [Usage](#usage)
- [Configuration](#configuration)
- [Docker Sandbox](#docker-sandbox)
- [Integration](#integration)
- [Performance](#performance)
- [Troubleshooting](#troubleshooting)
- [Advanced](#advanced)

## ✨ Features

- **🔍 Static Scanner** - Analyze code for security vulnerabilities before deployment
- **🛡️ Runtime Guard** - Real-time protection by intercepting dangerous operations
- **🐳 Docker Sandbox** - Isolated execution environment with resource limits
- **📝 Audit Logger** - Complete security event logging with JSON format
- **📊 Rule Engine** - 55 configurable security rules across 8 categories
- **⚙️ Policy Manager** - Customizable security policies and thresholds

## 🚀 Quick Start

### Installation

```bash
cd skills/security-hardening
npm install
```

This installs:
- `dockerode` - Docker API client
- `chalk` - Terminal colors (optional)

### Basic Usage

**1. Scan code for vulnerabilities:**
```bash
node scripts/scanner.js --dir skills/
```

**2. Protect a Node.js process:**
```bash
# Protect your app
node scripts/guard.js --protect app.js

# Monitor mode (no blocking)
node scripts/guard.js --protect app.js --monitor

# Custom rules
node scripts/guard.js --protect app.js --rules rules/custom/
```

**3. Run in sandbox:**
```bash
# Simple execution
node scripts/sandbox.js --run script.js

# With resource limits
node scripts/sandbox.js --run script.js --memory 256m --cpu 1.0

# Interactive shell
node scripts/sandbox.js --shell
```

## 🏗️ Architecture

```
security-hardening/
├── SKILL.md              # Skill metadata and docs
├── package.json          # Dependencies
├── README.md             # This file
├── rules/                # 55 security rules (8 categories)
│   ├── index.js
│   ├── execution.json    # 10 rules
│   ├── filesystem.json   # 10 rules
│   ├── network.json     # 8 rules
│   ├── process.json     # 7 rules
│   ├── module.json      # 6 rules
│   ├── crypto.json      # 5 rules
│   ├── web.json         # 5 rules
│   └── data.json        # 4 rules
├── scripts/
│   ├── scanner.js        # Static analysis
│   ├── guard.js          # Runtime protection
│   ├── sandbox.js        # Docker sandbox
│   └── logger.js         # Audit logging
└── lib/
    ├── engine.js         # Core rule engine
    ├── matcher.js        # Pattern matching
    └── reporter.js       # Report generation
```

## 🎯 The 55 Security Rules

### Execution Safety (10 rules)
| Rule | Severity | Description |
|------|----------|-------------|
| EXEC-001 | 🔴 Critical | Block `eval()` |
| EXEC-002 | 🔴 Critical | Block `Function()` constructor |
| EXEC-003 | 🟠 High | Block `setTimeout(string)` |
| EXEC-004 | 🟠 High | Block `exec()` with unsanitized input |
| EXEC-005 | 🟠 High | Block `execSync()` |
| EXEC-006 | 🟡 Medium | Block `spawn()` with concatenation |
| EXEC-007 | 🟡 Medium | Block `fork()` with dynamic paths |
| EXEC-008 | 🔴 Critical | Block `require()` with user input |
| EXEC-009 | 🔴 Critical | Block `vm.runIn*` methods |
| EXEC-010 | 🟠 High | Detect command building via concatenation |

### File System Security (10 rules)
| Rule | Severity | Description |
|------|----------|-------------|
| FS-001 | 🔴 Critical | Block path traversal (`../`) |
| FS-002 | 🟠 High | Restrict `/etc/` access |
| FS-003 | 🔴 Critical | Prevent reading private keys |
| FS-004 | 🟠 High | Block world-writable files |
| FS-005 | 🟠 High | Prevent symlink following |
| FS-006 | 🟡 Medium | Restrict `chown` on system files |
| FS-007 | 🔴 Critical | Block recursive delete |
| FS-008 | 🟠 High | Prevent `/proc/` access |
| FS-009 | 🟡 Medium | Detect hardcoded credentials |
| FS-010 | 🟠 High | Block absolute writes outside allowed dirs |

### Network Security (8 rules)
| Rule | Severity | Description |
|------|----------|-------------|
| NET-001 | 🔴 Critical | Block private IP ranges |
| NET-002 | 🔴 Critical | Prevent metadata endpoint access |
| NET-003 | 🟠 High | Block non-HTTPS in production |
| NET-004 | 🟡 Medium | Detect hardcoded IPs/hosts |
| NET-005 | 🟠 High | Block `0.0.0.0` bind |
| NET-006 | 🟠 High | Block dangerous ports (22,23,3389) |
| NET-007 | 🟡 Medium | Detect DNS rebinding |
| NET-008 | 🟠 High | Prevent open redirects |

### Process Control (7 rules)
| Rule | Severity | Description |
|------|----------|-------------|
| PROC-001 | 🔴 Critical | Block `process.exit()` |
| PROC-002 | 🔴 Critical | Prevent `process.kill()` on non-children |
| PROC-003 | 🟠 High | Block `setuid/setgid` |
| PROC-004 | 🟠 High | Restrict `chdir()` |
| PROC-005 | 🟡 Medium | Block `umask()` modification |
| PROC-006 | 🟡 Medium | Detect daemonization |
| PROC-007 | ⚪ Low | Prevent signal handler manipulation |

### Module Security (6 rules)
| Rule | Severity | Description |
|------|----------|-------------|
| MOD-001 | 🔴 Critical | Block `require()` with user input |
| MOD-002 | 🟠 High | Prevent untrusted module paths |
| MOD-003 | 🟡 Medium | Detect npm config modifications |
| MOD-004 | 🔴 Critical | Block module cache manipulation |
| MOD-005 | 🔴 Critical | Prevent `module.constructor` access |
| MOD-006 | 🟠 High | Detect dynamic `require()` |

### Cryptography (5 rules)
| Rule | Severity | Description |
|------|----------|-------------|
| CRYPTO-001 | 🔴 Critical | Block weak hashes (MD5, SHA1) |
| CRYPTO-002 | 🟠 High | Block weak ciphers (DES, RC4) |
| CRYPTO-003 | 🔴 Critical | Detect hardcoded keys |
| CRYPTO-004 | 🟠 High | Block `Math.random()` for security |
| CRYPTO-005 | 🔴 Critical | Prevent SSL/TLS disabling |

### Web Security (5 rules)
| Rule | Severity | Description |
|------|----------|-------------|
| WEB-001 | 🔴 Critical | Block unsanitized innerHTML |
| WEB-002 | 🔴 Critical | Block dangerous DOM assignments |
| WEB-003 | 🟠 High | Detect DOM-based XSS |
| WEB-004 | 🟡 Medium | Block unsafe jQuery methods |
| WEB-005 | 🟠 High | Prevent `eval()` in browser |

### Data Validation (4 rules)
| Rule | Severity | Description |
|------|----------|-------------|
| DATA-001 | 🟠 High | Require try-catch for `JSON.parse()` |
| DATA-002 | 🟠 High | Block unsafe deserialization |
| DATA-003 | 🔴 Critical | Detect prototype pollution |
| DATA-004 | 🟡 Medium | Block loose equality (`==`) |

## 💻 Usage

### Static Scanner

```bash
# Scan a single file
node scripts/scanner.js --file server.js

# Scan a directory
node scripts/scanner.js --dir skills/

# Save JSON report
node scripts/scanner.js --dir . --format json --output scan-report.json

# Run tests
node scripts/scanner.js --test
```

**Output formats:**
- `text` (default) - Colored human-readable
- `json` - Machine-readable JSON
- `compact` - One line per violation

**Example output:**
```
🔍 Security Scan Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Files scanned: 127
⚠️  Total violations: 23
⛔ Blocked: 15
⚠️  Warnings: 8

📄 skills/example/server.js
   🔴 EXEC-001 - Block eval() usage
      Action: block
      💡 Fix: Use Function.prototype.apply or safe alternatives

   🟠 NET-003 - Block non-HTTPS URLs
      Action: warn
      💡 Fix: Use HTTPS for all external connections

━.━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ FAILED: 15 blocked, 8 warnings
```

### Runtime Guard

```bash
# Protect an application
node scripts/guard.js --protect app.js

# Monitor mode (log but don't block)
node scripts/guard.js --protect app.js --monitor

# Custom log location
node scripts/guard.js --protect app.js --logFile /var/log/security/audit.json

# Set log level
node scripts/guard.js --protect app.js --logLevel debug
```

**What gets patched:**
- `child_process.exec/spawn/fork`
- `fs.readFile/createReadStream/access`
- `process.exit/kill/chdir/umask`
- `vm.runIn*` methods
- `module.require` (dynamic)
- `http/https.request` (network filtering)
- `module.cache` manipulation

**Log format:**
```json
{
  "timestamp": "2025-03-08T04:30:00.000Z",
  "rule_id": "EXEC-001",
  "severity": "critical",
  "description": "Block eval() usage",
  "context": "eval",
  "args": ["userInput"],
  "action": "block",
  "pid": 12345,
  "type": "runtime"
}
```

### Docker Sandbox

```bash
# Run script in sandbox
node scripts/sandbox.js --run untrusted.js

# With custom resources
node scripts/sandbox.js --run script.js --memory 256m --cpu 0.5 --timeout 60s

# Interactive shell
node scripts/sandbox.js --shell

# Custom image (Node.js 20)
node scripts/sandbox.js --run script.js --image node:20-alpine
```

**Sandbox features:**
- Network isolation (`--network none`)
- Read-only root filesystem (except /tmp)
- Memory limits
- CPU limits
- PID limits
- `no-new-privileges` seccomp
- Automatic cleanup

**Example output:**
```
🐳 Starting sandbox...
   Image: node:18-alpine
   Memory: 512m
   CPU: 1.0
   Network: none
⏳ Waiting for completion...

(script output appears here)

📦 Container exited with code 0
```

### Logger

The logger runs automatically with guard and sandbox. Standalone usage:

```javascript
import { Logger } from '../scripts/logger.js';

const logger = new Logger({
  level: 'info',
  logFile: 'logs/security.log',
  maxSize: 100 * 1024 * 1024 // 100MB
});

await logger.log({
  level: 'warn',
  rule_id: 'TEST-001',
  description: 'Test violation',
  file: 'test.js',
  line: 42
});

// Query logs
const logs = await logger.query({
  level: 'error',
  since: '2025-03-07T00:00:00Z',
  limit: 100
});

// Tail logs (async iterator)
for await (const entry of logger.tail({ lastSize: 0 })) {
  console.log('New log:', entry);
}
```

## ⚙️ Configuration

### Rules

Edit JSON files in `rules/` directory:

```json
{
  "rule_id": "CUSTOM-001",
  "severity": "medium",
  "description": "My custom rule",
  "match": {
    "type": "regex",
    "pattern": "pattern-here",
    "file_extensions": [".js", ".ts"]
  },
  "action": "warn",
  "suggestion": "How to fix"
}
```

**Actions:**
- `block` - Prevent execution (throw error)
- `warn` - Log but allow
- `log` - Silent logging

### Security Policy

Create `security-policy.json`:

```json
{
  "allowed_paths": ["/app/", "/home/user/"],
  "blocked_hosts": ["evil.com", "malware.net"],
  "max_memory_mb": 512,
  "max_cpu_seconds": 30,
  "allow_network": true,
  "log_level": "info",
  "sandbox_defaults": {
    "memory": "512m",
    "cpu": 1.0,
    "timeout": 30000
  }
}
```

### Environment Variables

```bash
# Guard mode
export GUARD_ENABLED=true
export GUARD_RULES=custom-rules.json
export GUARD_LOG_LEVEL=debug

# Sandbox
export SANDBOX_IMAGE=node:20-alpine
export SANDBOX_NETWORK=none

# Logging
export SECURITY_LOG_DIR=/var/log/security
export SECURITY_LOG_LEVEL=info
```

## 🐳 Docker Sandbox

### Requirements
- Docker installed and running
- Current user in `docker` group (or root)
- Available disk space for images

### Images

**Pre-built:**
- `node:18-alpine` (default)
- `node:20-alpine`
- Custom: Build your own with `sandbox.buildImage(dockerfilePath)`

**Build custom:**
```javascript
const sandbox = new Sandbox();
await sandbox.buildImage('./Dockerfile.sandbox', 'my-sandbox:latest');
sandbox.options.image = 'my-sandbox:latest';
```

### Isolation Guarantees

| Feature | Implementation |
|---------|----------------|
| Filesystem | Read-only root, writable /tmp only |
| Network | `none` by default (or custom bridge) |
| Resources | Memory/cpu/PID limits enforced |
| Privileges | `no-new-privileges` flag |
| Seccomp | Default Docker profile + custom additions |
| User namespaces | Root inside = nobody outside |

**⚠️ Important:** Docker isolation is not a sandbox escape proof. For
highly untrusted code, consider gVisor, Kata Containers, or Firecracker.

### Advanced Sandbox Options

```javascript
const sandbox = new Sandbox({
  image: 'node:18-alpine',
  memory: '1g',
  cpu: 2.0,
  network: 'none',         // 'bridge' for internet access
  readOnly: true,          // Root fs read-only
  timeout: 60000,          // 60 second timeout
  workingDir: '/app',
  env: {
    NODE_ENV: 'production',
    PATH: '/usr/local/bin:/usr/bin'
  },
  mounts: [
    {
      Target: '/data',
      Source: '/host/data',
      Type: 'bind',
      ReadOnly: false
    }
  ]
});
```

## 🔌 Integration

### OpenClaw Skill

```bash
# Scan before installing new skills
node skills/security-hardening/scripts/scanner.js --dir skills/new-skill/

# Enable runtime protection globally
export GUARD_ENABLED=true
openclaw start

# Use sandbox for testing
node skills/security-hardening/scripts/sandbox.js --run skills/new-skill/test.js
```

### CI/CD Pipeline

```yaml
# GitHub Actions example
- name: Security Scan
  run: |
    cd skills/security-hardening
    npm ci
    node scripts/scanner.js --dir . --format json --output scan.json

- name: Fail on violations
  run: |
    if grep -q '"severity":"critical"' scan.json; then
      exit 1
    fi
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit
node skills/security-hardening/scripts/scanner.js --file $1 --format compact
if [ $? -ne 0 ]; then
  echo "❌ Security violations found"
  exit 1
fi
```

## 📊 Performance Impact

| Component | Overhead | Notes |
|-----------|----------|-------|
| **Static Scan** | Minimal | Pure I/O, no runtime impact |
| **Runtime Guard** | ~5-15% | Depends on workload and number of patches |
| **Docker Sandbox** | Moderate | Containerization overhead (~10-20%) |

**Tips to minimize impact:**
- Use static scanning for pre-deployment only
- Enable runtime guard only for production/test environments
- Cache Docker images
- Limit rule set to relevant rules only
- Use compiled JS (not transpiled TS) for guard

## 🚨 Troubleshooting

### Scanner

**Problem:** False positives  
**Solution:** Adjust regex patterns in `rules/*.json`. Add file-specific excludes.

**Problem:** Scanner too slow  
**Solution:** Use `--file` instead of `--dir`. Exclude `node_modules`. Cache results.

### Guard

**Problem:** Guard not blocking  
**Solution:** Verify `--monitor` not used. Check rule actions are `block`. Look for missed patches.

**Problem:** Application crashes under guard  
**Solution:** Run in `--monitor` mode first to identify violations. Adjust rules or whitelist.

**Problem:** High CPU usage  
**Solution:** Reduce number of enabled rules. Disable verbose logging.

### Sandbox

**Problem:** Connection refused  
**Solution:** `systemctl status docker` - ensure Docker daemon is running.

**Problem:** Permission denied on bind mount  
**Solution:** Ensure user in `docker` group: `sudo usermod -aG docker $USER`

**Problem:** Out of memory  
**Solution:** Increase memory limit: `--memory 1g` or higher. Check app memory usage.

**Problem:** Network needed?  
**Solution:** Use `--network bridge` or configured network. Expose ports with `-p`.

### Logs

**Problem:** Logs not writing  
**Solution:** Check write permissions in `logs/` directory. Check disk space.

**Problem:** Log files too large  
**Solution:** Configure rotation in `Logger` options. Periodically archive old logs.

## 🛠️ Advanced

### Custom Rule Development

```javascript
// rules/custom.json
[
  {
    "rule_id": "MY-001",
    "severity": "high",
    "description": "Custom XSS pattern",
    "match": {
      "type": "regex",
      "pattern": "document\\.write\\s*\\([^)]*(?:user|input)",
      "file_extensions": [".js", ".mjs"]
    },
    "action": "block",
    "suggestion": "Use textContent or sanitize input"
  }
]
```

Load custom rules:
```bash
node scripts/guard.js --protect app.js --rules ./rules/custom.json
```

### Programmatic API

```javascript
import RuleEngine from './lib/engine.js';
import Guard from './scripts/guard.js';
import Sandbox from './scripts/sandbox.js';

// Scanner
const engine = new RuleEngine();
await engine.loadRules('./rules');
const results = await engine.scanDirectory('./skills');

// Guard
const guard = new Guard({ action: 'warn', logLevel: 'debug' });
await guard.initialize('./rules');
guard.protect(); // Patches global require()

// Sandbox
const sandbox = new Sandbox({ memory: '1g', cpu: 2.0 });
const result = await sandbox.run('node app.js');
console.log(result.exitCode, result.logs);
```

### Emitting Custom Events

```javascript
import { EventEmitter } from 'events';

class CustomGuard extends Guard {
  constructor() {
    super();
    this.on('violation', (violation) => {
      console.log('Security event:', violation);
      // Send to SIEM, Slack, etc.
    });
  }
}
```

## 📚 Example Scenarios

### Protecting a Web API

```javascript
// server.js
import http from 'http';

const server = http.createServer((req, res) => {
  // Your code here (will be protected by guard)
});

// Enable protection
if (process.env.GUARD_ENABLED) {
  const guard = new Guard();
  guard.initialize().then(() => {
    guard.protect();
  });
}

server.listen(3000);
```

### Sandboxing User Scripts

```javascript
// Run untrusted user code in sandbox
const sandbox = new Sandbox({
  memory: '256m',
  cpu: 0.5,
  timeout: 30000
});

const userCode = await readFile('./user-script.js', 'utf-8');
await writeFile('/tmp/user-script.js', userCode);

const result = await sandbox.run('node', '/tmp/user-script.js');

if (!result.success) {
  console.error('User script violated security policy:', result.logs);
  // Notify admin, terminate session, etc.
}
```

### Continuous Monitoring

```bash
# cron job to scan daily
0 2 * * * cd /path/to/openclaw && \
  node skills/security-hardening/scripts/scanner.js --dir skills/ \
  --format json --output scans/$(date +\%Y\%m\%d).json
```

## 🔐 Security Considerations

1. **Defense in depth** - Use all three layers: scan → guard → sandbox
2. **Least privilege** - Restrict filesystem, network, and system calls
3. **Audit everything** - Log all violations to secure, immutable storage
4. **Keep updated** - Regularly add new rules for emerging threats
5. **Test thoroughly** - False positives can break legit functionality
6. **Monitor alerts** - Review logs daily for persistent violations
7. **Rotate logs** - Prevent disk exhaustion from logs

## 📈 Metrics & Alerting

Key metrics to monitor:
- `violations` - Total security violations (watch trends)
- `blocked_operations` - Attempted exploit blocks (critical)
- `sandbox_escapes` - Container escape attempts (immediate alert)
- `scan_coverage` - Percentage of code scanned

Sample alert threshold:
```bash
if violations > 10 OR blocked > 5; then
  send_alert_to_slack();
fi
```

## 🤝 Contributing

To add new rules:
1. Create rule in appropriate `rules/*.json` file
2. Test with scanner on known vulnerable code
3. Document severity and fix suggestion
4. Update this README with new rule count

## 📄 License

MIT - See LICENSE file for details.

## 🙏 Acknowledgments

- OWASP for security guidelines
- Node.js Security Working Group
- Docker security best practices
- OpenClaw community

---

**Status:** ✅ Production Ready  
**Maintained by:** Security Agent  
**Last Updated:** 2025-03-08
