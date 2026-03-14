"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DigestSender = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class DigestSender {
    async send(text, channel = 'feishu') {
        try {
            // Use OpenClaw message tool
            const cmd = `openclaw message send --channel ${channel} --message "${this.escape(text)}"`;
            const { stdout, stderr } = await execAsync(cmd, { maxBuffer: 1024 * 1024 });
            if (stderr)
                console.error('[Sender]', stderr);
            console.log('[Sender] Message sent successfully.');
        }
        catch (err) {
            console.error('[Sender] Failed to send message:', err.message);
            // Fallback: print to stdout
            console.log('\n=== DIGEST (fallback) ===\n', text, '\n=== END ===\n');
        }
    }
    escape(str) {
        return str.replace(/"/g, '\\"').replace(/\n/g, ' ');
    }
}
exports.DigestSender = DigestSender;
