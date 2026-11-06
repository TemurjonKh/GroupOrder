// npm run dev:local: the whole platform on this machine, with no accounts to set up.
import { spawn } from "node:child_process";
import { startLocalBackend } from "./local-backend.mjs";

const appPort = process.env.PORT ?? "3000";
const nextCommand = process.env.LOCAL_NEXT_COMMAND ?? "dev"; // "start" serves a production build
const backend = await startLocalBackend(Number(process.env.LOCAL_BACKEND_PORT ?? 54321));

const app = spawn("node_modules/.bin/next", [nextCommand, "-p", appPort, "-H", "localhost"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: backend.url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local",
    NEXT_PUBLIC_LOCAL_BACKEND: "1",
  },
});
console.log(`\nGroupOrder: http://localhost:${appPort}\nDemo logins: temur@demo.test (leader), minji@demo.test, jisoo@demo.test, dana@demo.test. Password: demo1234\n`);

const stop = async () => {
  app.kill();
  backend.server.close();
  await backend.db.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
app.on("exit", (code) => process.exit(code ?? 0));
