# add-status

A lightweight CLI tool for bulk updating the "Current Status" field on Jira RM tickets.

## Background

The Jira MCP server does not currently support writes to custom fields like "Current Status". This tool uses the Jira REST API directly to fill that gap, allowing you to quickly update status fields across multiple tickets.

## Prerequisites

### 1. Node.js

Ensure you have Node.js installed (v18 or later recommended):

```bash
node --version
```

### 2. cloudflared

The tool uses `cloudflared` for Cloudflare Access authentication. Install it if you haven't already:

```bash
# macOS
brew install cloudflared

# Or see: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

Verify installation:

```bash
cloudflared --version
```

## Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd status-updates-reminder
```

### 2. Install dependencies

```bash
npm install
```

### 3. Build the project

```bash
npm run build
```

### 4. Install globally

```bash
npm install -g .
```

This makes the `add-status` command available anywhere in your terminal.

### Verify installation

```bash
add-status --help
```

## Usage

### Authentication

Before using the tool, authenticate with Jira (valid for 24 hours):

```bash
add-status auth
```

This opens a browser for Cloudflare Access authentication. Once complete, you're ready to use the tool.

### Updating Tickets

#### Basic usage (with your team's default JQL)

```bash
add-status "Completed code review, awaiting deploy"
```

This searches for tickets matching the default query:
```
project = RM AND teams in ("Workers Authoring & Testing") AND status = "In Progress"
```

#### Custom JQL query

```bash
add-status "On track" --jql "project = RM AND assignee = currentUser()"
```

#### Dry-run mode

Preview changes without applying them:

```bash
add-status "My update" --dry-run
```

#### Skip date prefix

By default, updates are prefixed with today's date (`YYYY-MM-DD:`). To skip this:

```bash
add-status "2026-01-27: Custom format" --no-date-prefix
```

## Interactive Confirmation

When running without `--dry-run`, the tool shows each ticket's current status and the proposed change, then prompts for confirmation:

```
────────────────────────────────────────────────────────────
RM-1234 - Implement feature X
Status: In Progress

Current Status Field:
2026-01-20: Completed initial review

Proposed New Value:
2026-01-27: Addressed feedback, ready for final review
2026-01-20: Completed initial review

Apply this update? [y/n/a(all)/s(skip all)]:
```

Options:
- `y` - Apply this update and continue
- `n` - Skip this ticket and continue
- `a` - Apply this and all remaining updates
- `s` - Skip this and all remaining tickets

## CLI Reference

```
Usage: add-status [options] [command] <status>

Bulk update Current Status field on Jira RM tickets

Arguments:
  status            Status update text to prepend

Options:
  -V, --version     output the version number
  --jql <query>     Custom JQL query (default: "project = RM AND teams in
                    ("Workers Authoring & Testing") AND status = "In Progress"")
  --dry-run         Preview changes without applying (default: false)
  --no-date-prefix  Skip auto YYYY-MM-DD: prefix
  -h, --help        display help for command

Commands:
  auth              Authenticate with Jira via cloudflared (valid for 24h)
```

## Examples

```bash
# Authenticate
add-status auth

# Simple status update
add-status "On track, no blockers"

# Update with specific JQL
add-status "Blocked on design review" --jql "project = RM AND assignee = currentUser() AND status = 'In Progress'"

# Preview what would happen
add-status "Testing complete" --dry-run

# Custom date format
add-status "2026-01-27: Weekly sync - all green" --no-date-prefix
```

## Troubleshooting

### "Not authenticated" error

Run `add-status auth` to re-authenticate. Tokens are valid for 24 hours.

### "cloudflared is not installed" error

Install cloudflared:
```bash
brew install cloudflared
```

### "Could not find Current Status custom field" error

The tool looks for a custom field named "Current Status" in your Jira project. Make sure this field exists and is available on your tickets.

## Development

### Run without building

```bash
npm run dev -- "My status update"
npm run dev -- auth
```

### Rebuild after changes

```bash
npm run build
```

## Uninstalling

```bash
npm uninstall -g add-status
```
