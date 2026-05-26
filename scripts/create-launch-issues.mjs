const repo = process.env.GITHUB_REPOSITORY || process.argv[2];
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

if (!repo || !/^[^/]+\/[^/]+$/.test(repo)) {
  console.error("Usage: GH_TOKEN=... node scripts/create-launch-issues.mjs owner/repo");
  process.exit(1);
}

if (!token) {
  console.error("Missing GH_TOKEN or GITHUB_TOKEN.");
  process.exit(1);
}

const issues = [
  {
    title: "[Tier 1] Configure minute reminder cron",
    labels: ["launch", "tier-1", "notifications"],
    body: [
      "Outcome: time-block reminders fire every minute in production.",
      "",
      "- [ ] Add CRON_SECRET in Vercel",
      "- [ ] Create cron-job.org job for /api/cron/notify every minute",
      "- [ ] Pass Authorization: Bearer <CRON_SECRET>",
      "- [ ] Create phone time-block 2 minutes out",
      "- [ ] Verify Done / 5 min actions",
    ].join("\n"),
  },
  {
    title: "[Tier 1] Daily rhythm pushes",
    labels: ["launch", "tier-1", "notifications"],
    body: [
      "Outcome: Life OS pushes a morning brief, block check-ins, and wind-down review.",
      "",
      "- [ ] Morning brief endpoint",
      "- [ ] Wind-down endpoint",
      "- [ ] Sunday weekly review endpoint",
      "- [ ] Notification copy variants",
    ].join("\n"),
  },
  {
    title: "[Tier 2] Authentication and cloud sync",
    labels: ["launch", "tier-2", "sync"],
    body: [
      "Outcome: users can log in and see the same data across phone and desktop.",
      "",
      "- [ ] Pick Supabase Auth or Clerk",
      "- [ ] Add user table/data model",
      "- [ ] Sync goals/todos/events/habits/stickies",
      "- [ ] Keep localStorage as offline cache",
      "- [ ] Add account deletion/export",
    ].join("\n"),
  },
  {
    title: "[Monetization] Stripe founder plan",
    labels: ["monetization", "billing"],
    body: [
      "Outcome: first 100 users can buy a founder plan.",
      "",
      "- [ ] Create Stripe product",
      "- [ ] Add checkout route",
      "- [ ] Add webhook route",
      "- [ ] Gate Pro features",
      "- [ ] Add pricing page",
    ].join("\n"),
  },
  {
    title: "[Tier 3] App store wrapper",
    labels: ["launch", "tier-3", "mobile"],
    body: [
      "Outcome: Life OS can enter TestFlight and Play internal testing.",
      "",
      "- [ ] Pick Capacitor vs Trusted Web Activity",
      "- [ ] Generate icons/screenshots",
      "- [ ] Add native notification capability if needed",
      "- [ ] Prepare privacy labels",
      "- [ ] Submit internal build",
    ].join("\n"),
  },
];

async function createIssue(issue) {
  const res = await fetch(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
    },
    body: JSON.stringify(issue),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`${issue.title}: ${res.status} ${JSON.stringify(json)}`);
  }
  console.log(`created: #${json.number} ${json.title}`);
}

for (const issue of issues) {
  await createIssue(issue);
}
