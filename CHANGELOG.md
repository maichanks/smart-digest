# Changelog

All notable changes to Smart Digest will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-14

### Added
- Initial release of Smart Digest v2
- Multi-source aggregation: SearXNG (primary), local JSON fallback, mock data
- Serial query with rate limiting and per-source timeout
- Domain filtering to exclude non-news sources (zhihu, baike, etc.)
- Deduplication by URL
- AI summarization via OpenRouter (Claude 3 Haiku) with Chinese output
- Group-by-interest markdown formatting
- Robust delivery: retry logic, hard timeout, guaranteed process exit
- Graceful degradation when API key missing
- Preview mode for debugging
- Configurable interests, filters, and schedules
- OpenClaw cron integration (isolated sessions)

### Fixed
- Resolved blocking issue in message sending with timeout protection
- Improved news coverage by using mixed Chinese/English queries
- Disabled age filter for missing publication dates

### Changed
- Switched from parallel to serial fetching to avoid SearXNG rate limits
- Moved from main to isolated cron sessions to prevent blocking
