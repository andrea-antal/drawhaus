// The prompt: a player describes a home, and Claude picks the house from drawhaus's own parts.
// Vercel runs each file in api/ as a function, at /api/<name>. With no framework it must be an ES module, hence .mjs
// (https://vercel.com/docs/functions/functions-api-reference). The key is the ANTHROPIC_API_KEY environment variable;
// the spend cap on that key bounds what the prompt can cost.
// ponytail: no per-player rate limit; one player can spend the cap. Add a per-IP limit if that happens.
import Anthropic from '@anthropic-ai/sdk';

// The parts, named as the engine in index.html names them. A test keeps the two lists the same.
export const ROOMS = ['lab', 'kitchen', 'dining', 'living', 'bedroom', 'bathroom', 'office'];
export const ROOF_STYLES = ['gable', 'steep', 'barn'];
export const WINDOW_STYLES = ['classic', 'shutters', 'arched', 'round'];
export const EXTRAS = ['heat pump', 'rain barrel', 'EV charger', 'delivery box', 'cat', 'dog', 'fish',
  'boxes', 'trunk', 'rocking horse', 'dress form', 'Christmas tree', 'fairy lights'];
const MAX = 200; // the most letters a player can type

// One field per room, so the answer always has all 7: the API's schemas cannot fix an array's length.
const SLOTS = ['ground_1', 'ground_2', 'ground_3', 'ground_4', 'upstairs_1', 'upstairs_2', 'upstairs_3'];
const one = (list) => ({ type: 'string', enum: list });
export const SCHEMA = {
  type: 'object',
  properties: {
    ...Object.fromEntries(SLOTS.map((s) => [s, one(ROOMS)])),
    roof: one(ROOF_STYLES),
    windows: one(WINDOW_STYLES),
    extras: { type: 'array', items: one(EXTRAS) },
  },
  required: [...SLOTS, 'roof', 'windows', 'extras'],
  additionalProperties: false,
};

const SYSTEM = `You furnish a toy dollhouse that a ballpoint pen draws. A player describes a home in their own words; \
choose the house from the parts in the schema that comes closest to it.
- 4 rooms on the ground floor and 3 upstairs, numbered from the far end to the end with the front door. A room can repeat.
- Extras: things outside (heat pump, rain barrel, EV charger, delivery box), pets (cat, dog, fish) and things in the \
attic (the rest). Choose the ones the description asks for or that suit it; none is fine.
- Where the description says nothing, choose what suits the home it describes.`;

// The house for these words, or null when Claude gives none (a refusal, an answer cut off, a part the engine has not got).
export async function describe(words, client) {
  const res = await client.messages.create({
    model: 'claude-haiku-5-5',
    max_tokens: 2000, // room for its thinking and the answer
    system: SYSTEM,
    messages: [{ role: 'user', content: words }],
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
  });
  if (res.stop_reason !== 'end_turn') return null;
  const a = JSON.parse(res.content.find((b) => b.type === 'text').text), rooms = SLOTS.map((s) => a[s]);
  if (!rooms.every((r) => ROOMS.includes(r)) || !ROOF_STYLES.includes(a.roof) || !WINDOW_STYLES.includes(a.windows)) return null;
  return { rooms, roof: a.roof, windows: a.windows, extras: EXTRAS.filter((x) => a.extras.includes(x)) };
}

// Whether the prompt is on here: the page shows its field only when this answers 204.
export function GET() {
  return new Response(null, { status: process.env.ANTHROPIC_API_KEY ? 204 : 503 });
}

// POST {words} -> the house, 400 for words it will not send, 422 when Claude gives no house, 429 or 502 when Claude
// cannot answer now (busy, or the key at its cap).
export async function POST(request) {
  const { words } = await request.json().catch(() => ({}));
  if (typeof words !== 'string' || !words.trim() || words.length > MAX) return Response.json({ error: 'words' }, { status: 400 });
  try {
    const house = await describe(words.trim(), new Anthropic());
    return house ? Response.json(house) : Response.json({ error: 'no house' }, { status: 422 });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: 'busy' }, { status: 429 });
    if (e instanceof Anthropic.APIError) {
      console.error('drawhaus prompt:', e.status, e.message);
      return Response.json({ error: 'unavailable' }, { status: 502 });
    }
    throw e;
  }
}
