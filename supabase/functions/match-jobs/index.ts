// match-jobs: for a given user, score recent unscored jobs vs their parsed profile
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScoreResult { score: number; reasoning: string }

async function scoreJob(profile: any, job: any, apiKey: string): Promise<ScoreResult | null> {
  const prompt = `Profile:
Summary: ${profile.summary ?? ""}
Years: ${profile.years_experience ?? "?"}
Skills: ${(profile.skills ?? []).join(", ")}

Job: ${job.title} at ${job.company ?? "?"}
Location: ${job.location ?? "?"} ${job.remote ? "(remote)" : ""}
Description: ${(job.description ?? "").replace(/<[^>]+>/g, " ").slice(0, 2500)}

Score how well this candidate fits this job (0-100). Consider skills overlap, seniority fit, role relevance.`;

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "You are a strict technical recruiter. Score honestly." },
        { role: "user", content: prompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "score",
          parameters: {
            type: "object",
            properties: {
              score: { type: "integer", minimum: 0, maximum: 100 },
              reasoning: { type: "string", description: "1 sentence explaining the score" },
            },
            required: ["score", "reasoning"],
            additionalProperties: false,
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "score" } },
    }),
  });
  if (!r.ok) {
    if (r.status === 429 || r.status === 402) throw new Error(`AI ${r.status}`);
    console.error("score err", r.status, await r.text());
    return null;
  }
  const j = await r.json();
  try {
    return JSON.parse(j.choices[0].message.tool_calls[0].function.arguments);
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    const admin = createClient(SUPABASE_URL, SERVICE);

    const { user_id, limit = 25 } = await req.json();
    if (!user_id) throw new Error("user_id required");

    const { data: profile } = await admin.from("parsed_profile").select("*").eq("user_id", user_id).maybeSingle();
    if (!profile) return new Response(JSON.stringify({ error: "No parsed profile" }), { status: 400, headers: corsHeaders });

    // Recent jobs not yet scored for this user
    const { data: existing } = await admin.from("job_matches").select("job_id").eq("user_id", user_id);
    const scoredIds = new Set((existing ?? []).map((m: any) => m.job_id));

    const { data: jobs } = await admin.from("jobs").select("*").order("fetched_at", { ascending: false }).limit(limit * 3);
    const unscored = (jobs ?? []).filter((j: any) => !scoredIds.has(j.id)).slice(0, limit);

    if (unscored.length === 0) return new Response(JSON.stringify({ ok: true, scored: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let scored = 0;
    for (const job of unscored) {
      try {
        const result = await scoreJob(profile, job, LOVABLE_API_KEY);
        if (!result) continue;
        await admin.from("job_matches").upsert({
          user_id, job_id: job.id, score: result.score, reasoning: result.reasoning, status: "new",
        }, { onConflict: "user_id,job_id" });
        scored++;
      } catch (e) {
        console.error("score iter", e);
        if (String(e).includes("429") || String(e).includes("402")) break;
      }
    }

    return new Response(JSON.stringify({ ok: true, scored }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
