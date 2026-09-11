# Codex Scheduler

Cloudflare Workers Cron Triggers are used only to trigger the GitHub Actions workflow. The GitHub workflow performs the Codex prime request and OAuth refresh persistence.

## Schedule

Weekdays in Asia/Taipei:

- 05:50
- 11:05

Cloudflare Cron Triggers run in UTC, so the deployed Worker uses:

- `50 21 * * 0-4` -> Monday-Friday 05:50 Asia/Taipei
- `5 3 * * 1-5` -> Monday-Friday 11:05 Asia/Taipei

## Cloudflare Worker

Worker source: `cloudflare-worker/`

The Worker calls GitHub's `workflow_dispatch` endpoint for:

- Repository: `warerwang/codex-scheduler`
- Workflow: `.github/workflows/codex-refresh-time.yml`
- Ref: `main`

The GitHub workflow itself has no `schedule` trigger, which avoids duplicate or delayed GitHub scheduled runs.

### GitHub token

Create a fine-grained GitHub PAT scoped only to `warerwang/codex-scheduler` with:

- Repository permission: **Actions: Read and write**

Store it as a Cloudflare Worker secret named `GITHUB_TOKEN`. Do not commit the token.

### Deploy

```bash
cd cloudflare-worker
npx wrangler login
npx wrangler secret put GITHUB_TOKEN
npx wrangler deploy
```

After deployment, Cron Triggers are managed by `wrangler.jsonc`.

### Local scheduled test

```bash
cd cloudflare-worker
npx wrangler dev
curl "http://localhost:8787/cdn-cgi/local/scheduled?format=json"
```

The existing GitHub Actions secrets remain unchanged:

- `CODEX_AUTH_JSON_1`
- `CODEX_AUTH_JSON_2`
- `GH_SECRET_WRITE_TOKEN`
