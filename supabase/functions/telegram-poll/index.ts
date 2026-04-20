// telegram-poll: long-poll Telegram for /commands, react to /start /status /pause /resume
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const GATEWAY = "https://connector-gateway.lovable.dev/telegram";
const MAX_RUNTIME_MS = 55_000;
const MIN_REMAINING_MS = 5_000;

async function tg(method: string, body: any) {
  const r = await fetch(`${GATEWAY}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      "X-Connection-Api-Key": Deno.env.get("TELEGRAM_API_KEY")!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return await r.json();
}

async function reply(chatId: number, text: string) {
  await tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true });
}

Deno.serve(async () => {
  const start = Date.now();
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!Deno.env.get("LOVABLE_API_KEY") || !Deno.env.get("TELEGRAM_API_KEY")) {
    return new Response(JSON.stringify({ error: "Missing keys" }), { status: 500 });
  }
  const admin = createClient(SUPABASE_URL, SERVICE);

  const { data: state } = await admin.from("automation_state").select("telegram_offset").eq("id", 1).single();
  let offset = state?.telegram_offset ?? 0;
  let processed = 0;

  while (true) {
    const remaining = MAX_RUNTIME_MS - (Date.now() - start);
    if (remaining < MIN_REMAINING_MS) break;
    const timeout = Math.min(50, Math.floor(remaining / 1000) - 5);
    if (timeout < 1) break;

    const r = await fetch(`${GATEWAY}/getUpdates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
        "X-Connection-Api-Key": Deno.env.get("TELEGRAM_API_KEY")!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ offset, timeout, allowed_updates: ["message"] }),
    });
    if (!r.ok) {
      console.error("getUpdates", r.status, await r.text());
      break;
    }
    const data = await r.json();
    const updates = data.result ?? [];
    if (updates.length === 0) continue;

    for (const u of updates) {
      const msg = u.message;
      if (!msg?.text) continue;
      const chatId = msg.chat.id;
      const text = msg.text.trim();

      // Find user by chat_id
      const { data: settings } = await admin.from("telegram_settings").select("user_id, paused").eq("chat_id", String(chatId)).maybeSingle();

      if (text.startsWith("/start")) {
        if (settings) {
          await reply(chatId, "✅ Already linked! Use /status to see your stats.");
        } else {
          await reply(chatId, `👋 Welcome to JobPilot AI!\n\nYour chat ID is: <code>${chatId}</code>\n\nPaste it into Settings → Telegram in the app to start receiving job matches.`);
        }
      } else if (text.startsWith("/status")) {
        if (!settings) { await reply(chatId, "Not linked. Add this chat ID in the app's Settings page."); continue; }
        const [{ count: matches }, { count: apps }] = await Promise.all([
          admin.from("job_matches").select("id", { count: "exact", head: true }).eq("user_id", settings.user_id),
          admin.from("applications").select("id", { count: "exact", head: true }).eq("user_id", settings.user_id),
        ]);
        await reply(chatId, `📊 <b>Status</b>\nMatches: ${matches ?? 0}\nApplications: ${apps ?? 0}\nAutomation: ${settings.paused ? "⏸ Paused" : "▶️ Active"}`);
      } else if (text.startsWith("/pause")) {
        if (!settings) { await reply(chatId, "Not linked."); continue; }
        await admin.from("telegram_settings").update({ paused: true }).eq("user_id", settings.user_id);
        await reply(chatId, "⏸ Automation paused. Use /resume to restart.");
      } else if (text.startsWith("/resume")) {
        if (!settings) { await reply(chatId, "Not linked."); continue; }
        await admin.from("telegram_settings").update({ paused: false }).eq("user_id", settings.user_id);
        await reply(chatId, "▶️ Automation resumed.");
      } else if (text.startsWith("/help")) {
        await reply(chatId, "<b>JobPilot AI bot</b>\n/start — link your account\n/status — see stats\n/pause — stop notifications\n/resume — restart\n/help — this menu");
      }
      processed++;
    }

    offset = Math.max(...updates.map((u: any) => u.update_id)) + 1;
    await admin.from("automation_state").update({ telegram_offset: offset, updated_at: new Date().toISOString() }).eq("id", 1);
  }

  return new Response(JSON.stringify({ ok: true, processed, offset }), { headers: { "Content-Type": "application/json" } });
});
