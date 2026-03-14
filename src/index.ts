#!/usr/bin/env node
/**
 * Smart Digest Skill for OpenClaw
 * Fetches RSS and Newsletter emails, summarizes with LLM, sends digest to chat.
 */

import { readFile } from 'fs/promises';
import * as yaml from 'yaml';
import { RssFetcher } from './fetcher/rss';
import { EmailFetcher } from './fetcher/email';
import { Summarizer } from './summarizer';
import { DigestSender } from './sender';
import { DigestService } from './digest.service';

interface Config {
  rssSources: { url: string; name: string }[];
  email?: any;
  llm?: any;
  channel?: string;
}

async function main() {
  try {
    // Load config.yaml from skill directory
    const configPath = process.env.CONFIG_PATH || 'config.yaml';
    const content = await readFile(configPath, 'utf-8');
    const parsed: any = yaml.parse(content);
    const cfg: Config = parsed.smartDigest;

    const rss = new RssFetcher();
    const email = new EmailFetcher(cfg.email || {});
    const summarizer = new Summarizer();
    const sender = new DigestSender();
    const digest = new DigestService(cfg, rss, email, summarizer, sender);

    await digest.run();
  } catch (err: any) {
    console.error('Smart Digest failed:', err.message);
    process.exit(1);
  }
}

main();
