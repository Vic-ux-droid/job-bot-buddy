// telegram-send: send message (text or document) via Telegram connector gateway
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/telegram";

async function tgFetch(method: string, body: any) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY")!;
  const r = await fetch(`${GATEWAY}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`Telegram ${method} failed [${r.status}]: ${JSON.stringify(json)}`);
  return json;
}

async function sendDocumentMultipart(chatId: string, fileBytes: Uint8Array, filename: string, caption: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY")!;
  const fd = new FormData();
  fd.append("chat_id", chatId);
  fd.append("caption", caption);
  fd.append("parse_mode", "HTML");
  fd.append("document", new Blob([fileBytes], { type: "application/pdf" }), filename);
  const r = await fetch(`${GATEWAY}/sendDocument`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
    },
    body: fd,
  });
  const json = await r.json();
  if (!r.ok) throw new Error(`Telegram sendDocument failed [${r.status}]: ${JSON.stringify(json)}`);
  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    if (!Deno.env.get("LOVABLE_API_KEY")) throw new Error("LOVABLE_API_KEY missing");
    if (!Deno.env.get("TELEGRAM_API_KEY")) throw new Error("TELEGRAM_API_KEY missing — connect Telegram in Cloud");

    const body = await req.json();
    const { chat_id, text, application_id } = body;
    if (!chat_id) throw new Error("chat_id required");

    if (application_id) {
      // Send rich match notification with PDF
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(SUPABASE_URL, SERVICE);

      const { data: app } = await admin.from("applications")
        .select("*, job:jobs(*), match:job_matches(score, reasoning)")
        .eq("id", application_id).single();
      if (!app) throw new Error("Application not found");

      const caption = `<b>${escapeHtml(app.job.title)}</b>\n` +
        (app.job.company ? `🏢 ${escapeHtml(app.job.company)}\n` : "") +
        (app.job.location ? `📍 ${escapeHtml(app.job.location)}${app.job.remote ? " (Remote)" : ""}\n` : "") +
        `🎯 Match: <b>${app.match?.score ?? "?"}%</b>\n` +
        (app.match?.reasoning ? `\n<i>${escapeHtml(app.match.reasoning)}</i>\n` : "") +
        `\n📎 Tailored CV attached\n` +
        `🔗 <a href="${app.job.url}">Apply now</a>`;

      let pdfBytes: Uint8Array | null = null;
      if (app.tailored_cv_path) {
        const { data: file } = await admin.storage.from("tailored-cvs").download(app.tailored_cv_path);
        if (file) pdfBytes = new Uint8Array(await file.arrayBuffer());
      }

      if (pdfBytes) {
        await sendDocumentMultipart(chat_id, pdfBytes, `${app.job.title.replace(/[^a-z0-9]/gi, "_")}_CV.pdf`, caption);
      } else {
        await tgFetch("sendMessage", { chat_id, text: caption, parse_mode: "HTML", disable_web_page_preview: true });
      }

      if (app.cover_letter) {
        await tgFetch("sendMessage", {
          chat_id,
          text: `<b>Cover letter:</b>\n\n${escapeHtml(app.cover_letter)}`,
          parse_mode: "HTML",
        });
      }

      await admin.from("applications").update({ status: "sent", notified_at: new Date().toISOString() }).eq("id", application_id);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Plain text
    if (!text) throw new Error("text or application_id required");
    await tgFetch("sendMessage", { chat_id, text, parse_mode: "HTML", disable_web_page_preview: true });
    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("telegram-send", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
