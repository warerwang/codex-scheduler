# Codex Scheduler

用于定时触发 Codex 请求，提前建立 ChatGPT / Codex 的 5 小时额度窗口。

当前方案使用 **Cloudflare Workers Cron Triggers** 负责定时调度，Cloudflare 到点后调用 GitHub Actions 的 `workflow_dispatch`，再由 GitHub Actions 执行 Codex prime 请求以及 OAuth 凭据刷新。

## 工作流程

```text
Cloudflare Cron
    ↓
Cloudflare Worker
    ↓
GitHub workflow_dispatch
    ↓
GitHub Actions
    ↓
Codex prime
    ↓
如遇 401，则通过 Codex CLI 刷新 OAuth
```

这样可以避免依赖 GitHub Actions 自带的 `schedule`。GitHub 的定时任务可能出现较长延迟，而 Cloudflare Cron 只负责准时触发，GitHub Actions 继续负责实际执行逻辑。

## 定时计划

时区：**Asia/Taipei（台北时间）**

工作日每天执行两次：

- 05:50
- 11:05

Cloudflare Cron 使用 UTC 时间，因此实际配置为：

| Cloudflare Cron | 台北时间 |
| --- | --- |
| `50 21 * * SUN-THU` | 周一～周五 05:50 |
| `5 3 * * MON-FRI` | 周一～周五 11:05 |

Cloudflare Workers 的星期编号与部分传统 Cron 实现不同，因此这里直接使用 `SUN-THU`、`MON-FRI`，避免数字星期产生歧义。

## 项目结构

```text
.
├── .github/
│   └── workflows/
│       └── codex-refresh-time.yml
├── cloudflare-worker/
│   ├── src/
│   │   └── index.js
│   └── wrangler.jsonc
└── README.MD
```

其中：

- `cloudflare-worker/`：负责 Cloudflare Cron 和触发 GitHub Actions。
- `.github/workflows/codex-refresh-time.yml`：负责真正执行 Codex prime、检查额度以及刷新 OAuth。

GitHub workflow 本身只保留：

```yaml
on:
  workflow_dispatch:
```

不再使用 GitHub 自带的 `schedule`，避免重复执行和调度延迟。

## Cloudflare Worker

Worker 会调用 GitHub 的 `workflow_dispatch` API，触发：

- Repository：`warerwang/codex-scheduler`
- Workflow：`.github/workflows/codex-refresh-time.yml`
- Ref：`main`

### GitHub Token

为 Cloudflare Worker 单独创建一个 GitHub Fine-grained Personal Access Token。

建议只授权：

```text
Repository:
warerwang/codex-scheduler

Repository permissions:
Actions: Read and write
```

不要复用 GitHub Actions 内部用于更新 Secrets 的高权限 Token。

Cloudflare 中的 Secret 名称固定为：

```text
GITHUB_TOKEN
```

设置 Secret：

```bash
cd cloudflare-worker
npx wrangler secret put GITHUB_TOKEN
```

查看当前 Secret：

```bash
npx wrangler secret list
```

注意：不要把 GitHub PAT 提交到仓库，也不要把 PAT 本身误当成 Secret 名称。

## 部署 Cloudflare Worker

首次使用先登录 Cloudflare：

```bash
cd cloudflare-worker
npx wrangler login
```

也可以使用 Device Login：

```bash
npx wrangler login --device
```

确认登录状态：

```bash
npx wrangler whoami
```

设置 GitHub Token：

```bash
npx wrangler secret put GITHUB_TOKEN
```

部署：

```bash
npx wrangler deploy
```

成功后应看到类似：

```text
Deployed codex-scheduler-trigger triggers
  schedule: 50 21 * * SUN-THU
  schedule: 5 3 * * MON-FRI
```

Cron Trigger 由 `cloudflare-worker/wrangler.jsonc` 统一管理，不需要在 Cloudflare Dashboard 中手动重复添加。

## 本地测试 Cloudflare Scheduled Event

启动本地 Worker：

```bash
cd cloudflare-worker
npx wrangler dev
```

然后触发本地 scheduled event：

```bash
curl "http://localhost:8787/cdn-cgi/local/scheduled?format=json"
```

如果 GitHub Token 和 Worker 配置正确，会触发 GitHub Actions 的 `workflow_dispatch`。

## GitHub Actions Secrets

现有 GitHub Actions Secrets 保持不变：

- `CODEX_AUTH_JSON_1`
- `CODEX_AUTH_JSON_2`
- `GH_SECRET_WRITE_TOKEN`

其中：

- `CODEX_AUTH_JSON_1`：第一个 Codex / ChatGPT 账号的 OAuth 信息。
- `CODEX_AUTH_JSON_2`：第二个 Codex / ChatGPT 账号的 OAuth 信息。
- `GH_SECRET_WRITE_TOKEN`：当 Codex CLI 刷新 OAuth 后，用于把新的 `auth.json` 写回 GitHub Secrets。

## Codex Prime 逻辑

GitHub Actions 首先使用当前 `access_token` 发起轻量 HTTP 请求。

正常情况下：

```text
HTTP request
→ 200
→ prime 成功
```

单次请求通常只消耗非常少的 token。

如果返回 `401 Unauthorized`：

```text
HTTP request
→ 401
→ Codex CLI fallback
→ 自动刷新 OAuth
→ auth.json 更新
→ 写回 GitHub Secret
→ prime 完成
```

这样不需要人工定期更新 OAuth Token。

## 查看运行情况

Cloudflare 负责调度，GitHub Actions 负责执行，因此主要在 GitHub Actions 页面查看执行结果：

```text
https://github.com/warerwang/codex-scheduler/actions
```

Cloudflare 自动触发的 GitHub Actions 运行事件类型会显示为：

```text
workflow_dispatch
```

而不是：

```text
schedule
```

## 安全说明

建议始终保持两个 GitHub Token 分离：

```text
Cloudflare GITHUB_TOKEN
→ 仅 Actions: Read and write
→ 只负责触发 workflow

GitHub GH_SECRET_WRITE_TOKEN
→ 用于更新 Codex OAuth Secrets
→ 不提供给 Cloudflare
```

这样即使 Cloudflare 侧 Token 泄漏，也不会获得修改 GitHub Secrets 的权限。
