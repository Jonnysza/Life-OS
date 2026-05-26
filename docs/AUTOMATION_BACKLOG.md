# Automation Backlog

Use this as the execution queue. Each item should become either a GitHub issue, calendar focus block, or app feature.

## Ship Reliability

- CI on every push.
- Production smoke test every 6 hours.
- Env validation before deploy.
- Vercel deployment health check after every push.
- Cron monitor that alerts if `/api/cron/notify` fails.

## Product Automations

- Morning briefing push.
- Time-block start push.
- Done / 5 more minutes action loop.
- Escalating snooze copy.
- End-of-block check-in.
- Daily wind-down review.
- Sunday weekly planning review.
- Behind-pace goal intervention.

## Business Automations

- Stripe checkout event -> mark user Pro.
- Trial ending email/push.
- Weekly usage recap.
- Founder-plan purchase flow.
- Support intake form -> issue/task.

## Launch Automations

- New release checklist.
- Post-deploy smoke test.
- App Store screenshot generator.
- Landing-page A/B copy log.
- Analytics dashboard review every Monday.

## GitHub Automations Added

- CI workflow runs lint, typecheck, and production build on push and pull request.
- Production smoke workflow runs every 6 hours and can also be triggered manually.
- Dependabot opens weekly dependency update PRs.
- PR template forces verification and launch-risk checks.
- Issue templates standardize bugs and launch tasks.
- `npm run issues:create -- Jonnysza/Life-OS` can generate the launch issue backlog when `GH_TOKEN` is present.
