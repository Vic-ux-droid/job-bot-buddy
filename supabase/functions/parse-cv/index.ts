// parse-cv: download CV from storage, send to Lovable AI for extraction
// PDFs/DOCX are base64'd and sent as image-like content; for text fallback we decode directly.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    bin += String.fromCharCode(...sub);
  }
  return btoa(bin);
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  // Minimal DOCX text extraction: unzip via JSZip and pull text from word/document.xml
  const JSZip = (await import("https://esm.sh/jszip@3.10.1")).default;
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return "";
  // Strip tags, keep text
  return xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ok = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return ok({ ok: false, error: "Missing Authorization header" });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    console.log("parse-cv: env check", { hasUrl: !!SUPABASE_URL, hasService: !!SERVICE, hasLovable: !!LOVABLE_API_KEY, hasAnon: !!ANON });
    if (!LOVABLE_API_KEY) return ok({ ok: false, error: "LOVABLE_API_KEY missing in edge function env" });
    if (!ANON) return ok({ ok: false, error: "SUPABASE_ANON_KEY missing in edge function env" });

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr) console.error("parse-cv: getUser err", userErr);
    if (!user) return ok({ ok: false, error: "Could not resolve user from token" });
    console.log("parse-cv: user", user.id);

    const { cv_document_id } = await req.json();
    if (!cv_document_id) throw new Error("cv_document_id required");

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: doc, error: docErr } = await admin.from("cv_documents").select("*").eq("id", cv_document_id).eq("user_id", user.id).single();
    if (docErr || !doc) throw new Error("CV not found");

    console.log("parse-cv: downloading", doc.file_path, "user", user.id);
    const { data: file, error: dlErr } = await admin.storage.from("cvs").download(doc.file_path);
    if (dlErr) throw dlErr;
    const bytes = new Uint8Array(await file.arrayBuffer());
    console.log("parse-cv: downloaded", bytes.length, "bytes, mime", doc.mime_type);

    let userContent: any;
    const isPdf = doc.mime_type === "application/pdf" || doc.file_name.toLowerCase().endsWith(".pdf");
    const isDocx = doc.mime_type?.includes("wordprocessingml") || doc.file_name.toLowerCase().endsWith(".docx");

    if (isPdf) {
      // Send PDF via image_url with PDF data URL — Gemini supports PDF input
      const dataUrl = `data:application/pdf;base64,${bytesToBase64(bytes)}`;
      userContent = [
        { type: "text", text: "Extract structured profile data from this CV." },
        { type: "image_url", image_url: { url: dataUrl } },
      ];
    } else {
      let rawText = "";
      if (isDocx) rawText = await extractDocxText(bytes);
      else rawText = new TextDecoder().decode(bytes);
      rawText = rawText.replace(/\s+/g, " ").trim().slice(0, 30000);
      if (!rawText) throw new Error("Could not extract text from CV");
      userContent = `Extract structured profile from this CV:\n\n${rawText}`;
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You extract structured CV data. Be accurate, never invent." },
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_profile",
            description: "Save extracted CV profile",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string" },
                years_experience: { type: "number" },
                skills: { type: "array", items: { type: "string" } },
                experience: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { title: { type: "string" }, company: { type: "string" }, dates: { type: "string" }, description: { type: "string" } },
                    required: ["title"], additionalProperties: false,
                  },
                },
                education: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { degree: { type: "string" }, institution: { type: "string" }, year: { type: "string" } },
                    required: ["degree"], additionalProperties: false,
                  },
                },
                certifications: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { name: { type: "string" }, issuer: { type: "string" }, year: { type: "string" } },
                    required: ["name"], additionalProperties: false,
                  },
                },
              },
              required: ["summary", "skills", "experience", "education"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "save_profile" } },
      }),
    });

    if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again later" }), { status: 429, headers: corsHeaders });
    if (aiResp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings → Workspace → Usage." }), { status: 402, headers: corsHeaders });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      throw new Error(`AI error ${aiResp.status}: ${t}`);
    }

    const aiJson = await aiResp.json();
    console.log("parse-cv: AI responded");
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("parse-cv: no tool call in response", JSON.stringify(aiJson).slice(0, 500));
      throw new Error("AI did not return structured profile");
    }
    const args = JSON.parse(toolCall.function.arguments);

    const { error: upsertErr } = await admin.from("parsed_profile").upsert({
      user_id: user.id,
      cv_document_id: doc.id,
      summary: args.summary,
      skills: args.skills,
      experience: args.experience,
      education: args.education,
      certifications: args.certifications ?? [],
      years_experience: args.years_experience ?? null,
    }, { onConflict: "user_id" });
    if (upsertErr) {
      console.error("parse-cv: upsert failed", upsertErr);
      throw upsertErr;
    }
    console.log("parse-cv: profile saved for", user.id);

    return new Response(JSON.stringify({ ok: true, profile: args }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-cv error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
