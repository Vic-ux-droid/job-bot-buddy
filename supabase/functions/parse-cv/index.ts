// parse-cv: download CV from storage, extract text, run AI to extract structured profile
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getDocument, GlobalWorkerOptions } from "https://esm.sh/pdfjs-dist@4.0.379/legacy/build/pdf.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

GlobalWorkerOptions.workerSrc = "https://esm.sh/pdfjs-dist@4.0.379/legacy/build/pdf.worker.mjs";

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const doc = await getDocument({ data: bytes, useSystemFonts: true, disableFontFace: true }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => it.str).join(" ") + "\n";
  }
  return text;
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  // DOCX is a ZIP containing word/document.xml. Minimal extraction without deps.
  // Use mammoth via esm.sh.
  const mammoth = await import("https://esm.sh/mammoth@1.8.0/mammoth.browser.min.js");
  const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer });
  return result.value as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { cv_document_id } = await req.json();
    if (!cv_document_id) throw new Error("cv_document_id required");

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: doc, error: docErr } = await admin.from("cv_documents").select("*").eq("id", cv_document_id).eq("user_id", user.id).single();
    if (docErr || !doc) throw new Error("CV not found");

    const { data: file, error: dlErr } = await admin.storage.from("cvs").download(doc.file_path);
    if (dlErr) throw dlErr;
    const bytes = new Uint8Array(await file.arrayBuffer());

    let rawText = "";
    if (doc.mime_type === "application/pdf" || doc.file_name.endsWith(".pdf")) {
      rawText = await extractPdfText(bytes);
    } else if (doc.mime_type?.includes("wordprocessingml") || doc.file_name.endsWith(".docx")) {
      rawText = await extractDocxText(bytes);
    } else {
      rawText = new TextDecoder().decode(bytes);
    }
    rawText = rawText.replace(/\s+/g, " ").trim().slice(0, 30000);
    if (!rawText) throw new Error("Could not extract text");

    // AI structured extraction
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You extract structured CV data. Be accurate, never invent. Return concise summaries." },
          { role: "user", content: `Extract structured profile from this CV:\n\n${rawText}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "save_profile",
            description: "Save extracted CV profile",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string", description: "2-3 sentence professional summary" },
                years_experience: { type: "number", description: "Total years of professional IT experience" },
                skills: { type: "array", items: { type: "string" }, description: "Technical skills, tools, languages" },
                experience: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" }, company: { type: "string" }, dates: { type: "string" }, description: { type: "string" },
                    },
                    required: ["title"], additionalProperties: false,
                  },
                },
                education: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      degree: { type: "string" }, institution: { type: "string" }, year: { type: "string" },
                    },
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
    const args = JSON.parse(aiJson.choices[0].message.tool_calls[0].function.arguments);

    await admin.from("parsed_profile").upsert({
      user_id: user.id,
      cv_document_id: doc.id,
      summary: args.summary,
      skills: args.skills,
      experience: args.experience,
      education: args.education,
      certifications: args.certifications ?? [],
      years_experience: args.years_experience ?? null,
      raw_text: rawText,
    }, { onConflict: "user_id" });

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
