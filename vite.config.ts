import vinext from "vinext";
import { defineConfig } from "vite";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";
const isVercelBuild = process.env.VERCEL === "1";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: [],
  r2_buckets: [],
};

export default defineConfig(async () => {
  // Vercel only needs vinext's portable static-export pipeline. Loading the
  // Cloudflare and OpenAI Sites plugins here makes Vercel build a Worker-shaped
  // artifact that it cannot deploy as this project's web output.
  if (isVercelBuild) {
    return {
      plugins: [vinext()],
    };
  }

  // Keep Wrangler and Miniflare state project-local for Sites/Cloudflare builds.
  // These are non-secret tool settings; application environment belongs in
  // ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const [{ cloudflare }, { sites }] = await Promise.all([
    import("@cloudflare/vite-plugin"),
    import("./build/sites-vite-plugin"),
  ]);

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: localBindingConfig,
      }),
    ],
  };
});
