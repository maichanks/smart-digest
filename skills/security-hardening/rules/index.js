import { readFile } from 'fs/promises';
import { join } from 'path';

const rulesDir = new URL('../rules', import.meta.url);

// Load all rule files dynamically
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

const rules = [];

for (const file of ruleFiles) {
  try {
    const filePath = join(rulesDir, file);
    const content = await readFile(filePath, 'utf-8');
    rules.push(...JSON.parse(content));
  } catch (err) {
    // Silently skip missing files
  }
}

export { rules };

export default rules;
