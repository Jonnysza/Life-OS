import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const localEnvPath = resolve(process.cwd(), ".env.local");
const parsed = {};

if (existsSync(localEnvPath)) {
  for (const line of readFileSync(localEnvPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    parsed[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
}

function value(key) {
  return process.env[key] ?? parsed[key] ?? "";
}

const required = [
  "ANTHROPIC_API_KEY",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
];

let failed = false;
for (const key of required) {
  const current = value(key);
  if (!current || current.includes("your-") || current.includes("sk-ant-...")) {
    console.error(`missing: ${key}`);
    failed = true;
  } else {
    console.log(`ok: ${key}`);
  }
}

if (value("VAPID_SUBJECT") && !value("VAPID_SUBJECT").startsWith("mailto:")) {
  console.error("invalid: VAPID_SUBJECT must start with mailto:");
  failed = true;
}

if (!value("CRON_SECRET")) {
  console.warn("warn: CRON_SECRET is optional but recommended before using an external cron trigger");
}

process.exit(failed ? 1 : 0);
