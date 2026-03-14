import { RssFetcher } from './fetcher/rss';
import { EmailFetcher } from './fetcher/email';
import { Summarizer } from './summarizer';
import { DigestSender } from './sender';

export class DigestService {
  private seenLinks = new Set<string>();

  constructor(
    private config: any,
    private rssFetcher: RssFetcher,
    private emailFetcher: EmailFetcher,
    private summarizer: Summarizer,
    private sender: DigestSender,
  ) {}

  async run(): Promise<void> {
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
      if (this.seenLinks.has(item.link)) return false;
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

  private buildDigest(items: any[]): string {
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
