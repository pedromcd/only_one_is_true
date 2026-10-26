# Game API

All responses use JSON and disable caching. Send a browser-generated UUID in `x-player-token`. The token identifies a participant and must remain private to that participant.

## Create

```http
POST /api/game
Content-Type: application/json
x-player-token: <player-uuid>

{"action":"create","name":"Alex"}
```

## Join and start

```json
{"action":"join","name":"Sam","code":"ABC123"}
```

```json
{"action":"start","code":"ABC123"}
```

Joining requires an open lobby, a unique nickname and a free slot. Only the host can start, and at least two players must be present.

## Read state

```http
GET /api/game?code=ABC123
x-player-token: <player-uuid>
```

The response includes room code, current player ID, host ID, player names and scores, phase, zero-based round index, server time, deadline, question, current player's vote and answer count.

During questions, `votes` is `null`; the correct answer and explanation are omitted. During reveals, votes are keyed by player ID, and the correct answer index and explanation are included. Player tokens and the remaining question deck are never part of this view.

## Vote

```json
{"action":"vote","code":"ABC123","round":0,"option":2}
```

Round and option are zero-based. Options must be integers from 0 to 2. The server rejects duplicate votes, votes from outsiders, stale round indices and votes after the deadline. The final participant's vote records an early-reveal timestamp atomically with the vote.

## Rematch

```json
{"action":"restart","code":"ABC123"}
```

Only the host can restart a finished game. The roster stays the same, while question selection, votes and scores reset.

## Errors

Invalid game actions return HTTP 400 with an English `error` message. Rooms become inaccessible after 24 hours. All requests rely on HTTPS in production.
