import Parser from 'rss-parser';

export interface RssSource {
  url: string;
  name: string;
}

export class RssFetcher {
  private parser = new Parser();

  async fetchAll(sources: RssSource[] = []): Promise<any[]> {
    const all = [];
    for (const src of sources) {
      try {
        const feed = await this.parser.parseURL(src.url);
        for (const entry of feed.items) {
          all.push({
            title: entry.title,
            link: entry.link,
            content: entry.contentSnippet || entry.content || '',
            pubDate: entry.pubDate,
            source: src.name,
          });
        }
      } catch (err: any) {
        console.error(`[RSS] Failed to fetch ${src.url}:`, err.message);
      }
    }
    return all;
  }
}
