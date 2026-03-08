import { readFile, readdir, stat } from 'fs/promises';
import { join, extname, basename } from 'path';
import { rules as allRules } from '../rules/index.js';

export class RuleEngine {
  constructor(options = {}) {
    this.rules = [];
    this.enabledRules = new Set();
    this.stats = {
      totalScanned: 0,
      violations: 0,
      blocked: 0,
      warnings: 0
    };
    this.options = {
      action: options.action || 'warn', // block|warn|log
      monitor: options.monitor || false,
      verbose: options.verbose || false
    };
  }

  async loadRules(rulesDir = 'rules') {
    const ruleFiles = [
      'execution.json',
      'filesystem.json',
      'network.json',
      'process.json',
      'module.json',
      'crypto.json',
      'web.json',
      'data.json'
    ];

    for (const file of ruleFiles) {
      try {
        const filePath = join(rulesDir, file);
        const content = await readFile(filePath, 'utf-8');
        const rules = JSON.parse(content);
        this.rules.push(...rules);
        console.log(`🛡️  Loaded ${rules.length} rules from ${file}`);
      } catch (err) {
        console.warn(`⚠️  Could not load ${file}: ${err.message}`);
      }
    }

    console.log(`📋 Total rules loaded: ${this.rules.length}`);
    return this.rules;
  }

  enableRule(ruleId) {
    this.enabledRules.add(ruleId);
  }

  disableRule(ruleId) {
    this.enabledRules.delete(ruleId);
  }

  isRuleEnabled(rule) {
    return this.enabledRules.size === 0 || this.enabledRules.has(rule.rule_id);
  }

  matchFile(filePath, fileContent) {
    const ext = extname(filePath).toLowerCase();
    const violations = [];

    for (const rule of this.rules) {
      if (!this.isRuleEnabled(rule)) continue;

      // Check file extension
      if (rule.match.file_extensions && !rule.match.file_extensions.includes(ext)) {
        continue;
      }

      // Check pattern
      if (this.matchesPattern(fileContent, rule)) {
        const violation = {
          rule_id: rule.rule_id,
          severity: rule.severity,
          description: rule.description,
          file: filePath,
          action: rule.action,
          suggestion: rule.suggestion
        };
        violations.push(violation);
      }
    }

    return violations;
  }

  matchesPattern(content, rule) {
    if (rule.match.type === 'regex') {
      const regex = new RegExp(rule.match.pattern, 'gi');
      return regex.test(content);
    } else if (rule.match.type === 'ast') {
      // AST matching would require a parser (acorn, @typescript-eslint/parser)
      // For now, fallback to regex for simplicity
      const simplified = this.astToRegex(rule.match.pattern);
      const regex = new RegExp(simplified, 'gi');
      return regex.test(content);
    }
    return false;
  }

  astToRegex(pattern) {
    // Convert simplified AST pattern to regex
    // This is a basic conversion; production would use actual AST parsing
    return pattern
      .replace(/CallExpression\[callee\.name='([^']+)'\]/, '$1\\s*\\(')
      .replace(/CallExpression\[callee\.property\.name='([^']+)'\]/, '\\.$1\\s*\\(')
      .replace(/NewExpression\[callee\.name='([^']+)'\]/, 'new\\s+$1\\s*\\(');
  }

  async scanDirectory(dirPath, options = {}) {
    const results = [];
    const exclude = options.exclude || ['node_modules', '.git', 'logs'];

    async function walk(dir, depth = 0) {
      if (depth > 10) return; // Prevent infinite recursion

      try {
        const entries = await readdir(dir, { withFileTypes: true });

        for (const entry of entries) {
          if (exclude.includes(entry.name)) continue;

          const fullPath = join(dir, entry.name);

          if (entry.isDirectory()) {
            await walk(fullPath, depth + 1);
          } else if (entry.isFile()) {
            const ext = extname(entry.name).toLowerCase();
            if (options.fileTypes && !options.fileTypes.includes(ext)) continue;

            try {
              const content = await readFile(fullPath, 'utf-8');
              const violations = this.matchFile(fullPath, content);

              if (violations.length > 0) {
                results.push({
                  file: fullPath,
                  violations,
                  lineCount: content.split('\n').length,
                  size: content.length
                });
              }

              this.stats.totalScanned++;
              if (violations.length > 0) {
                this.stats.violations += violations.length;
                violations.forEach(v => {
                  if (v.action === 'block') this.stats.blocked++;
                  else if (v.action === 'warn') this.stats.warnings++;
                });
              }
            } catch (err) {
              // Skip binary or unreadable files
            }
          }
        }
      } catch (err) {
        console.warn(`Cannot read directory ${dir}: ${err.message}`);
      }
    }

    await walk(dirPath);
    return results;
  }

  async scanFile(filePath) {
    try {
      const content = await readFile(filePath, 'utf-8');
      const violations = this.matchFile(filePath, content);

      this.stats.totalScanned++;

      // Update violation stats
      if (violations.length > 0) {
        this.stats.violations += violations.length;
        violations.forEach(v => {
          if (v.action === 'block') this.stats.blocked++;
          else if (v.action === 'warn') this.stats.warnings++;
        });
      }

      return {
        file: filePath,
        violations,
        lineCount: content.split('\n').length,
        size: content.length
      };
    } catch (err) {
      throw new Error(`Cannot read file ${filePath}: ${err.message}`);
    }
  }
}

export default RuleEngine;
