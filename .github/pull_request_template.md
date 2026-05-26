## What changed

-

## Verification

- [ ] `npm run verify`
- [ ] `npm run smoke:prod` if production behavior changed

## Launch risk

- [ ] No secrets committed
- [ ] No env var added without updating `.env.local.example`
- [ ] Phone/PWA behavior tested if service worker, push, or manifest changed
