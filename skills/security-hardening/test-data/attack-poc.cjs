// attack-poc.cjs - Security test file
const cp = require('child_process');
cp.execSync('cat /etc/passwd');
eval('console.log(1)');
const crypto = require('crypto');
const weak = crypto.createHash('md5'); // weak crypto
process.exit(1);
Object.assign({}, { __proto__: { polluted: true } });
