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

const vapidSubject = value("VAPID_SUBJECT").replace(/^"|"$/g, "").trim();
if (vapidSubject && !vapidSubject.startsWith("mailto:") && !/^https?:\/\//.test(vapidSubject)) {
  console.warn("warn: VAPID_SUBJECT should start with mailto: or https://; app will use a safe default");
}

if (!value("CRON_SECRET")) {
  console.warn("warn: CRON_SECRET is optional but recommended before using an external cron trigger");
}

const googleClient = value("GOOGLE_CLIENT_ID");
const googleSecret = value("GOOGLE_CLIENT_SECRET");
if (googleClient || googleSecret) {
  if (!googleClient) {
    console.warn("warn: GOOGLE_CLIENT_ID missing, direct Google Calendar sync will stay disabled");
  }
  if (!googleSecret) {
    console.warn("warn: GOOGLE_CLIENT_SECRET missing, direct Google Calendar sync will stay disabled");
  }
} else {
  console.warn("warn: Google Calendar OAuth keys are optional; add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET for direct sync");
}

process.exit(failed ? 1 : 0);
