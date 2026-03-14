#!/usr/bin/env node
"use strict";
/**
 * Smart Digest Skill for OpenClaw
 * Fetches RSS and Newsletter emails, summarizes with LLM, sends digest to chat.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const promises_1 = require("fs/promises");
const yaml = __importStar(require("yaml"));
const rss_1 = require("./fetcher/rss");
const email_1 = require("./fetcher/email");
const summarizer_1 = require("./summarizer");
const sender_1 = require("./sender");
const digest_service_1 = require("./digest.service");
async function main() {
    try {
        // Load config.yaml from skill directory
        const configPath = process.env.CONFIG_PATH || 'config.yaml';
        const content = await (0, promises_1.readFile)(configPath, 'utf-8');
        const parsed = yaml.parse(content);
        const cfg = parsed.smartDigest;
        const rss = new rss_1.RssFetcher();
        const email = new email_1.EmailFetcher(cfg.email || {});
        const summarizer = new summarizer_1.Summarizer();
        const sender = new sender_1.DigestSender();
        const digest = new digest_service_1.DigestService(cfg, rss, email, summarizer, sender);
        await digest.run();
    }
    catch (err) {
        console.error('Smart Digest failed:', err.message);
        process.exit(1);
    }
}
main();
