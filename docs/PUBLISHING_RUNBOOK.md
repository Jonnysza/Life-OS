# Life OS Publishing Runbook

This is the operational checklist for turning Life OS from a personal build into a public product.

## Tier 1: Personal Production

- Verify local build: `npm run verify`
- Verify required local env: `npm run env:check`
- Verify live deployment: `npm run smoke:prod`
- Confirm Vercel production deploy is serving the latest Git commit.
- Confirm Upstash Redis env vars exist in Vercel: `KV_REST_API_URL`, `KV_REST_API_TOKEN`.
- Confirm AI env vars exist in Vercel: `ANTHROPIC_API_KEY`.
- Confirm push env vars exist in Vercel: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- Optional for direct Google Calendar sync/import: add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and set the OAuth redirect URI in Google Cloud to `https://life-os-nine-ruby.vercel.app/api/google/calendar/callback`. The one-way calendar feed works without these keys.
- Add `CRON_SECRET` in Vercel before exposing minute-level cron externally.
- Configure minute trigger:
  - Free path: cron-job.org calls `https://life-os-nine-ruby.vercel.app/api/cron/notify` every minute with `Authorization: Bearer <CRON_SECRET>`.
  - Repo fallback: GitHub Actions workflow `Reminder Cron` calls the same endpoint every 5 minutes. This is free but may run late, so it is good enough for testing and light personal use.
  - Paid path: Vercel Pro native cron every minute.
  - Important: `vercel.json` intentionally does not declare a minute cron so the project can deploy on Vercel Hobby.
- Reinstall the PWA on phone after service worker changes: remove home-screen app, open Safari/Chrome, install again.
- Test Settings -> Push notifications -> Enable -> Send test.
- Test Settings -> Google Calendar:
  - Feed path: copy the Life OS calendar feed into Google Calendar -> Other calendars -> From URL.
  - Direct path: connect Google, create a timed Life OS task, run Sync now, then confirm a Google Calendar event appears with popup reminders.
- Create a todo time block 2 minutes in the future, wait for notification, tap Done, verify it marks complete.

## Tier 2: Public Multi-User PWA

- Add auth: Supabase Auth or Clerk.
- Move user-owned app data from localStorage-only to cloud sync.
- Keep localStorage as offline cache.
- Add rate limiting around `/api/agent`.
- Add onboarding: "What are you trying to become?", work hours, sleep hours, notification intensity.
- Add billing gate: free tier + paid plan.
- Add privacy policy, terms, support email, and data deletion flow.
- Add analytics and error reporting.
- Add landing page and pricing page.

## Tier 3: App Store Launch

- Wrap PWA with Capacitor for iOS.
- Add native notification bridge if App Store review rejects pure web push behavior.
- Create Apple Developer account.
- Create Google Play Console account.
- Produce app icons, splash screens, screenshots, and store copy.
- Add privacy nutrition labels.
- Submit TestFlight first, then App Store review.
- For Android, package as a Trusted Web Activity or Capacitor Android shell.

## Current Hard Blockers

- Production must serve the latest commit containing `/api/cron/notify`, `/api/push/schedule`, `/api/push/ack`, and `/api/push/completed`.
- Minute-level notification execution needs cron-job.org or Vercel Pro.
- Direct Google Calendar sync needs OAuth credentials in Vercel and the matching Google Cloud redirect URI.
- For public launch, user data needs authentication and cloud sync.
