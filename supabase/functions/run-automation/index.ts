// run-automation: orchestrator. Optional user_id (single) or runs for all users.
// 1) fetch jobs (if stale) 2) match for user(s) 3) tailor top N above threshold 4) notify via telegram
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callFn(name: string, body: any) {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const r = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    console.error(`${name} failed`, r.status, t);
    return null;
  }
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE);

    const body = await req.json().catch(() => ({}));
    const targetUserId: string | undefined = body.user_id;

    // 1. Refresh jobs if last fetch >30 min ago, or always if user-triggered
    const { data: state } = await admin.from("automation_state").select("last_job_fetch").eq("id", 1).single();
    const lastFetch = state?.last_job_fetch ? new Date(state.last_job_fetch).getTime() : 0;
    const stale = Date.now() - lastFetch > 30 * 60_000;
    if (stale || targetUserId) {
      await callFn("fetch-jobs", {});
    }

    // 2. Determine user(s) to process
    let userIds: string[] = [];
    if (targetUserId) {
      userIds = [targetUserId];
    } else {
      const { data } = await admin.from("telegram_settings").select("user_id").eq("paused", false);
      userIds = (data ?? []).map((r: any) => r.user_id);
    }

    let totalNotified = 0;

    for (const uid of userIds) {
      // Need parsed profile; if missing, try to parse the active CV
      let { data: profile } = await admin.from("parsed_profile").select("id").eq("user_id", uid).maybeSingle();
      if (!profile) {
        const { data: activeCv } = await admin.from("cv_documents").select("id").eq("user_id", uid).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (activeCv) {
          console.log("run-automation: parsing CV for", uid);
          // parse-cv requires user auth header; call admin path: re-implement minimal trigger via direct call with service role isn't possible (parse-cv checks user). Skip for now.
        }
        console.log("run-automation: skipping user without parsed profile", uid);
        continue;
      }

      const { data: tg } = await admin.from("telegram_settings").select("*").eq("user_id", uid).single();
      if (!tg) continue;

      // 3. Score new jobs
      await callFn("match-jobs", { user_id: uid, limit: 25 });

      // 4. Get unnotified matches above threshold
      const { data: matches } = await admin
        .from("job_matches")
        .select("id, score, job_id")
        .eq("user_id", uid)
        .gte("score", tg.match_threshold)
        .eq("status", "new")
        .order("score", { ascending: false })
        .limit(tg.daily_limit);

      for (const m of matches ?? []) {
        // Skip if application already exists
        const { data: existing } = await admin.from("applications").select("id, tailored_cv_path").eq("user_id", uid).eq("job_id", m.job_id).maybeSingle();

        let appId = existing?.id;
        if (!existing?.tailored_cv_path) {
          const tailorRes = await callFn("tailor-cv", { match_id: m.id });
          if (!tailorRes?.ok) continue;
          const { data: app } = await admin.from("applications").select("id").eq("user_id", uid).eq("job_id", m.job_id).single();
          appId = app?.id;
        }

        if (tg.chat_id && appId) {
          const sendRes = await callFn("telegram-send", { chat_id: tg.chat_id, application_id: appId });
          if (sendRes?.ok) {
            totalNotified++;
            await admin.from("job_matches").update({ status: "notified" }).eq("id", m.id);
          }
        }
      }
    }

    await admin.from("automation_state").update({ last_run: new Date().toISOString() }).eq("id", 1);

    return new Response(JSON.stringify({ ok: true, users: userIds.length, notified: totalNotified }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("run-automation", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
