// tailor-cv: rewrite user's CV for a specific job + write cover letter, generate PDF, store
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Tailored {
  headline: string;
  summary: string;
  highlighted_skills: string[];
  experience: Array<{ title: string; company: string; dates: string; bullets: string[] }>;
  education: Array<{ degree: string; institution: string; year: string }>;
  cover_letter: string;
}

async function tailor(profile: any, job: any, apiKey: string): Promise<Tailored> {
  const payload = {
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: "You are an expert CV writer. Tailor truthfully — never invent skills, jobs, or accomplishments. Reword and emphasize what's already there for ATS optimization." },
      { role: "user", content: `Tailor this profile for the job below.

PROFILE:
Summary: ${profile.summary ?? ""}
Skills: ${(profile.skills ?? []).join(", ")}
Experience: ${JSON.stringify(profile.experience ?? [])}
Education: ${JSON.stringify(profile.education ?? [])}

JOB: ${job.title} at ${job.company ?? ""}
Description: ${(job.description ?? "").replace(/<[^>]+>/g, " ").slice(0, 3000)}

Rewrite the summary to align with the role. Pick the most relevant skills. Reframe experience bullets toward the job's requirements. Write a brief 3-paragraph cover letter.` },
    ],
    tools: [{
      type: "function",
      function: {
        name: "save_tailored",
        parameters: {
          type: "object",
          properties: {
            headline: { type: "string", description: "Professional headline aligned with role" },
            summary: { type: "string", description: "3-4 sentence tailored summary" },
            highlighted_skills: { type: "array", items: { type: "string" }, description: "Top 10-15 skills relevant to the job" },
            experience: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" }, company: { type: "string" }, dates: { type: "string" },
                  bullets: { type: "array", items: { type: "string" } },
                },
                required: ["title", "company", "dates", "bullets"],
                additionalProperties: false,
              },
            },
            education: {
              type: "array",
              items: {
                type: "object",
                properties: { degree: { type: "string" }, institution: { type: "string" }, year: { type: "string" } },
                required: ["degree", "institution", "year"],
                additionalProperties: false,
              },
            },
            cover_letter: { type: "string" },
          },
          required: ["headline", "summary", "highlighted_skills", "experience", "education", "cover_letter"],
          additionalProperties: false,
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "save_tailored" } },
  };

  const delays = [0, 2000, 5000, 12000];
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (r.status === 429) { console.log(`tailor: 429, retry ${i + 1}/${delays.length}`); continue; }
    if (r.status === 402) throw new Error("AI credits exhausted. Add funds in Settings → Workspace → Usage.");
    if (!r.ok) throw new Error(`AI error ${r.status}`);
    const j = await r.json();
    return JSON.parse(j.choices[0].message.tool_calls[0].function.arguments);
  }
  throw new Error("AI is busy (rate limited). Please wait a minute and try again.");
}

function buildPdf(t: Tailored, candidateName: string, contactEmail: string): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const PAGE_W = 612, PAGE_H = 792, MARGIN = 50;
  const MAX_W = PAGE_W - MARGIN * 2;
  let y = MARGIN;

  const ensure = (h: number) => {
    if (y + h > PAGE_H - MARGIN) { doc.addPage(); y = MARGIN; }
  };
  const heading = (text: string) => {
    ensure(28);
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(40, 30, 120);
    doc.text(text.toUpperCase(), MARGIN, y); y += 6;
    doc.setDrawColor(180); doc.line(MARGIN, y, PAGE_W - MARGIN, y); y += 14;
    doc.setTextColor(20);
  };
  const body = (text: string, opts: { size?: number; bold?: boolean; gap?: number } = {}) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal"); doc.setFontSize(opts.size ?? 10);
    const lines = doc.splitTextToSize(text, MAX_W) as string[];
    for (const line of lines) {
      ensure(14);
      doc.text(line, MARGIN, y); y += (opts.size ?? 10) + 3;
    }
    y += opts.gap ?? 4;
  };

  // Header
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); doc.setTextColor(40, 30, 120);
  doc.text(candidateName, MARGIN, y); y += 24;
  doc.setFont("helvetica", "normal"); doc.setFontSize(11); doc.setTextColor(80);
  doc.text(t.headline, MARGIN, y); y += 14;
  if (contactEmail) { doc.setFontSize(9); doc.text(contactEmail, MARGIN, y); y += 14; }
  doc.setTextColor(20); y += 6;

  heading("Summary");
  body(t.summary);

  heading("Key Skills");
  body(t.highlighted_skills.join("  •  "));

  heading("Experience");
  for (const e of t.experience) {
    ensure(40);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text(`${e.title} — ${e.company}`, MARGIN, y); y += 13;
    doc.setFont("helvetica", "italic"); doc.setFontSize(9); doc.setTextColor(110);
    doc.text(e.dates, MARGIN, y); y += 12; doc.setTextColor(20);
    for (const b of e.bullets) {
      const lines = doc.splitTextToSize(`•  ${b}`, MAX_W - 10) as string[];
      doc.setFont("helvetica", "normal"); doc.setFontSize(10);
      for (const line of lines) { ensure(13); doc.text(line, MARGIN + 6, y); y += 12; }
    }
    y += 6;
  }

  heading("Education");
  for (const e of t.education) {
    body(`${e.degree} — ${e.institution} (${e.year})`, { gap: 2 });
  }

  return new Uint8Array(doc.output("arraybuffer"));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    const admin = createClient(SUPABASE_URL, SERVICE);

    const body = await req.json();
    const { match_id, user_id: bodyUserId } = body;

    let userId = bodyUserId;
    let match;
    if (match_id) {
      const { data } = await admin.from("job_matches").select("*, job:jobs(*)").eq("id", match_id).single();
      if (!data) throw new Error("Match not found");
      match = data;
      userId = data.user_id;
    } else {
      throw new Error("match_id required");
    }

    const { data: profile } = await admin.from("parsed_profile").select("*").eq("user_id", userId).single();
    const { data: prof } = await admin.from("profiles").select("full_name, email").eq("id", userId).single();
    if (!profile) throw new Error("No parsed profile");

    const tailored = await tailor(profile, match.job, LOVABLE_API_KEY);
    const pdfBytes = buildPdf(tailored, prof?.full_name ?? prof?.email ?? "Candidate", prof?.email ?? "");

    const path = `${userId}/${match.job.id}-${Date.now()}.pdf`;
    const { error: upErr } = await admin.storage.from("tailored-cvs").upload(path, pdfBytes, {
      contentType: "application/pdf", upsert: true,
    });
    if (upErr) throw upErr;

    await admin.from("applications").upsert({
      user_id: userId, job_id: match.job.id, match_id: match.id,
      status: "applied", tailored_cv_path: path, cover_letter: tailored.cover_letter,
      notified_at: new Date().toISOString(),
    }, { onConflict: "user_id,job_id" });

    await admin.from("job_matches").update({ status: "applied" }).eq("id", match.id);

    return new Response(JSON.stringify({ ok: true, path, cover_letter: tailored.cover_letter, job_url: match.job.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("tailor-cv", e);
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unknown" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
