// fetch-jobs: pull IT jobs from Remotive, Arbeitnow, RemoteOK, Adzuna; upsert into jobs table
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IT_KEYWORDS = /\b(developer|engineer|software|devops|backend|frontend|full[- ]?stack|cloud|data|ml|ai|machine learning|sre|security|qa|test|architect|programmer|sysadmin|kubernetes|aws|gcp|azure|python|javascript|typescript|java|golang|rust|react|node|infra|platform|database|sql|technical)\b/i;

function isITJob(title: string, tags: string[] = []): boolean {
  if (IT_KEYWORDS.test(title)) return true;
  return tags.some((t) => IT_KEYWORDS.test(t));
}

async function fetchRemotive(): Promise<any[]> {
  const r = await fetch("https://remotive.com/api/remote-jobs?category=software-dev&limit=50");
  if (!r.ok) return [];
  const j = await r.json();
  return (j.jobs ?? []).map((it: any) => ({
    source: "remotive",
    external_id: String(it.id),
    title: it.title,
    company: it.company_name,
    description: (it.description ?? "").slice(0, 5000),
    url: it.url,
    location: it.candidate_required_location,
    remote: true,
    tags: it.tags ?? [],
    posted_at: it.publication_date,
  }));
}

async function fetchArbeitnow(): Promise<any[]> {
  const r = await fetch("https://www.arbeitnow.com/api/job-board-api");
  if (!r.ok) return [];
  const j = await r.json();
  return (j.data ?? [])
    .filter((it: any) => isITJob(it.title, it.tags))
    .slice(0, 50)
    .map((it: any) => ({
      source: "arbeitnow",
      external_id: it.slug,
      title: it.title,
      company: it.company_name,
      description: (it.description ?? "").slice(0, 5000),
      url: it.url,
      location: it.location,
      remote: !!it.remote,
      tags: it.tags ?? [],
      posted_at: it.created_at ? new Date(it.created_at * 1000).toISOString() : null,
    }));
}

async function fetchRemoteOK(): Promise<any[]> {
  const r = await fetch("https://remoteok.com/api", { headers: { "User-Agent": "JobPilotAI/1.0" } });
  if (!r.ok) return [];
  const arr = await r.json();
  return arr
    .filter((it: any) => it.id && it.position)
    .slice(0, 50)
    .map((it: any) => ({
      source: "remoteok",
      external_id: String(it.id),
      title: it.position,
      company: it.company,
      description: (it.description ?? "").slice(0, 5000),
      url: it.url ?? `https://remoteok.com/remote-jobs/${it.id}`,
      location: it.location ?? "Remote",
      remote: true,
      tags: it.tags ?? [],
      posted_at: it.date,
    }));
}

async function fetchAdzuna(): Promise<any[]> {
  const APP_ID = Deno.env.get("ADZUNA_APP_ID");
  const APP_KEY = Deno.env.get("ADZUNA_APP_KEY");
  if (!APP_ID || !APP_KEY) return [];
  const url = `https://api.adzuna.com/v1/api/jobs/gb/search/1?app_id=${APP_ID}&app_key=${APP_KEY}&results_per_page=50&category=it-jobs&content-type=application/json`;
  const r = await fetch(url);
  if (!r.ok) {
    console.error("adzuna error", r.status, await r.text());
    return [];
  }
  const j = await r.json();
  return (j.results ?? []).map((it: any) => ({
    source: "adzuna",
    external_id: String(it.id),
    title: it.title,
    company: it.company?.display_name,
    description: (it.description ?? "").slice(0, 5000),
    url: it.redirect_url,
    location: it.location?.display_name,
    remote: /remote/i.test(it.title) || /remote/i.test(it.location?.display_name ?? ""),
    tags: [it.category?.label].filter(Boolean),
    posted_at: it.created,
  }));
}

async function fetchMyJobMag(): Promise<any[]> {
  const r = await fetch("https://www.myjobmag.com/jobsxml.xml", { headers: { "User-Agent": "JobPilotAI/1.0" } });
  if (!r.ok) { console.error("myjobmag error", r.status); return []; }
  const xml = await r.text();
  const items = xml.split(/<job>/i).slice(1).map((chunk) => chunk.split(/<\/job>/i)[0]);
  const get = (block: string, tag: string) => {
    const m = block.match(new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${tag}>`, "i"));
    return m ? m[1].trim() : "";
  };
  return items.slice(0, 80).map((it) => {
    const url = get(it, "url") || get(it, "link");
    const idMatch = url.match(/\/(\d+)(?:[?/#]|$)/);
    const title = get(it, "title");
    const company = get(it, "company");
    const location = get(it, "location") || get(it, "city") || "Nigeria";
    const category = get(it, "category");
    const desc = get(it, "description") || get(it, "summary");
    const date = get(it, "date") || get(it, "pubdate") || get(it, "posted");
    return {
      source: "myjobmag",
      external_id: idMatch?.[1] || url || `${title}-${company}`,
      title,
      company,
      description: desc.slice(0, 5000),
      url,
      location,
      remote: /remote/i.test(title) || /remote/i.test(location),
      tags: category ? [category] : [],
      posted_at: date ? new Date(date).toISOString() : null,
    };
  }).filter((j) => j.title && j.url);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE);

    const results = await Promise.allSettled([fetchRemotive(), fetchArbeitnow(), fetchRemoteOK(), fetchAdzuna(), fetchMyJobMag()]);
    const allJobs = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    const itJobs = allJobs.filter((j) => isITJob(j.title, j.tags ?? []));

    if (itJobs.length === 0) {
      return new Response(JSON.stringify({ ok: true, inserted: 0, total: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Chunked upsert
    let inserted = 0;
    for (let i = 0; i < itJobs.length; i += 100) {
      const chunk = itJobs.slice(i, i + 100);
      const { error, count } = await admin.from("jobs").upsert(chunk, { onConflict: "source,external_id", count: "exact" });
      if (error) console.error("upsert err", error);
      else inserted += count ?? chunk.length;
    }

    await admin.from("automation_state").update({ last_job_fetch: new Date().toISOString() }).eq("id", 1);

    return new Response(JSON.stringify({
      ok: true, inserted,
      sources: { remotive: results[0].status, arbeitnow: results[1].status, remoteok: results[2].status, adzuna: results[3].status, myjobmag: results[4].status },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("fetch-jobs", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
