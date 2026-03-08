#!/usr/bin/env node

import Docker from 'dockerode';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..', '..');

class Sandbox {
  constructor(options = {}) {
    this.options = {
      image: options.image || 'node:18-alpine',
      memory: options.memory || '512m',
      cpu: options.cpu || 1.0,
      network: options.network || 'none',
      readOnly: options.readOnly !== false,
      timeout: options.timeout || 30000,
      mounts: options.mounts || [],
      env: options.env || {},
      workingDir: options.workingDir || '/sandbox'
    };

    this.docker = new Docker();
    this.container = null;
  }

  async run(command, scriptPath = null) {
    console.log(`🐳 Starting sandbox...`);
    console.log(`   Image: ${this.options.image}`);
    console.log(`   Memory: ${this.options.memory}`);
    console.log(`   CPU: ${this.options.cpu}`);
    console.log(`   Network: ${this.options.network}`);

    try {
      // Prepare script if provided
      let containerCmd = command;
      if (scriptPath) {
        const scriptName = basename(scriptPath);
        containerCmd = `sh -c "node /script/${scriptName}"`;
      }

      // Create container
      this.container = await this.docker.createContainer({
        Image: this.options.image,
        Cmd: containerCmd.split(' '),
        Env: [
          `NODE_ENV=production`,
          `PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
          ...Object.entries(this.options.env).map(([k, v]) => `${k}=${v}`)
        ],
        WorkingDir: this.options.workingDir,
        HostConfig: {
          Memory: this.parseMemory(this.options.memory),
          CpuQuota: Math.floor(this.options.cpu * 100000),
          CpuPeriod: 100000,
          NetworkMode: this.options.network,
          ReadonlyRootfs: this.options.readOnly,
          Mounts: [
            ...this.options.mounts,
            {
              Target: '/script',
              Source: scriptPath ? dirname(scriptPath) : '/tmp',
              Type: 'bind',
              ReadOnly: false
            }
          ].filter(m => m),
          PidsLimit: 100,
          SecurityOpt: [
            'no-new-privileges:true',
            'seccomp=unconfined' // Would use custom seccomp profile in production
          ]
        },
        HostConfig: {
          Memory: this.parseMemory(this.options.memory),
          CpuQuota: Math.floor(this.options.cpu * 100000),
          CpuPeriod: 100000,
          NetworkMode: this.options.network,
          ReadonlyRootfs: this.options.readOnly,
          Mounts: [
            {
              Target: '/script',
              Source: scriptPath ? dirname(scriptPath) : '/tmp/scripts',
              Type: 'bind',
              ReadOnly: false
            }
          ],
          PidsLimit: 100,
          SecurityOpt: ['no-new-privileges:true']
        }
      });

      // Start container
      await this.container.start();

      console.log('⏳ Waiting for completion...');

      // Stream logs
      await this.streamLogs();

      // Wait for completion with timeout
      const result = await this.waitWithTimeout(this.options.timeout);

      // Get exit code
      const inspect = await this.container.inspect();
      const exitCode = inspect.State.ExitCode;

      // Get logs
      const logs = await this.getLogs();

      // Cleanup
      await this.cleanup();

      return {
        exitCode,
        logs: logs.toString('utf-8').trim(),
        success: exitCode === 0,
        stats: {
          memory: inspect.MemoryStats?.usage || 0,
          cpu: inspect.CpuStats?.cpu_usage?.total_usage || 0
        }
      };

    } catch (err) {
      console.error('❌ Sandbox error:', err.message);
      await this.cleanup();
      throw err;
    }
  }

  async interactive() {
    console.log('🐳 Starting interactive sandbox shell...');

    try {
      this.container = await this.docker.createContainer({
        Image: this.options.image,
        Cmd: ['/bin/sh'],
        Env: ['NODE_ENV=production'],
        WorkingDir: this.options.workingDir,
        HostConfig: {
          Memory: this.parseMemory(this.options.memory),
          CpuQuota: Math.floor(this.options.cpu * 100000),
          CpuPeriod: 100000,
          NetworkMode: this.options.network || 'none',
          ReadonlyRootfs: this.options.readOnly,
          Tty: true,
          OpenStdin: true
        },
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true
      });

      await this.container.start();

      // Attach to container
      const stream = await this.container.attach({
        stream: true,
        stdin: true,
        stdout: true,
        stderr: true
      });

      // Pipe container I/O
      process.stdin.pipe(stream);
      stream.pipe(process.stdout);

      // Forward container exit
      this.container.wait((err, data) => {
        if (err) console.error('Container error:', err);
        console.log(`\n📦 Container exited with code ${data.StatusCode}`);
        process.exit(data.StatusCode);
      });

    } catch (err) {
      console.error('❌ Interactive error:', err.message);
      throw err;
    }
  }

  async streamLogs() {
    await new Promise((resolve) => {
      this.container.logs(
        { follow: true, stdout: true, stderr: true },
        (err, stream) => {
          if (err) {
            console.warn('Log stream error:', err.message);
            resolve();
            return;
          }

          stream.on('data', (chunk) => {
            process.stdout.write(chunk);
          });

          stream.on('end', resolve);
          stream.on('close', resolve);
        }
      );
    });
  }

  async waitWithTimeout(timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Sandbox timeout after ${timeout}ms`));
      }, timeout);

      this.container.wait((err, data) => {
        clearTimeout(timer);
        if (err) reject(err);
        else resolve(data);
      });
    });
  }

  async getLogs() {
    return new Promise((resolve, reject) => {
      this.container.logs({ stdout: true, stderr: true }, (err, stream) => {
        if (err) return reject(err);

        const chunks = [];
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    });
  }

  async cleanup() {
    if (this.container) {
      try {
        await this.container.stop(5);
      } catch (err) {
        // Container might already be stopped
      }

      try {
        await this.container.remove({ force: true, v: true });
      } catch (err) {
        // Container might already be removed
      }

      this.container = null;
    }
  }

  parseMemory(memStr) {
    // Parse memory string like "512m", "1g"
    const match = memStr.match(/^(\d+)([mMgG])$/);
    if (!match) return 512 * 1024 * 1024; // Default 512MB

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    if (unit === 'g') {
      return value * 1024 * 1024 * 1024;
    }
    return value * 1024 * 1024; // MB
  }

  async isAvailable() {
    try {
      const info = await this.docker.info();
      return info.Status === '正常' || info.Status.toLowerCase().includes('running');
    } catch (err) {
      return false;
    }
  }

  async buildImage(dockerfilePath, tag = 'sandbox-custom') {
    console.log(`🔨 Building custom sandbox image: ${tag}`);

    const dockerfileDir = dirname(dockerfilePath);

    try {
      const stream = await this.docker.buildImage({
        context: dockerfileDir,
        src: `dockerfile:${tag}`,
        Dockerfile: basename(dockerfilePath)
      });

      // Wait for build
      await new Promise((resolve) => {
        this.docker.modem.followProgress(stream, (err) => {
          if (err) throw err;
          resolve();
        });
      });

      console.log(`✅ Image built: ${tag}`);
      return tag;
    } catch (err) {
      console.error('Build failed:', err.message);
      throw err;
    }
  }
}

export default Sandbox;
