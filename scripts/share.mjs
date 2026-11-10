// npm run share: serves GroupOrder from this computer to other people, with no Supabase or Vercel.
//
// It builds the production app, runs it on the local database (.local, the same one
// npm run dev:local uses, so stop that first) and prints:
//   - a link for phones and laptops on the same Wi-Fi, always;
//   - a public https link through a Cloudflare quick tunnel, if `cloudflared` is installed
//     (on PATH, at ~/opt/cloudflared, or named by CLOUDFLARED=/path/to/cloudflared).
// The demo accounts get a private password, saved in .local/share-password, because the app is
// reachable by others. It only works while this computer is on, and the public link changes
// every time it starts.
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, networkInterfaces } from "node:os";
import { join } from "node:path";

const PORT = "3000";
const BACKEND_PORT = "54321";
const DATA = process.env.LOCAL_DATA_DIR ?? ".local";

const busy = await fetch(`http://localhost:${PORT}/`).then(() => true, () => false);
if (busy) {
  console.error(`Something already runs on port ${PORT}. Stop npm run dev:local first: both use the same local database.`);
  process.exit(1);
}

mkdirSync(DATA, { recursive: true });
const passwordFile = join(DATA, "share-password");
if (!existsSync(passwordFile)) writeFileSync(passwordFile, randomBytes(9).toString("base64url"), { mode: 0o600 });
const password = readFileSync(passwordFile, "utf8").trim();

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${BACKEND_PORT}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local",
  NEXT_PUBLIC_LOCAL_BACKEND: "1",
  NEXT_PUBLIC_SHARED: "1",
};

if (!process.argv.includes("--no-build")) {
  console.log("Building the app (about a minute; pass --no-build to reuse the last build)...");
  const build = spawnSync("node_modules/.bin/next", ["build"], { stdio: "inherit", env });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const app = spawn(process.execPath, ["scripts/dev-local.mjs"], {
  stdio: "inherit",
  env: { ...env, PORT, LOCAL_BACKEND_PORT: BACKEND_PORT, LOCAL_NEXT_COMMAND: "start", LOCAL_HOST: "0.0.0.0", LOCAL_DEMO_PASSWORD: password },
});

for (let i = 0; i < 120; i++) {
  if (await fetch(`http://localhost:${PORT}/login`).then((r) => r.ok, () => false)) break;
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

const wifi = Object.values(networkInterfaces()).flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal).map((a) => `http://${a.address}:${PORT}`);

const candidates = [process.env.CLOUDFLARED, "cloudflared", join(homedir(), "opt", "cloudflared")].filter(Boolean);
const cloudflared = candidates.find((c) => spawnSync(c, ["--version"]).status === 0);
let tunnel = null;

function report(publicUrl) {
  console.log(`
==================================================================
 GroupOrder is shared from this computer.

 On this computer:   http://localhost:${PORT}
 Same Wi-Fi:         ${wifi.join("  ") || "(no network found)"}
 Public link:        ${publicUrl ?? "none: install cloudflared for a link anyone can open"}

 Demo logins: temur@demo.test (leader), minji@demo.test, jisoo@demo.test,
 dana@demo.test. Password: ${password}
 Others can also sign up with any email.

 Press Ctrl+C to stop sharing.
==================================================================
`);
}

if (cloudflared) {
  tunnel = spawn(cloudflared, ["tunnel", "--no-autoupdate", "--url", `http://localhost:${PORT}`]);
  let shown = false;
  const watch = (chunk) => {
    const link = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(chunk.toString())?.[0];
    if (link && !shown) { shown = true; report(link); }
  };
  tunnel.stdout.on("data", watch);
  tunnel.stderr.on("data", watch);
  tunnel.on("exit", (code) => { if (!shown) { console.log(`cloudflared stopped (${code}).`); report(null); } });
} else {
  report(null);
}

const stop = () => {
  tunnel?.kill();
  app.kill("SIGTERM");
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
app.on("exit", (code) => { tunnel?.kill(); process.exit(code ?? 0); });
