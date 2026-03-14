"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DigestService = void 0;
class DigestService {
    config;
    rssFetcher;
    emailFetcher;
    summarizer;
    sender;
    seenLinks = new Set();
    constructor(config, rssFetcher, emailFetcher, summarizer, sender) {
        this.config = config;
        this.rssFetcher = rssFetcher;
        this.emailFetcher = emailFetcher;
        this.summarizer = summarizer;
        this.sender = sender;
    }
    async run() {
        console.log('[Digest] Starting smart digest...');
        const [rssItems, emailItems] = await Promise.all([
            this.rssFetcher.fetchAll(this.config.rssSources),
            this.emailFetcher.fetchAll(),
        ]);
        const allItems = [...rssItems, ...emailItems];
        if (allItems.length === 0) {
            console.log('[Digest] No new items found.');
            return;
        }
        const uniqueItems = allItems.filter(item => {
            if (this.seenLinks.has(item.link))
                return false;
            this.seenLinks.add(item.link);
            return true;
        });
        if (uniqueItems.length === 0) {
            console.log('[Digest] All items were duplicates.');
            return;
        }
        const summarized = await this.summarizer.summarizeBatch(uniqueItems);
        const digestText = this.buildDigest(summarized);
        await this.sender.send(digestText, this.config.channel || 'feishu');
        console.log(`[Digest] Sent with ${uniqueItems.length} items.`);
    }
    buildDigest(items) {
        const date = new Date().toLocaleDateString('zh-CN', { dateStyle: 'full' });
        let md = `## 📰 Smart Digest (${date})\n\n`;
        md += `Total items: ${items.length}\n\n---\n\n`;
        for (const item of items) {
            md += `### ${item.title}\n`;
            md += `*Source*: ${item.source}\n`;
            md += `*Summary*: ${item.summary}\n`;
            md += `*Link*: ${item.link}\n\n---\n\n`;
        }
        return md;
    }
}
exports.DigestService = DigestService;
