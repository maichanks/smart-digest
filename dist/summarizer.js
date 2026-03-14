"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Summarizer = void 0;
const axios_1 = __importDefault(require("axios"));
class Summarizer {
    async summarizeBatch(items) {
        const results = [];
        for (const item of items) {
            const summary = await this.summarize(item.content || item.title);
            results.push({ ...item, summary });
        }
        return results;
    }
    async summarize(text) {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            // Fallback: truncate
            return text.length > 200 ? text.substring(0, 200) + '...' : text;
        }
        try {
            const resp = await axios_1.default.post('https://openrouter.ai/api/v1/chat/completions', {
                model: 'anthropic/claude-3-haiku',
                messages: [
                    {
                        role: 'system',
                        content: 'Summarize in 2-3 sentences, keep key points.',
                    },
                    { role: 'user', content: text.slice(0, 2000) },
                ],
                max_tokens: 150,
            }, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'HTTP-Referer': 'https://openclaw.ai',
                    'X-Title': 'OpenClaw Smart Digest',
                },
            });
            return resp.data.choices[0].message.content.trim();
        }
        catch (err) {
            console.error('[Summarizer] LLM call failed:', err.response?.data || err.message);
            return text.substring(0, 200) + '...';
        }
    }
}
exports.Summarizer = Summarizer;
