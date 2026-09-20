// Start only local services, exercise the production build, always stop children.
import { spawn } from "node:child_process";
const children = [];
function start(args) {
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "local-test-key",
    },
  });
  children.push(child);
  return child;
}
async function ready(url) {
  for (let n = 0; n < 90; n++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Local service did not start: ${url}`);
}
try {
  start(["tests/mock-supabase.mjs"]);
  start(["node_modules/next/dist/bin/next", "start"]);
  await Promise.all([
    ready("http://127.0.0.1:54329/__role"),
    ready("http://localhost:3000/login"),
  ]);
  const test = start(["tests/visual-browser-check.mjs"]);
  const code = await new Promise((resolve, reject) => {
    test.on("error", reject);
    test.on("exit", resolve);
  });
  if (code !== 0) process.exitCode = 1;
} finally {
  for (const child of children) child.kill();
}
