# Development

## Runtime requirements

Use Node.js 24 for both applications and the built-in TypeScript support used by the tests. The root application retains the original pnpm lockfile and runtime helpers. The `vercel/` application is an independent minimal Next.js package; run its npm commands from that directory.

## Questions

Edit `app/api/game/questions.ts`. Each bank entry contains a category, prompt, one correct statement, two false statements and an explanation, in that order. The server shuffles both the question selection and answer order. Keep at least ten questions in the bank, ensure exactly one statement is true, and write every field in English.

The legacy translation map lets existing rooms created with Portuguese questions display English without changing their stored answer indices. New games use the English bank directly.

## Room state

The `rooms` table stores `code`, JSON `data` and `version`. Every successful mutation increments `version`. Conditional updates compare the previously read version and retry on conflict. The server calculates each phase from the game start, recorded early-reveal timestamps and fixed durations. A reveal lasts seven seconds whether the question ended early or timed out.

## Interfaces

`app/` is the original Vinext interface. `vercel/app/` is the Next.js interface. Keep their page, layout and CSS synchronized after interface edits. The Vercel version does not duplicate backend code and must retain its `/api/game` rewrite.

## Verification

Run `npm test` at the root. For the frontend, use `cd vercel`, `npm install` and `npm run build`. Test a real deployed room with two independent browsers after changes to hosting or API routing.

## Data and credentials

Do not commit `.env` files, player tokens, `.wrangler` data, local databases, `.vercel` state, source credentials or build output. The original deployment ID is intentionally omitted from this repository's hosting manifest.
