#!/usr/bin/env node

import { RuleEngine } from '../lib/engine.js';
import { Logger } from './logger.js';
import { readFile, writeFile, appendFile, unlink, rename, chmod, stat } from 'fs/promises';
import fs from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import Module from 'module';
import http from 'http';
import https from 'https';
import dns from 'dns';
import { spawn, spawnSync, exec, execSync, fork } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..', '..');

class RuntimeGuard {
  constructor(options = {}) {
    this.engine = new RuleEngine({
      action: options.action || 'block',
      monitor: options.monitor || false
    });
    this.logger = new Logger({
      level: options.logLevel || 'info',
      logFile: options.logFile || join(__dirname, 'logs', `security-${new Date().toISOString().split('T')[0]}.json`)
    });
    this.patched = new Set();
    this.originalMethods = new Map();
    this.options = options;
  }

  async initialize(rulesPath = null) {
    await this.engine.loadRules(rulesPath || join(__dirname, 'rules'));
    console.log(`🛡️  Runtime Guard initialized with ${this.engine.rules.length} rules`);
    console.log(`📝 Audit logging to: ${this.logger.logFile}`);
  }

  protect(target = process, context = 'runtime') {
    console.log(`🛡️  Protecting ${context}...`);

    // Patch dangerous methods
    this.patchChildProcess();
    this.patchFs();
    this.patchProcess();
    this.patchModule();
    this.patchEval();
    this.patchNetwork();

    // Global error handler
    this.installErrorHandler();

    console.log('✅ Runtime protection active');
  }

  patchChildProcess() {
    // Use imported functions instead of require to be ESM-compatible
    const cp = { exec, execSync, spawn, spawnSync, fork };

    if (this.patched.has('child_process')) return;

    Object.keys(cp).forEach(method => {
      const original = cp[method];
      this.originalMethods.set(`child_process.${method}`, original);

      cp[method] = (...args) => {
        const command = args[0];
        const violation = this.checkCommand(command, method);

        if (violation) {
          this.handleViolation({
            rule_id: violation.rule_id,
            severity: violation.severity,
            description: violation.description,
            context: `child_process.${method}`,
            args: args,
            action: violation.action
          });

          if (violation.action === 'block' && !this.options.monitor) {
            throw new Error(`Security violation: ${violation.description}`);
          }
        }

        return original.apply(null, args);
      };

      this.patched.add('child_process');
    });
  }

  checkCommand(command, method) {
    for (const rule of this.engine.rules) {
      if (!rule.match.file_extensions?.includes('.js')) continue;

      // Simplified pattern matching for command
      if (rule.match.type === 'regex') {
        const regex = new RegExp(rule.match.pattern, 'i');
        if (regex.test(String(command))) {
          return rule;
        }
      }
    }
    return null;
  }

  patchFs() {
    if (this.patched.has('fs')) return;

    const dangerousMethods = ['readFile', 'readFileSync', 'createReadStream', 'access', 'accessSync'];

    dangerousMethods.forEach(method => {
      const original = fs[method];
      this.originalMethods.set(`fs.${method}`, original);

      fs[method] = (...args) => {
        const path = args[0];

        if (typeof path === 'string') {
          const violation = this.checkPath(path);

          if (violation) {
            this.handleViolation({
              rule_id: violation.rule_id,
              severity: violation.severity,
              description: violation.description,
              context: `fs.${method}`,
              args: [path.substring(0, 100)],
              action: violation.action
            });

            if (violation.action === 'block' && !this.options.monitor) {
              throw new Error(`Security violation: ${violation.description}`);
            }
          }
        }

        return original.apply(fs, args);
      };
    });

    this.patched.add('fs');
  }

  checkPath(path) {
    for (const rule of this.engine.rules) {
      if (rule.rule_id.startsWith('FS-')) {
        if (rule.match.type === 'regex') {
          const regex = new RegExp(rule.match.pattern, 'i');
          if (regex.test(path)) {
            return rule;
          }
        }
      }
    }
    return null;
  }

  patchProcess() {
    const proc = process;

    if (this.patched.has('process')) return;

    const dangerousProps = ['exit', 'kill', 'chdir', 'umask', 'setuid', 'setgid'];

    dangerousProps.forEach(prop => {
      const original = proc[prop];
      this.originalMethods.set(`process.${prop}`, original);

      Object.defineProperty(proc, prop, {
        get() { return original; },
        set: (value) => {
          this.handleViolation({
            rule_id: `PROC-00X`,
            severity: 'high',
            description: `Attempt to modify process.${prop}`,
            context: 'process',
            action: 'warn'
          });

          if (!this.options.monitor) {
            throw new Error(`Cannot modify process.${prop} - security violation`);
          }
        }
      });
    });

    this.patched.add('process');
  }

  patchModule() {
    if (this.patched.has('module')) return;

    // Protect _load
    const originalLoad = Module._load;
    this.originalMethods.set('module._load', originalLoad);

    Module._load = function(request, parent, isMain) {
      // Check for dynamic require
      for (const rule of this.engine.rules) {
        if (rule.rule_id.startsWith('MOD-')) {
          if (rule.match.type === 'regex') {
            const regex = new RegExp(rule.match.pattern, 'i');
            if (regex.test(request)) {
              this.handleViolation({
                rule_id: rule.rule_id,
                severity: rule.severity,
                description: rule.description,
                context: 'module._load',
                args: [request],
                action: rule.action
              });

              if (rule.action === 'block' && !this.options.monitor) {
                throw new Error(`Security violation: ${rule.description}`);
              }
            }
          }
        }
      }

      return originalLoad.apply(this, arguments);
    }.bind(this);

    // Protect require.cache
    const originalCache = Module._cache;
    this.originalMethods.set('module._cache', originalCache);

    Object.defineProperty(Module, '_cache', {
      get() { return originalCache; },
      set: (value) => {
        this.handleViolation({
          rule_id: 'MOD-004',
          severity: 'critical',
          description: 'Attempt to modify module cache',
          context: 'module',
          action: 'block'
        });

        if (!this.options.monitor) {
          throw new Error('Cannot modify module cache - security violation');
        }
      }
    });

    this.patched.add('module');
  }

  patchEval() {
    if (this.patched.has('vm')) return;

    ['runInThisContext', 'runInNewContext', 'runInContext'].forEach(method => {
      const original = vm[method];
      this.originalMethods.set(`vm.${method}`, original);

      vm[method] = (...args) => {
        this.handleViolation({
          rule_id: 'EXEC-009',
          severity: 'critical',
          description: 'vm.runIn* method called',
          context: `vm.${method}`,
          action: 'block'
        });

        if (!this.options.monitor) {
          throw new Error('vm.runIn* methods are blocked - security violation');
        }

        return original.apply(vm, args);
      };
    });

    this.patched.add('vm');
  }

  patchNetwork() {
    if (this.patched.has('network')) return;

    // Patch http.request and https.request
    ['http', 'https'].forEach(moduleName => {
      const mod = moduleName === 'http' ? http : https;
      const originalRequest = mod.request;

      this.originalMethods.set(`${moduleName}.request`, originalRequest);

      mod.request = (...args) => {
        const options = args[0];
        const hostname = options?.hostname || options?.host;

        if (hostname) {
          const violation = this.checkHostname(hostname);

          if (violation) {
            this.handleViolation({
              rule_id: violation.rule_id,
              severity: violation.severity,
              description: violation.description,
              context: `${moduleName}.request`,
              args: [hostname],
              action: violation.action
            });

            if (violation.action === 'block' && !this.options.monitor) {
              throw new Error(`Blocked connection to ${hostname} - security violation`);
            }
          }
        }

        return originalRequest.apply(mod, args);
      };
    });

    this.patched.add('network');
  }

  checkHostname(hostname) {
    // Check for private IPs, metadata endpoints, etc.
    const privatePatterns = [
      /^127\.0\.0\.1$/,
      /^10\./,
      /^192\.168\./,
      /^172\.(1[6-9]|2[0-9]|3[01])/,
      /^169\.254\.169\.254$/,
      /^localhost$/i,
      /^100\.(6[4-9]|[7-8][0-9]|9[0-4])/ // 100.64.0.0/10
    ];

    for (const pattern of privatePatterns) {
      if (pattern.test(hostname)) {
        return {
          rule_id: 'NET-001',
          severity: 'critical',
          description: `Blocked connection to private/metadata endpoint: ${hostname}`,
          action: 'block'
        };
      }
    }

    // Check for HTTP in production
    if (hostname.startsWith('http://')) {
      return {
        rule_id: 'NET-003',
        severity: 'high',
        description: 'Non-HTTPS connection blocked',
        action: 'warn'
      };
    }

    return null;
  }

  installErrorHandler() {
    process.on('uncaughtException', (err) => {
      this.logger.log({
        level: 'error',
        message: 'Uncaught exception',
        error: err.message,
        stack: err.stack,
        type: 'runtime'
      });

      // Re-throw if not in monitor mode
      if (!this.options.monitor) {
        console.error('❌ Security violation - terminating');
        process.exit(1);
      }
    });

    process.on('warning', (warning) => {
      this.logger.log({
        level: 'warn',
        message: 'Process warning',
        warning: warning.message,
        type: 'runtime'
      });
    });
  }

  handleViolation(violation) {
    this.engine.stats.violations++;

    if (violation.action === 'block') {
      this.engine.stats.blocked++;
    } else if (violation.action === 'warn') {
      this.engine.stats.warnings++;
    }

    this.logger.log({
      ...violation,
      timestamp: new Date().toISOString(),
      pid: process.pid,
      uid: process.getuid?.(),
      type: 'runtime'
    });

    console.log(`⚠️  [${violation.severity.toUpperCase()}] ${violation.description}`);
  }

  getStats() {
    return this.engine.stats;
  }
}

// CLI entry point
if (process.argv[1] === __filename) {
  const options = {
    action: process.env.GUARD_ACTION || 'block',
    monitor: process.env.GUARD_MONITOR === 'true',
    logLevel: process.env.GUARD_LOG_LEVEL || 'info'
  };
  const guard = new RuntimeGuard(options);
  guard.initialize().then(() => {
    console.log('🛡️  Runtime Guard initialized. Protecting process...');
    guard.protect();
    console.log('✅ Protection active. Press Ctrl+C to stop.');
    // Keep process alive
    process.stdin.resume();
  }).catch(err => {
    console.error('❌ Failed to initialize guard:', err);
    process.exit(1);
  });
}

export default RuntimeGuard;
