import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { checkLimit } from '@/lib/rateLimit';

const Body = z.object({
  description: z.string().min(3),
  context: z.object({
    day_of_week: z.number().int().min(0).max(6),
    group_size: z.number().int().min(1).max(50),
    company_type: z.string(),
    beers_already: z.number().int().min(0).max(20)
  }),
  beerMeta: z.object({ name: z.string().optional() }).optional()
});

const categories = [
  'taste','bitterness','aroma','smoothness','carbonation','temperature',
  'music','lighting','crowd_vibe','cleanliness','decor'
] as const;

type Ratings = Record<typeof categories[number], number>;

export async function POST(req: NextRequest) {
  try {
    const authz = req.headers.get('authorization') || '';
    const token = authz.startsWith('Bearer ') ? authz.slice('Bearer '.length) : null;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = supabaseAdmin();
    const { data: authUser, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !authUser?.user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    const userId = authUser.user.id;

    const limit = await checkLimit(`ai:${userId}`);
    if (!limit.success) {
        const retry = limit.reset; // ms timestamp
        return NextResponse.json({ error: 'Rate limit exceeded (30/hour). Try later.' }, { status: 429, headers: {
            'Retry-After': Math.ceil((retry - Date.now())/1000).toString() }});
    }

    const { description, context, beerMeta } = Body.parse(await req.json());

    // JSON Schema for ratings + overall + review
    const schema = {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries([
        ...categories.map(k => [k, { type: "integer", minimum: 0, maximum: 10 }]),
        ["overall", { type: "integer", minimum: 0, maximum: 10 }],
        ["review",  { type: "string" }]
      ]),
      required: [...categories, "overall", "review"]
    };

    // Try primary model, fall back if needed
    const result = await callOpenAI({
      model: process.env.OPENAI_MODEL_PRIMARY ?? 'gpt-4.1-mini',
      description,
      context,
      beerMeta,
      schema
    }).catch(async () => {
      return callOpenAI({
        model: process.env.OPENAI_MODEL_FALLBACK ?? 'gpt-4.1',
        description,
        context,
        beerMeta,
        schema
      });
    });

    // Validate and coerce safe output
    const ratings: Ratings = Object.fromEntries(categories.map(k => {
      const v = Number.isFinite(result[k]) ? Math.max(0, Math.min(10, Number(result[k]))) : 5;
      return [k, v];
    })) as Ratings;

    const overall: number = Number.isFinite(result.overall)
      ? Math.max(0, Math.min(10, Number(result.overall)))
      : Math.round(
          (0.6 * avg(['taste','aroma','smoothness','temperature'], ratings)) +
          (0.3 * avg(['music','lighting','crowd_vibe','cleanliness','decor'], ratings)) +
          (0.1 * clamp(10 - context.beers_already, 0, 10))
        );

    const ai_review: string = typeof result.review === 'string' && result.review.length
      ? result.review
      : `Tastes ${word(ratings.taste)}, ${word(ratings.bitterness)} bitterness; ${word(ratings.smoothness)} mouthfeel; ${word(ratings.crowd_vibe)} crowd.`;

    return NextResponse.json({ ratings, overall, ai_review });

  } catch (e: any) {
    const ratings = Object.fromEntries(categories.map(k => [k, 5])) as Ratings;
    return NextResponse.json({ ratings, overall: 5, ai_review: 'Balanced profile.', error: e.message }, { status: 200 });
  }
}

async function callOpenAI(args: {
  model: string;
  description: string;
  context: { day_of_week: number; group_size: number; company_type: string; beers_already: number };
  beerMeta?: { name?: string };
  schema: any;
}) {
  const userPayload = JSON.stringify({
    description: args.description,
    context: args.context,
    beerMeta: args.beerMeta ?? {}
  });

  const payload = {
    model: args.model,
    temperature: 0.2,
    max_output_tokens: 300,
    instructions:
      "Convert beer + ambiance descriptions into 0–10 integer ratings and a short review. " +
      "Return ONLY JSON that satisfies the provided JSON schema. No extra prose.",
    text: {
      format: {
        type: "json_schema",
        name: "beer_ratings", // <-- moved here (was nested before)
        schema: {
          $schema: "http://json-schema.org/draft-07/schema#",
          type: "object",
          additionalProperties: false,
          properties: {
            taste:        { type: "integer", minimum: 0, maximum: 10 },
            bitterness:   { type: "integer", minimum: 0, maximum: 10 },
            aroma:        { type: "integer", minimum: 0, maximum: 10 },
            smoothness:   { type: "integer", minimum: 0, maximum: 10 },
            carbonation:  { type: "integer", minimum: 0, maximum: 10 },
            temperature:  { type: "integer", minimum: 0, maximum: 10 },
            music:        { type: "integer", minimum: 0, maximum: 10 },
            lighting:     { type: "integer", minimum: 0, maximum: 10 },
            crowd_vibe:   { type: "integer", minimum: 0, maximum: 10 },
            cleanliness:  { type: "integer", minimum: 0, maximum: 10 },
            decor:        { type: "integer", minimum: 0, maximum: 10 },
            overall:      { type: "integer", minimum: 0, maximum: 10 },
            review:       { type: "string" }
          },
          required: ["taste","bitterness","aroma","smoothness","carbonation","temperature",
                     "music","lighting","crowd_vibe","cleanliness","decor","overall","review"]
        },
        strict: true
      }
    },
    // <<< Simpler: just a string. No role/content parts.
    input: `Data:\n${userPayload}`
  } as const;

  const resp = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY!}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  console.log(`[ai] OpenAI response: ${resp.status} ${resp.statusText}`);
  console.log(JSON.stringify(userPayload))

  // Better visibility into 400s:
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`OpenAI error ${resp.status}: ${errBody}`);
  }

  const data: any = await resp.json();

  // The Responses API typically provides output_text containing your JSON.
  const jsonText: string =
    data.output_text ??
    data.output?.[0]?.content?.find((c: any) => c?.type === 'output_text')?.text ??
    data.output?.[0]?.content?.[0]?.text ??
    data.choices?.[0]?.message?.content ??
    '{}';

  try { return JSON.parse(jsonText); } catch { return {}; }
}

function avg(keys: string[], r: Ratings) { return Math.round(keys.reduce((s,k)=>s+(r as any)[k],0)/keys.length); }
function clamp(n:number,min:number,max:number){ return Math.max(min, Math.min(max, n)); }
function word(n:number){ return n>=8?'high':n>=5?'moderate':'low'; }
