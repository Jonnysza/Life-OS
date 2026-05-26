const baseUrl = (process.env.PROD_URL ?? "https://life-os-nine-ruby.vercel.app").replace(/\/$/, "");
const cronSecret = process.env.CRON_SECRET;

async function check(name, fn) {
  try {
    await fn();
    console.log(`ok: ${name}`);
  } catch (error) {
    console.error(`fail: ${name}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

async function expectStatus(path, expected, init) {
  const res = await fetch(`${baseUrl}${path}`, init);
  if (res.status !== expected) {
    const body = await res.text().catch(() => "");
    throw new Error(`${path} returned ${res.status}, expected ${expected}. ${body.slice(0, 300)}`);
  }
  return res;
}

await check("homepage", async () => {
  await expectStatus("/", 200);
});

await check("service worker", async () => {
  const res = await expectStatus("/sw.js", 200);
  const text = await res.text();
  if (!text.includes("notificationclick") || !text.includes("/api/push/ack")) {
    throw new Error("service worker does not include notification action handling");
  }
});

await check("agent endpoint", async () => {
  const body = {
    messages: [{ role: "user", content: [{ type: "text", text: "say hi in one word" }] }],
    state: {
      today: "2026-05-26",
      selectedDate: "2026-05-26",
      goals: [],
      habits: [],
      rules: [],
      todosToday: [],
      streak: 0,
    },
  };
  const res = await expectStatus("/api/agent", 200, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!Array.isArray(json.content)) throw new Error("agent response missing content array");
});

await check("push schedule endpoint", async () => {
  const body = { sessionId: "smoke-test", items: [] };
  await expectStatus("/api/push/schedule", 200, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
});

await check("completed endpoint", async () => {
  await expectStatus("/api/push/completed?sessionId=smoke-test", 200);
});

await check("cron endpoint", async () => {
  const headers = cronSecret ? { authorization: `Bearer ${cronSecret}` } : undefined;
  const res = await fetch(`${baseUrl}/api/cron/notify`, { headers });
  if (![200, 401].includes(res.status)) {
    const body = await res.text().catch(() => "");
    throw new Error(`/api/cron/notify returned ${res.status}. ${body.slice(0, 300)}`);
  }
  if (res.status === 401 && cronSecret) throw new Error("CRON_SECRET provided but cron returned 401");
});
