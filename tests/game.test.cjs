/** Deterministic API checks with a D1-compatible adapter; no production access. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'only-one-tests-'));
const questions = fs.readFileSync(path.join(root, 'app/api/game/questions.ts'), 'utf8').replaceAll('export const', 'const');
const route = fs.readFileSync(path.join(root, 'app/api/game/route.ts'), 'utf8')
  .replace("import { env } from 'cloudflare:workers';", 'const env=globalThis.testEnv;')
  .replace("import { bank, english } from './questions';", questions);
const fixture = path.join(temp, 'route.ts');
fs.writeFileSync(fixture, route);
const rooms = new Map();
globalThis.testEnv = { DB: { prepare(sql) {
  let args;
  return {
    bind(...values) { args = values; return this; },
    async first() { const row = rooms.get(args[0]); return row ? { ...row } : null; },
    async run() {
      if (sql.startsWith('INSERT')) {
        if (rooms.has(args[0])) throw new Error('Duplicate room code');
        rooms.set(args[0], { data: args[1], version: 0 });
        return { meta: { changes: 1 } };
      }
      const row = rooms.get(args[1]);
      if (row.version !== args[2]) return { meta: { changes: 0 } };
      rooms.set(args[1], { data: args[0], version: row.version + 1 });
      return { meta: { changes: 1 } };
    },
  };
} } };
const { GET, POST } = require(fixture);
const realNow = Date.now;
let now = realNow();
Date.now = () => now;
const tokens = Array.from({ length: 9 }, randomUUID);
let code;
async function post(player, action, extra = {}) {
  const response = await POST(new Request('https://test.local/api/game', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-player-token': tokens[player] },
    body: JSON.stringify({ code, action, name: `Player ${player}`, ...extra }),
  }));
  return { status: response.status, ...await response.json() };
}
async function get(player) {
  return (await GET(new Request(`https://test.local/api/game?code=${code}`, {
    headers: { 'x-player-token': tokens[player] },
  }))).json();
}
async function main() {
  let result = await post(0, 'create');
  assert.equal(result.status, 200);
  code = result.code;
  const joins = await Promise.all(tokens.slice(1, 8).map((_, i) => post(i + 1, 'join')));
  assert(joins.every(result => result.status === 200));
  assert.equal((await post(8, 'join')).status, 400);
  assert.equal((await post(1, 'start')).status, 400);
  assert.equal((await post(0, 'start')).status, 200);
  for (let round = 0; round < 10; round++) {
    result = await get(0);
    assert.equal(result.round, round);
    assert.equal(result.question.title, 'Which of these statements is true?');
    assert.equal(result.votes, null);
    assert(!('correct' in result.question));
    const correct = JSON.parse(rooms.get(code).data).deck[round].correct;
    const votes = await Promise.all(tokens.slice(0, 7).map((_, player) => post(player, 'vote', {
      round, option: player < 2 ? correct : (correct + 1) % 3,
    })));
    assert(votes.every(result => result.status === 200));
    assert.equal((await get(0)).votes, null);
    assert.equal((await post(0, 'vote', { round, option: correct })).status, 400);
    if (round % 2 === 0) {
      now += 2000;
      assert.equal((await post(7, 'vote', { round, option: (correct + 1) % 3 })).status, 200);
      result = await get(0);
      assert.equal(Object.keys(result.votes).length, 8);
      assert.equal(result.deadline, now + 7000);
    } else {
      now += 14999;
      assert.equal((await get(0)).phase, 'question');
      now++;
      result = await get(0);
      assert.equal(Object.keys(result.votes).length, 7);
    }
    assert.equal(result.phase, 'reveal');
    assert.equal(result.players[0].score, (round + 1) * 10);
    assert.equal(result.players[1].score, (round + 1) * 10);
    assert.equal(result.players[2].score, 0);
    assert.equal((await post(7, 'vote', { round, option: correct })).status, 400);
    now += 7000;
  }
  result = await get(0);
  assert.equal(result.phase, 'finished');
  assert.equal(result.players.filter(player => player.score === 100).length, 2);
  assert.equal((await post(1, 'restart')).status, 400);
  assert.equal((await post(0, 'restart')).status, 200);
  const row = rooms.get(code);
  const legacy = JSON.parse(row.data);
  legacy.deck[0] = { category: 'Tecnologia', title: 'Qual destas afirmações é verdadeira?',
    options: ['Um byte contém oito bits.', 'Um byte contém quatro bits.', 'Um byte contém dezesseis bits.'],
    correct: 0, explanation: 'O byte é uma unidade formada por oito bits.' };
  rooms.set(code, { ...row, data: JSON.stringify(legacy) });
  result = await get(0);
  assert.equal(result.question.category, 'Technology');
  assert.equal(result.question.options[0], 'One byte contains eight bits.');
  console.log('PASS: capacity, concurrent joins/votes, host permissions, secret answers, early reveal, timeout, 10 rounds, scoring, ties, rematch, and English legacy rooms.');
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  Date.now = realNow;
  delete globalThis.testEnv;
  fs.rmSync(temp, { recursive: true, force: true });
});
