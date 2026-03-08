---
name: security-hardening
description: Security Hardening Suite with static scanning, runtime protection, Docker sandbox, and audit logging
version: 1.0.0-beta.1
metadata:
  clawdbot:
    emoji: "🛡️"
    requires:
      bins: ["node", "docker"]
      env: ["DOCKER_HOST"]
    scripts:
      - "scripts/scanner.js"
      - "scripts/guard.js"
      - "scripts/sandbox.js"
---

# Security Hardening Suite

Comprehensive security toolkit for OpenClaw with **55 security rules**, static code analysis, runtime protection, Docker sandboxing, and complete audit logging.

## Features

- 🔍 **Static Scanner** - Analyzes code for security vulnerabilities
- 🛡️ **Runtime Guard** - Intercepts dangerous operations in real-time
- 🐳 **Docker Sandbox** - Isolated execution environment
- 📝 **Audit Logger** - Complete security event logging
- 📊 **Rule Engine** - 55 configurable security rules
- ⚙️ **Policy Manager** - Customizable security policies

## Quick Start

### Install Dependencies
```bash
cd skills/security-hardening
npm install
```

### 1. Static Scanning
Scan files or directories for security issues:
```bash
# Scan a file
node scripts/scanner.js --file path/to/file.js

# Scan a directory
node scripts/scanner.js --dir skills/

# Output format
node scripts/scanner.js --file app.js --format json
```

### 2. Runtime Protection
Enable runtime guard for a Node.js process:
```bash
# Protect a script
node scripts/guard.js --protect script.js

# With custom rules
node scripts/guard.js --protect script.js --rules custom-rules.json

# Monitor mode (no blocking)
node scripts/guard.js --protect script.js --monitor
```

### 3. Docker Sandbox
Execute code in isolated container:
```bash
# Run in sandbox
node scripts/sandbox.js --run script.js

# With resource limits
node scripts/sandbox.js --run script.js --memory 512m --cpu 1.0

# Interactive shell
node scripts/sandbox.js --shell
```

## Architecture

```
security-hardening/
├── SKILL.md                 # This file
├── package.json             # Dependencies
├── README.md                # Detailed documentation
├── rules/
│   ├── execution.json       # Execution control rules (10 rules)
│   ├── filesystem.json      # File system rules (10 rules)
│   ├── network.json         # Network rules (8 rules)
│   ├── process.json         # Process control rules (7 rules)
│   ├── module.json          # Module loading rules (6 rules)
│   ├── crypto.json          # Cryptography rules (5 rules)
│   ├── web.json             # Web security rules (5 rules)
│   └── data.json            # Data validation rules (4 rules)
├── scripts/
│   ├── scanner.js           # Static analysis engine
│   ├── guard.js             # Runtime protection
│   ├── sandbox.js           # Docker sandbox manager
│   └── logger.js            # Audit logging
└── lib/
    ├── engine.js            # Core rule engine
    ├── matcher.js           # Pattern matching
    └── reporter.js          # Report generation
```

## The 55 Security Rules

### Execution Safety (10 rules)
- Block `eval()` usage
- Block `Function()` constructor
- Block `setTimeout(string)` and `setInterval(string)`
- Block `exec()` / `execSync()` with user input
- Block `spawn()` / `spawnSync()` with unsanitized input
- Block `fork()` with dynamic paths
- Restrict `require()` with variable arguments
- Block `vm.runIn*` methods
- Prevent `new Function()` with dynamic code
- Detect string concatenation for command building

### File System Security (10 rules)
- Block path traversal (`../`, `..\\`)
- Restrict access to `/etc/`, `/root/`, Windows system dirs
- Prevent reading sensitive files (`.env`, `id_rsa`, etc.)
- Block world-writable file writes
- Prevent symlink following
- Restrict chmod/chown on sensitive paths
- Block recursive delete without confirmation
- Prevent reading `/proc/`, `/sys/`
- Detect hardcoded credentials in file operations
- Block绝对路径写入 outside allowed directories

### Network Security (8 rules)
- Block connections to private IPs (127.0.0.1, 10.0.0.0/8, etc.)
- Prevent connections to metadata endpoints (169.254.169.254)
- Block non-HTTPS in production
- Detect hardcoded IPs/hosts
- Prevent server.bind(0.0.0.0) in production
- Block connections to dangerous ports (22, 23, 3389)
- Detect DNS rebinding patterns
- Prevent open redirects

### Process Control (7 rules)
- Block `process.exit()`
- Prevent `process.kill()` on non-child processes
- Block `process.setuid()` / `setgid()`
- Prevent `process.chdir()` outside allowed paths
- Block `process.umask()` modification
- Detect daemonization attempts
- Prevent signal handler manipulation

### Module Security (6 rules)
- Block `require()` from user input
- Prevent loading from untrusted paths
- Detect `npm` config modifications
- Block module cache manipulation
- Prevent `module.constructor` access
- Detect dynamic `require()` with concatenation

### Cryptography (5 rules)
- Block weak algorithms (MD5, SHA1, DES, RC4)
- Prevent ECB mode usage
- Detect hardcoded secrets / keys
- Block insecure random (Math.random())
- Prevent SSL/TLS disabling

### Web Security (5 rules)
- Detect unsanitized user input in HTML
- Block `innerHTML` / `outerHTML` with user data
- Prevent DOM-based XSS patterns
- Detect unsafe jQuery methods
- Block `eval()` in browser context

### Data Validation (4 rules)
- Block JSON.parse() without try-catch
- Prevent eval-like deserialization
- Detect prototype pollution vectors
- Block unsafe type coercion patterns

## Configuration

### Rules Configuration
Edit JSON files in `rules/` directory to customize:

```json
{
  "rule_id": "EXEC-001",
  "severity": "high",
  "description": "Block eval() usage",
  "pattern": "eval\\s*\\(",
  "file_extensions": [".js", ".mjs"],
  "action": "block",
  "建议修复": "Use Function.prototype.apply or safe alternatives"
}
```

### Security Policy
Create `security-policy.json`:

```json
{
  "allowed_paths": ["/app/", "/home/user/"],
  "blocked_hosts": ["evil.com", "malware.net"],
  "max_memory_mb": 512,
  "max_cpu_seconds": 30,
  "allow_network": true,
  "log_level": "info"
}
```

## Audit Logging

All security events are logged to:
- Console (colored output)
- JSON log file: `logs/security-YYYY-MM-DD.json`
- syslog (if configured)

Log format:
```json
{
  "timestamp": "2025-03-08T04:30:00.000Z",
  "rule_id": "EXEC-001",
  "severity": "high",
  "file": "/app/server.js",
  "line": 42,
  "column": 15,
  "context": "eval(userInput)",
  "action": "blocked",
  "user": "admin",
  "process_id": 12345
}
```

## Docker Sandbox

### Requirements
- Docker installed and running
- User in `docker` group (or root)

### Container Features
- **Network isolation** - No external network by default
- **Filesystem isolation** - Read-only root, writable /tmp
- **Resource limits** - CPU, memory, PID limits
- **Seccomp profile** - Blocks dangerous syscalls
- **No new privileges** - Prevents privilege escalation
- **Read-only mounts** - Protects host filesystem

### Usage
```bash
# Simple execution
node scripts/sandbox.js --run script.js

# With full isolation
node scripts/sandbox.js --run script.js \
  --network none \
  --memory 256m \
  --cpu 0.5 \
  --readonly \
  --timeout 30s

# Interactive debugging
node scripts/sandbox.js --run script.js --interactive --tty
```

## Integration with OpenClaw

### As a Skill
This suite is designed as an OpenClaw skill:
- Run before deploying new skills
- Integrate into CI/CD pipeline
- Protect critical operations
- Monitor for anomalies

### Example Workflow
```bash
# 1. Scan new skill before installation
node skills/security-hardening/scripts/scanner.js --dir skills/new-skill/

# 2. Enable runtime protection
export GUARD_ENABLED=true
export GUARD_RULES=skills/security-hardening/rules/

# 3. Run in sandbox during testing
node skills/security-hardening/scripts/sandbox.js --run tests/

# 4. Review audit logs
tail -f logs/security-*.json
```

## Performance Impact

- **Static Scan**: Minimal (filesystem I/O)
- **Runtime Guard**: ~5-15% overhead (depends on workload)
- **Docker Sandbox**: Moderate (containerization overhead)

## Troubleshooting

### Guard not blocking?
Check if `--monitor` flag was not used. Guard blocks by default in `--protect` mode.

### Sandbox connection refused?
Ensure Docker daemon is running: `systemctl status docker`

### False positives?
Tune rules in `rules/*.json` or create custom rule overrides.

### Logs missing?
Check write permissions in `logs/` directory.

## Advanced Usage

### Custom Rule Development
Create new rule file:

```json
[
  {
    "rule_id": "CUSTOM-001",
    "severity": "medium",
    "description": "Custom security rule",
    "match": {
      "type": "regex",
      "pattern": "your-pattern-here",
      "file_extensions": [".js"]
    },
    "action": "warn",
    "suggestion": "Fix this by ..."
  }
]
```

### Rule Actions
- `block` - Prevent execution
- `warn` - Log but allow
- `log` - Silent logging only
- `isolate` - Run in sandbox automatically

### Programmatic API
```javascript
import { Scanner } from './lib/scanner.js';
import { Guard } from './lib/guard.js';
import { Sandbox } from './lib/sandbox.js';

// Static scan
const scanner = new Scanner();
const results = await scanner.scanFile('app.js');

// Runtime guard
const guard = new Guard({ rules: ['execution'], action: 'block' });
guard.protect(process);

// Docker sandbox
const sandbox = new Sandbox({ memory: '512m', cpu: 1.0 });
const output = await sandbox.run('node app.js');
```

## Security Best Practices

1. **Always scan** new code before deployment
2. **Run in sandbox** during development and testing
3. **Enable guard** in production for critical services
4. **Monitor logs** regularly for anomalies
5. **Keep rules updated** with latest threats
6. **Regular audits** - weekly security scans
7. **Least privilege** - restrict filesystem and network access
8. **Defense in depth** - Use all three layers (scan + guard + sandbox)

## Support

- Report issues: `logs/security-*.json`
- View help: `node scripts/scanner.js --help`
- Rule reference: See individual `rules/*.json` files

---

**Security Level**: High  
**Recommended For**: Production deployments, untrusted code, compliance environments  
**License**: MIT
