"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RssFetcher = void 0;
const rss_parser_1 = __importDefault(require("rss-parser"));
class RssFetcher {
    parser = new rss_parser_1.default();
    async fetchAll(sources = []) {
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
            }
            catch (err) {
                console.error(`[RSS] Failed to fetch ${src.url}:`, err.message);
            }
        }
        return all;
    }
}
exports.RssFetcher = RssFetcher;
