export default {
  async scheduled(controller, env) {
    const repository = env.GITHUB_REPOSITORY || "warerwang/codex-scheduler";
    const workflow = env.GITHUB_WORKFLOW || "codex-refresh-time.yml";
    const ref = env.GITHUB_REF || "main";

    if (!env.GITHUB_TOKEN) {
      throw new Error("Missing GITHUB_TOKEN secret");
    }

    const url = `https://api.github.com/repos/${repository}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "codex-scheduler-cloudflare-cron",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `GitHub workflow dispatch failed: ${response.status} ${body}`,
      );
    }

    console.log(
      JSON.stringify({
        result: "WORKFLOW_DISPATCH_OK",
        cron: controller.cron,
        scheduledTime: new Date(controller.scheduledTime).toISOString(),
        repository,
        workflow,
        ref,
      }),
    );
  },
};
