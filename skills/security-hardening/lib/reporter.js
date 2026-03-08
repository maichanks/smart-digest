import chalk from 'chalk';

export class Reporter {
  constructor(options = {}) {
    this.options = {
      format: options.format || 'text', // text|json|compact
      color: options.color !== false,
      showSuggestion: options.showSuggestion !== false,
      severityColors: {
        critical: chalk.red,
        high: chalk.yellow,
        medium: chalk.blue,
        low: chalk.gray
      }
    };
  }

  formatResults(results, stats) {
    if (this.options.format === 'json') {
      return JSON.stringify({ results, stats }, null, 2);
    }

    if (this.options.format === 'compact') {
      return this.formatCompact(results, stats);
    }

    return this.formatText(results, stats);
  }

  formatText(results, stats) {
    let output = [];

    // Header
    output.push('');
    output.push('🔍 Security Scan Results');
    output.push('━'.repeat(50));
    output.push(`📊 Files scanned: ${stats.totalScanned}`);
    output.push(`⚠️  Total violations: ${stats.violations}`);
    output.push(`⛔ Blocked: ${stats.blocked}`);
    output.push(`⚠️  Warnings: ${stats.warnings}`);
    output.push('');

    if (results.length === 0) {
      output.push(chalk.green('✅ No security issues found!'));
      return output.join('\n');
    }

    // Results by file
    for (const result of results) {
      output.push(chalk.bold(`📄 ${result.file}`));
      output.push(`   Lines: ${result.lineCount}, Size: ${this.formatBytes(result.size)}`);

      for (const violation of result.violations) {
        const severityColor = this.options.severityColors[violation.severity] || chalk.white;
        const severityIcon = this.getSeverityIcon(violation.severity);

        output.push(`   ${severityIcon} ${severityColor(violation.rule_id)} - ${violation.description}`);
        output.push(`      Action: ${chalk[violation.action === 'block' ? 'red' : 'yellow'](violation.action)}`);

        if (this.options.showSuggestion && violation.suggestion) {
          output.push(`      💡 ${chalk.cyan('Fix:')} ${violation.suggestion}`);
        }
      }
      output.push('');
    }

    // Summary
    output.push('━'.repeat(50));
    output.push(this.getSummary(stats));

    return output.join('\n');
  }

  formatCompact(results, stats) {
    const lines = [];

    for (const result of results) {
      for (const violation of result.violations) {
        lines.push(`${result.file}:${violation.rule_id}:${violation.severity}:${violation.action}`);
      }
    }

    lines.push(`# Summary: ${stats.violations} violations in ${stats.totalScanned} files`);
    return lines.join('\n');
  }

  formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  getSeverityIcon(severity) {
    const icons = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '⚪'
    };
    return icons[severity] || '⚪';
  }

  getSummary(stats) {
    if (stats.violations === 0) {
      return chalk.green('✅ PASSED: No security violations detected');
    }

    const summary = [];
    if (stats.blocked > 0) summary.push(chalk.red(`${stats.blocked} blocked`));
    if (stats.warnings > 0) summary.push(chalk.yellow(`${stats.warnings} warnings`));

    return `❌ FAILED: ${summary.join(', ')}`;
  }

  formatJsonl(results, stats) {
    const lines = [];

    for (const result of results) {
      for (const violation of result.violations) {
        lines.push(JSON.stringify({
          timestamp: new Date().toISOString(),
          file: result.file,
          ...violation,
          lineCount: result.lineCount
        }));
      }
    }

    return lines.join('\n');
  }
}

export default Reporter;
