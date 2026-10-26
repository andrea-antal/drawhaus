// Run: node --test. Tests the prompt in api/drawhaus.mjs with a stand-in for Claude, so it spends nothing.
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import { describe, GET, POST, ROOMS, ROOF_STYLES, WINDOW_STYLES, EXTRAS, SCHEMA } from './api/drawhaus.mjs';

const html = fs.readFileSync(new URL('index.html', import.meta.url), 'utf8');
const ctx = { module: { exports: {} }, URLSearchParams };
vm.runInNewContext(html.match(/<script id="house">([\s\S]*?)<\/script>/)[1], ctx);
const H = ctx.module.exports;

// Claude's side: the request it was sent, and the answer it gives back after a thinking block.
const ANSWER = { ground_1: 'lab', ground_2: 'kitchen', ground_3: 'living', ground_4: 'living',
  upstairs_1: 'bedroom', upstairs_2: 'office', upstairs_3: 'bathroom', roof: 'steep', windows: 'shutters', extras: ['fish', 'cat', 'boxes'] };
const claude = (answer, stop_reason = 'end_turn') => {
  const stub = { messages: { create: async (req) => {
    stub.sent = req;
    return { stop_reason, content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(answer) }] };
  } } };
  return stub;
};

test('the prompt offers the engine’s own parts', () => {
  for (const [mine, its] of [[ROOMS, H.ROOMS], [ROOF_STYLES, H.ROOF_STYLES], [WINDOW_STYLES, H.WINDOW_STYLES], [EXTRAS, H.EXTRAS]]) {
    assert.strictEqual(JSON.stringify(mine), JSON.stringify(its));
  }
});

test('Claude Haiku 5.5 gets the player’s words and a schema with a field for each of the 7 rooms', async () => {
  const c = claude(ANSWER);
  await describe('a cozy cabin for a cat lover who does science', c);
  assert.strictEqual(c.sent.model, 'claude-haiku-5-5');
  assert.deepStrictEqual(c.sent.messages, [{ role: 'user', content: 'a cozy cabin for a cat lover who does science' }]);
  assert.deepStrictEqual(c.sent.output_config.format, { type: 'json_schema', schema: SCHEMA });
  assert.strictEqual(SCHEMA.additionalProperties, false);
  assert.deepStrictEqual(SCHEMA.required, Object.keys(SCHEMA.properties), 'every field is filled');
  assert.strictEqual(SCHEMA.required.filter((k) => /^(ground|upstairs)_/.test(k)).length, H.SLOTS.length);
});

test('the answer becomes a house: rooms ground floor first, the extras in the engine’s order', async () => {
  assert.deepStrictEqual(await describe('…', claude(ANSWER)), {
    rooms: ['lab', 'kitchen', 'living', 'living', 'bedroom', 'office', 'bathroom'],
    roof: 'steep', windows: 'shutters', extras: ['cat', 'fish', 'boxes'],
  });
});

test('a refusal, a cut-off answer or a part the engine has not got gives no house', async () => {
  assert.strictEqual(await describe('…', claude(ANSWER, 'refusal')), null);
  assert.strictEqual(await describe('…', claude(ANSWER, 'max_tokens')), null);
  assert.strictEqual(await describe('…', claude({ ...ANSWER, ground_1: 'garage' })), null);
  assert.strictEqual(await describe('…', claude({ ...ANSWER, roof: 'flat' })), null);
});

test('the page shows the prompt only where the site has a key', () => {
  const key = process.env.ANTHROPIC_API_KEY;
  try {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    assert.strictEqual(GET().status, 204);
    delete process.env.ANTHROPIC_API_KEY;
    assert.strictEqual(GET().status, 503);
  } finally {
    if (key !== undefined) process.env.ANTHROPIC_API_KEY = key;
  }
});

test('blank, too long or broken words never reach Claude', async () => {
  const post = (body) => POST(new Request('http://localhost/api/drawhaus', { method: 'POST', body }));
  for (const body of ['{}', '{"words":"   "}', '{"words":42}', JSON.stringify({ words: 'x'.repeat(201) }), 'not json']) {
    assert.strictEqual((await post(body)).status, 400, body.slice(0, 20));
  }
});
