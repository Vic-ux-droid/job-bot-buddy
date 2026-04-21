// fetch-jobs: pull Kenya-based IT jobs from MyJobMag KE, BrighterMonday KE, Adzuna KE
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const IT_KEYWORDS = /\b(developer|engineer|software|devops|backend|frontend|full[- ]?stack|cloud|data|ml|ai|machine learning|sre|security|qa|test|architect|programmer|sysadmin|kubernetes|aws|gcp|azure|python|javascript|typescript|java|golang|rust|react|node|infra|platform|database|sql|technical|it |ict|systems|network|web)\b/i;

function isITJob(title: string, tags: string[] = []): boolean {
  if (IT_KEYWORDS.test(title)) return true;
  return tags.some((t) => IT_KEYWORDS.test(t));
}

function isKenyan(location: string, title = ""): boolean {
  const blob = `${location} ${title}`.toLowerCase();
  return /kenya|nairobi|mombasa|kisumu|nakuru|eldoret|thika|\bke\b/.test(blob);
}

function getTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>\\s*(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?\\s*</${tag}>`, "i"));
  return m ? m[1].replace(/<[^>]+>/g, " ").trim() : "";
}

// MyJobMag Kenya feed
async function fetchMyJobMagKE(): Promise<any[]> {
  const r = await fetch("https://www.myjobmag.co.ke/jobsxml.xml", { headers: { "User-Agent": "JobPilotAI/1.0" } });
  if (!r.ok) { console.error("myjobmag KE error", r.status); return []; }
  const xml = await r.text();
  const items = xml.split(/<job>/i).slice(1).map((chunk) => chunk.split(/<\/job>/i)[0]);
  return items.slice(0, 100).map((it) => {
    const url = getTag(it, "url") || getTag(it, "link");
    const idMatch = url.match(/\/(\d+)(?:[?/#]|$)/);
    const title = getTag(it, "title");
    const company = getTag(it, "company");
    const location = getTag(it, "location") || getTag(it, "city") || "Kenya";
    const category = getTag(it, "category");
    const desc = getTag(it, "description") || getTag(it, "summary");
    const date = getTag(it, "date") || getTag(it, "pubdate") || getTag(it, "posted");
    return {
      source: "myjobmag-ke",
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

// BrighterMonday Kenya RSS feed
async function fetchBrighterMondayKE(): Promise<any[]> {
  const r = await fetch("https://www.brightermonday.co.ke/jobs/rss", { headers: { "User-Agent": "JobPilotAI/1.0" } });
  if (!r.ok) { console.error("brightermonday error", r.status); return []; }
  const xml = await r.text();
  const items = xml.split(/<item>/i).slice(1).map((chunk) => chunk.split(/<\/item>/i)[0]);
  return items.slice(0, 100).map((it) => {
    const url = getTag(it, "link") || getTag(it, "guid");
    const title = getTag(it, "title");
    const desc = getTag(it, "description");
    const date = getTag(it, "pubDate");
    const company = getTag(it, "dc:creator") || getTag(it, "author") || "";
    // Title often "Job Title at Company - Location"
    let parsedCompany = company, parsedLoc = "Kenya";
    const atMatch = title.match(/^(.*?)\s+at\s+(.+?)(?:\s*-\s*(.+))?$/i);
    let cleanTitle = title;
    if (atMatch) {
      cleanTitle = atMatch[1].trim();
      parsedCompany = parsedCompany || atMatch[2].trim();
      if (atMatch[3]) parsedLoc = atMatch[3].trim();
    }
    return {
      source: "brightermonday-ke",
      external_id: url || `${title}`,
      title: cleanTitle,
      company: parsedCompany,
      description: desc.slice(0, 5000),
      url,
      location: parsedLoc,
      remote: /remote/i.test(title),
      tags: [],
      posted_at: date ? new Date(date).toISOString() : null,
    };
  }).filter((j) => j.title && j.url);
}

// Adzuna Kenya
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE);

    const results = await Promise.allSettled([fetchMyJobMagKE(), fetchBrighterMondayKE()]);
    const allJobs = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

    // Filter: must be IT-related AND Kenya-based
    const filtered = allJobs.filter((j) => isITJob(j.title, j.tags ?? []) && isKenyan(j.location ?? "", j.title));

    console.log(`fetch-jobs: ${allJobs.length} total, ${filtered.length} after KE+IT filter`);

    if (filtered.length === 0) {
      await admin.from("automation_state").update({ last_job_fetch: new Date().toISOString() }).eq("id", 1);
      return new Response(JSON.stringify({
        ok: true, inserted: 0, total: allJobs.length,
        sources: { myjobmag_ke: results[0].status, brightermonday_ke: results[1].status },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let inserted = 0;
    for (let i = 0; i < filtered.length; i += 100) {
      const chunk = filtered.slice(i, i + 100);
      const { error, count } = await admin.from("jobs").upsert(chunk, { onConflict: "source,external_id", count: "exact" });
      if (error) console.error("upsert err", error);
      else inserted += count ?? chunk.length;
    }

    await admin.from("automation_state").update({ last_job_fetch: new Date().toISOString() }).eq("id", 1);

    return new Response(JSON.stringify({
      ok: true, inserted, total: allJobs.length,
      sources: { myjobmag_ke: results[0].status, brightermonday_ke: results[1].status },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("fetch-jobs", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
