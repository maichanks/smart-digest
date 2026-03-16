# 📰 Smart Digest / 智能资讯摘要

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Skill-ff6b6b)](https://github.com/openclaw/openclaw)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)

> ⚡ **一键部署**：`curl -fsSL https://raw.githubusercontent.com/maichanks/smart-digest/main/deploy.js -o deploy.js && node deploy.js`
>
> AI 驱动的 OpenClaw 智能资讯摘要技能，自动聚合 RSS + SearXNG 搜索，使用 OpenRouter 生成中文摘要，每日定时推送至飞书/Telegram。3 分钟完成部署，立即终结信息过载。

**🚀 3 分钟部署** | 📖 双语文档 | 🆓 MIT 协议 | ⭐ 专为 OpenClaw 生态设计

---

## 🇺🇸 English

### What is Smart Digest?

Smart Digest is an OpenClaw skill that automatically fetches news from multiple sources, generates Chinese summaries using AI, and sends them to your chat (Feishu/Telegram) on a schedule. It solves information overload by providing concise, personalized news digests.

### ✨ Features

- **Multi-source aggregation** – Uses SearXNG (local), RSSHub, and local JSON fallback
- **Smart querying** – Mixes Chinese/English keywords to maximize coverage
- **Content filtering** – Excludes low-quality domains (e.g., zhihu, baike)
- **AI summarization** – OpenRouter (Claude 3 Haiku) produces Chinese summaries
- **Grouped output** – Organizes by interest/topic
- **Robust delivery** – Retry, hard timeout, isolated cron sessions
- **Graceful degradation** – Works without API key (uses snippets)
- **Easy configuration** – Single `config.yaml` for all settings
- **Preview mode** – Test without sending

### 🏗️ Architecture

```
┌─────────────┐
│   Config    │ ← YAML config (interests, filters, LLM)
└──────┬──────┘
       │
┌──────▼──────┐
│   Fetcher   │ ← SearXNG (serial) → Local JSON → Mock
└──────┬──────┘
       │
┌──────▼──────┐
│   Filter &  │ ← Dedup, domain block, age (optional)
│   Dedup     │
└──────┬──────┘
       │
┌──────▼──────┐
│ Summarizer  │ ← OpenRouter (Chinese) or snippet fallback
└──────┬──────┘
       │
┌──────▼──────┐
│   Formatter │ ← Markdown with grouping
└──────┬──────┘
       │
┌──────▼──────┐
│  Deliver    │ ← openclaw message send + retry
└─────────────┘
```

### 🚀 One-Click Deploy

Run the automated deployment script (requires Node.js):

```bash
curl -fsSL https://raw.githubusercontent.com/maichanks/smart-digest/main/deploy.js -o deploy.js && node deploy.js
```

Or manually copy the repository to `$HOME/.openclaw/workspace/skills/` and run `npm install`.

---


### 📦 Installation

1. **Clone or copy** to your OpenClaw skills directory:
   ```bash
   cp -r smart-digest $HOME/.openclaw/workspace/skills/
   ```

2. **Install dependencies**:
   ```bash
   cd skills/smart-digest
   npm install
   ```

3. **Configure** `config.yaml` (see Configuration below).

4. **Test with preview**:
   ```bash
   node preview.js
   ```

5. **Run**:
   ```bash
   node smart-digest-v2.js
   ```

6. **Register cron** (optional):
   ```bash
   openclaw cron add --name "SmartDigest PM" \
     --cron "0 21 * * *" \
     --session isolated \
     --message "node /path/to/smart-digest-v2.js"
   ```

### ⚙️ Configuration

Edit `config.yaml`:

```yaml
smartDigest:
  # Your topics of interest (affects search queries)
  userInterests:
    - 石油
    - oil news
    - energy

  # Data sources
  searchSources:
    searxngUrl: http://localhost:8080   # your local SearXNG
    maxResults: 8
    # categories: general  # optional

  # Content filters
  filters:
    blockedDomains:                     # ↓ edit as needed
      - zhihu.com
      - zhuanlan.zhihu.com
      - baike.baidu.com
      - iciba.com
      - dictionary.cambridge.org
    # maxAgeDays: 2                     # optional (days)

  # Output format
  format:
    grouping: by-interest               # or "flat"
    maxItemsPerGroup: 6
    showSource: true
    showLink: true

  # AI summarization
  llm:
    provider: openrouter
    openrouterApiKey: ""                # set env OPENROUTER_API_KEY instead
    model: anthropic/claude-3-haiku
    maxTokens: 120
    temperature: 0.5

  # Delivery
  channel: feishu
  target: ou_XXXXXXXXXXXX               # your user/chat ID
```

**Notes**:
- Without `openrouterApiKey`, summaries are raw content snippets.
- `target` can be user `open_id` or group `chat_id`.
- Adjust `blockedDomains` to improve news quality.

### 🕒 Scheduling

Use OpenClaw cron for automated delivery. Example (daily 9 PM):

```bash
openclaw cron add --name "SmartDigest" \
  --cron "0 21 * * *" \
  --session isolated \
  --message "node /path/to/smart-digest-v2.js"
```

**Tip**: Use `isolated` session to avoid blocking main GPT.

### 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| No news found | Check SearXNG is running; try English queries; adjust blocked domains |
| Message send blocked | Ensure Gateway is healthy; script uses hard timeout (18s) |
| Summaries are snippets | Set `OPENROUTER_API_KEY` or `llm.openrouterApiKey` |
| Duplicate sends | Remove old cron jobs (`openclaw cron list` & `remove <id>`) |
| Chinese output poor | Verify OpenRouter key and model; adjust prompt in code |

### 📄 License

MIT © 2026 maichanks <hankan1993@gmail.com>

---

## 🇨🇳 中文

### 什么是 Smart Digest？

Smart Digest 是一个 OpenClaw skill，自动从多源聚合新闻，使用 AI 生成中文摘要，并定时推送到你的飞书/Telegram 聊天。它通过提供简洁、个性化的每日资讯来解决信息过载问题。

### ✨ 核心功能

- **多源聚合** — 首选本地 SearXNG，备选本地 JSON 和 Mock 数据
- **智能查询** — 中英文混合关键词提升覆盖率
- **内容过滤** — 屏蔽低质量域名（知乎、百度百科等）
- **AI 摘要** — OpenRouter (Claude 3 Haiku) 生成中文总结
- **分组展示** — 按兴趣/主题组织内容
- **可靠投递** — 重试、硬超时、独立 cron 会话
- **优雅降级** — 无 API key 时使用内容片段
- **配置简单** — 单一 `config.yaml` 管理所有设置
- **预览模式** — 调试时可避免发送

### 🏗️ 架构设计

```
┌─────────────┐
│   配置文件  │ ← YAML (兴趣、过滤、LLM)
└──────┬──────┘
       │
┌──────▼──────┐
│   数据获取  │ ← SearXNG(串行) → 本地JSON → Mock
└──────┬──────┘
       │
┌──────▼──────┐
│ 过滤与去重  │ ← URL去重、域名屏蔽、时效(可选)
└──────┬──────┘
       │
┌──────▼──────┐
│   AI 摘要   │ ← OpenRouter(中文) 或片段后备
└──────┬──────┘
       │
┌──────▼──────┐
│   格式化    │ ← 分组 Markdown
└──────┬──────┘
       │
┌──────▼──────┐
│   消息发送  │ ← openclaw message send + 重试
└─────────────┘
```

### 📦 安装步骤

1. **复制到 OpenClaw skills 目录**：
   ```bash
   cp -r smart-digest $HOME/.openclaw/workspace/skills/
   ```

2. **安装依赖**：
   ```bash
   cd skills/smart-digest
   npm install
   ```

3. **编辑 `config.yaml`**（见下方配置示例）。

4. **预览测试**（不发送）：
   ```bash
   node preview.js
   ```

5. **运行**：
   ```bash
   node smart-digest-v2.js
   ```

6. **注册定时任务**（可选）：
   ```bash
   openclaw cron add --name "SmartDigest PM" \
     --cron "0 21 * * *" \
     --session isolated \
     --message "node /path/to/smart-digest-v2.js"
   ```

### ⚙️ 配置说明

编辑 `config.yaml`：

```yaml
smartDigest:
  # 兴趣关键词（用于生成查询）
  userInterests:
    - 石油
    - oil news
    - energy

  # 数据源
  searchSources:
    searxngUrl: http://localhost:8080   # 本地 SearXNG 地址
    maxResults: 8

  # 过滤规则
  filters:
    blockedDomains:                     # 屏蔽的域名（不发送）
      - zhihu.com
      - zhuanlan.zhihu.com
      - baike.baidu.com
      - iciba.com
      - dictionary.cambridge.org
    # maxAgeDays: 2                     # 可选：保留最近 N 天

  # 输出格式
  format:
    grouping: by-interest               # 按兴趣分组
    maxItemsPerGroup: 6
    showSource: true
    showLink: true

  # AI 摘要配置
  llm:
    provider: openrouter
    openrouterApiKey: ""                # 建议使用环境变量 OPENROUTER_API_KEY
    model: anthropic/claude-3-haiku
    maxTokens: 120
    temperature: 0.5

  # 消息通道
  channel: feishu
  target: ou_XXXXXXXXXXXX               # 接收者的 open_id 或群聊 chat_id
```

**注意事项**：
- 不设置 `openrouterApiKey` 将使用内容片段代替摘要。
- `target` 可以是用户 `open_id` 或群组 `chat_id`。
- 通过调整 `blockedDomains` 提高新闻质量。

### 🕒 定时任务

使用 OpenClaw cron 实现自动推送。示例（每晚 21:00）：

```bash
openclaw cron add --name "SmartDigest" \
  --cron "0 21 * * *" \
  --session isolated \
  --message "node /path/to/smart-digest-v2.js"
```

**提示**：使用 `isolated` 会话避免阻塞主 GPT。

### 🐛 常见问题

| 问题 | 解决方案 |
|------|----------|
| 搜索无结果 | 检查 SearXNG 是否运行；尝试英文关键词；调整屏蔽域名 |
| 消息发送阻塞 | 检查 Gateway 状态；脚本已设硬超时（18秒） |
| 摘要仅为片段 | 设置 `OPENROUTER_API_KEY` 或 `llm.openrouterApiKey` |
| 重复推送 | 删除旧 cron 作业 (`openclaw cron list` 后 `remove <id>`) |
| 中文摘要质量差 | 检查 OpenRouter key 和模型；调整代码中的 prompt |

### 📄 License

MIT © 2026 maichanks <hankan1993@gmail.com>

---

## 🚀 Quick Start / 快速开始

```bash
# 1. Install deps
npm install

# 2. Configure config.yaml (set target, adjust interests)

# 3. Preview
node preview.js

# 4. Run once
node smart-digest-v2.js

# 5. Add cron (optional)
openclaw cron add --name "SmartDigest" --cron "0 21 * * *" --session isolated --message "node smart-digest-v2.js"
```

Enjoy your personalized news digest! 享受个性化每日资讯！

---

## 📝 Keywords

`openclaw`, `smart-digest`, `news-digest`, `rss`, `searxng`, `ai-summarization`, `chinese-summarization`, `openrouter`, `information-overload`, `automation`, `feishu`, `telegram`, `news-aggregation`

---

## 🔗 Related OpenClaw Projects

- [OpenClaw GitHub Trending Notifier](https://github.com/maichanks/openclaw-github-trending) - Monitor GitHub trending and send summaries
- [Security Hardening for OpenClaw](https://github.com/maichanks/security-hardening) - Comprehensive security toolkit
- [LLM Cost Optimizer](https://github.com/maichanks/llm-cost-optimizer) - Monitor and reduce LLM API costs
- [Multi-Platform Publisher](https://github.com/maichanks/multi-platform-publisher) - Enterprise content publishing with MCP support

---

## 📄 License

MIT © 2026 maichanks <hankan1993@gmail.com>
