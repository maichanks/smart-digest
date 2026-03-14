import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

export class DigestSender {
  async send(text: string, channel: string = 'feishu') {
    try {
      // Use OpenClaw message tool
      const cmd = `openclaw message send --channel ${channel} --message "${this.escape(text)}"`;
      const { stdout, stderr } = await execAsync(cmd, { maxBuffer: 1024 * 1024 });
      if (stderr) console.error('[Sender]', stderr);
      console.log('[Sender] Message sent successfully.');
    } catch (err: any) {
      console.error('[Sender] Failed to send message:', err.message);
      // Fallback: print to stdout
      console.log('\n=== DIGEST (fallback) ===\n', text, '\n=== END ===\n');
    }
  }

  private escape(str: string): string {
    return str.replace(/"/g, '\\"').replace(/\n/g, ' ');
  }
}
