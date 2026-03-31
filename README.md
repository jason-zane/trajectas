## Local Development

Run the normal development server:

```bash
npm run dev
```

Open `http://localhost:3002`.

## Safe-To-Deploy Workflow

Keep this simple. Before shipping changes:

1. Run `npm run lint`
2. Run `npm run typecheck`
3. Run `npm run test:coverage`
4. Run the seeded full-stack check when you changed auth, campaigns, participants, or runner flows:

```bash
npm run db:test:start
npm run db:test:reset
npm run test:e2e:seeded
npm run db:test:stop
```

If you only changed general UI or non-seeded flows, the lighter browser check is usually enough:

```bash
npm run test:e2e:smoke
```

## What GitHub Checks

GitHub blocks changes automatically if any of these fail:

- dependency vulnerability audit
- committed secret scan
- lint
- typecheck
- unit, integration, and component tests
- production build
- browser smoke tests

That means the simplest rule is:

- if GitHub is green and your local checks are green, it is safe to deploy

## After Deploy

Do one short manual check in production:

1. open the dashboard
2. open campaigns
3. open participants
4. open one live assessment link
5. confirm there are no auth or loading errors
