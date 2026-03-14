# 🚀 Smart Digest GitHub Release Guide

This guide walks through publishing Smart Digest to GitHub.

## Prerequisites

- Git installed and configured (`git config --global user.name`, `user.email`)
- A GitHub account
- SSH key added to your GitHub account (recommended) or PAT

## Steps

### 1. Create a new repository on GitHub

Go to https://github.com/new

- **Owner**: your organization or user
- **Repository name**: `smart-digest` (or `openclaw-smart-digest`)
- **Description**: "AI-powered news digest for OpenClaw"
- **Public** (or Private as needed)
- ✅ **Add a README file** (we already have one)
- Choose a license (we use MIT)

Click **Create repository**.

### 2. Add remote and push

In the skill directory:

```bash
cd /home/admin/.openclaw/workspace/skills/smart-digest

# Initialize git if not yet
git init
git add .
git commit -m "feat: initial release v1.0.0

- Multi-source news aggregation (SearXNG)
- AI summarization via OpenRouter
- Robust delivery with retry & timeout
- Configurable interests & filters
- Cron integration for OpenClaw"

# Add remote (replace YOUR_GITHUB_USER)
git remote add origin git@github.com:YOUR_GITHUB_USER/smart-digest.git
git branch -M main
git push -u origin main
```

### 3. Create a Release

```bash
# Tag the release
git tag -a v1.0.0 -m "Smart Digest v1.0.0 - AI-powered news digest"
git push origin v1.0.0
```

Then on GitHub:
- Go to **Releases** → **Draft a new release**
- Choose tag `v1.0.0`
- Release title: `v1.0.0`
- Description: copy from `CHANGELOG.md` [1.0.0] section
- ✅ Attach binaries: `smart-digest-v1.0.0.zip` (if you have one)
- Publish release

### 4. (Optional) Add Topics

Add repository topics for discoverability:
`openclaw`, `news`, `digest`, `rss`, `ai-summarization`, `searxng`, `automation`

---

## Post-release

- Share the repo URL: https://github.com/YOUR_GITHUB_USER/smart-digest
- Update `README.md` with installation instructions if needed
- Open issues for feature requests or bugs

---

## Attribution

Author: OpenClaw Community
License: MIT
