# Only One Is True

**Two lies. One truth. Play together.**

A multiplayer general knowledge quiz for **2–8 players**. Create a room, share its six-character code, and play from any phone or laptop. No accounts or installation required. The entire game is in English.

[Play the live game](https://so-uma-verdade-pedro.grand-toast-2500.chatgpt.site/)

## Features

- Ten randomly selected rounds from a bank of 20 questions.
- Three shuffled statements per question, with exactly one true statement.
- Up to 15 seconds to lock in an answer.
- Immediate reveal when everyone has voted; otherwise reveal at the deadline.
- Secret votes and hidden correct answers until the reveal.
- Seven-second reveals showing each player's choice and a short explanation.
- Ten points per correct answer, a live scoreboard, and a final top-three podium.
- Shared rankings and shared victory for tied players.
- Host-controlled starts and rematches, invite links, and recovery after a page refresh on the same browser.
- Responsive dark indigo, purple, and lime interface with clear selection badges and player avatars.

## How to play

1. Enter a nickname and select **Create a room**.
2. Send friends the room code or use **Copy invite**.
3. Friends open the game, enter a nickname and room code, and select **Join**.
4. The host starts once at least two players have joined.
5. Select the statement you believe is true. Your answer is final once submitted.
6. When all votes arrive or the timer expires, everyone sees the answers.
7. After ten rounds, the highest score wins. Ties share a position.

The maximum score is **100 points**. Incorrect or missing answers earn zero points. Rankings use competition ranking: two players tied for first are both first; the next player is third.

## Architecture

The repository contains the complete game server and two deployment entry points:

| Location | Purpose | Runtime |
| --- | --- | --- |
| `app/` | Original interface and authoritative game API | Vinext / Cloudflare Workers |
| `app/api/game/route.ts` | Room creation, joining, votes, phase transitions and scoring | Cloudflare Workers |
| `app/api/game/questions.ts` | English questions and legacy-room translations | Server only |
| `db/`, `drizzle/` | D1 schema and migration history | Cloudflare D1 |
| `vercel/` | Next.js interface prepared for Vercel | Vercel / Node.js |
| `tests/` | Deterministic game API tests | Node.js 24 |
| `docs/` | API, deployment and development notes | Documentation |

The Vercel interface forwards `/api/game` to the existing public game server through the rewrite in `vercel/vercel.json`. The browser continues making same-origin requests, while shared room state stays in Cloudflare D1. **Publishing the Vercel frontend does not migrate or replace the backend. Keep the backend Site active.** The full backend source is included here for maintenance or an independent Cloudflare deployment.

Clients poll approximately every **700 ms**. The server decides the round, deadline and result using its own clock. Each room is stored as a versioned D1 record. Compare-and-swap updates retry concurrent joins and votes, preventing one player's update from silently overwriting another's. Correct answers and other players' choices are omitted from the response during the question phase.

## Run the Vercel frontend locally

Requirements: **Node.js 24 LTS**, npm, and access to the live game backend.

```bash
git clone https://github.com/pedromcd/only_one_is_true.git
cd only_one_is_true/vercel
npm install
npm run dev
```

Open the localhost address printed by Next.js, normally `http://localhost:3000`.

This mode uses the existing live backend through the configured rewrite. Rooms created in this mode are real backend rooms, not an offline simulation.

To verify the production frontend:

```bash
npm run build
npm start
```

## Deploy to Vercel

1. Import this GitHub repository into Vercel.
2. Set **Root Directory** to **`vercel`**.
3. Select the **Next.js** framework preset.
4. Use `npm install` as the install command and `npm run build` as the build command.
5. Keep the default output directory and deploy.

No environment variables are needed for the default frontend deployment. The API backend URL is already configured in `vercel/vercel.json`. If you deploy a different backend, replace that rewrite destination with its public `/api/game` URL and redeploy.

Do not select the repository root as a Vercel project: the root server targets Cloudflare Workers and imports `cloudflare:workers`.

See [deployment instructions](docs/DEPLOYMENT.md) for backend setup and a post-deployment check.

## Run the complete game locally

The repository root is the original Cloudflare-backed application. It uses the committed pnpm lockfile and supplied runtime scripts.

```bash
corepack enable
pnpm install
npm run build
```

Apply the initial migration to the local D1 database:

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_graceful_rocket_racer.sql
```

Then start development:

```bash
npm run dev
```

Open the address printed by the development server. Local D1 data is separate from production. If you change bindings, rebuild before applying migrations. See [development notes](docs/DEVELOPMENT.md) for the two interfaces and question editing.

## Tests

Run the server behavior tests from the repository root with Node.js 24:

```bash
npm test
```

The tests exercise eight concurrent players, room capacity, host permissions, hidden answers, irreversible votes, early reveals, the 15-second deadline, seven-second reveals, all ten rounds, scoring, ties, rematches and English content in legacy rooms. They use an in-memory D1-compatible test adapter and a controlled clock; they do not require production credentials or create real rooms.

The frontend build and game behavior tests are distinct checks. A build verifies compilation; it does not by itself verify network connectivity to the deployed backend.

## Game API

- `GET /api/game?code=ABC123` returns the current player's authorized room view.
- `POST /api/game` accepts `create`, `join`, `start`, `vote`, or `restart`.
- Requests identify the player with the `x-player-token` header.
- State-changing actions are validated by the server; the browser cannot select the phase or award points.

See [API reference](docs/API.md) for request examples and privacy behavior.

## Session behavior

The browser stores a randomly generated player token, nickname and last room code locally. Refreshing the same browser can restore participation. A new browser or cleared storage creates a new identity. Rooms expire after 24 hours; expiration rejects access but does not currently run a background database cleanup job.

Players cannot join a running game. The current game has no player removal, host transfer or disconnect eviction. A disconnected player remains in the roster, so rounds may wait for the full 15 seconds. The host must return to start a rematch. These rules keep the current room lifecycle simple and predictable.

## Project notes

Created with ChatGPT Work and maintained by **Pedro Marques Correa Domingues** ([pedromcd](https://github.com/pedromcd)).

The game server was originally deployed through ChatGPT Sites. This checkout intentionally excludes deployment credentials, runtime databases, local environment files, build artifacts and the original Site's project identity. The public backend origin remains in the Vercel rewrite because it is required for the default deployment.
