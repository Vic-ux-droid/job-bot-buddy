import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";

const Settings = () => {
  const { user } = useAuth();
  const [chatId, setChatId] = useState("");
  const [paused, setPaused] = useState(false);
  const [threshold, setThreshold] = useState(70);
  const [dailyLimit, setDailyLimit] = useState(10);
  const [targetRoles, setTargetRoles] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: tg }, { data: prof }] = await Promise.all([
      supabase.from("telegram_settings").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("target_roles, location").eq("id", user.id).maybeSingle(),
    ]);
    if (tg) {
      setChatId(tg.chat_id ?? "");
      setPaused(tg.paused);
      setThreshold(tg.match_threshold);
      setDailyLimit(tg.daily_limit);
    }
    if (prof) {
      setTargetRoles((prof.target_roles ?? []).join(", "));
      setLocation(prof.location ?? "");
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const tgPayload = { user_id: user.id, chat_id: chatId.trim() || null, paused, match_threshold: threshold, daily_limit: dailyLimit };
    const profPayload = { target_roles: targetRoles.split(",").map((s) => s.trim()).filter(Boolean), location: location.trim() || null };
    const [a, b] = await Promise.all([
      supabase.from("telegram_settings").upsert(tgPayload),
      supabase.from("profiles").update(profPayload).eq("id", user.id),
    ]);
    setSaving(false);
    if (a.error || b.error) return toast.error(a.error?.message ?? b.error?.message ?? "Save failed");
    toast.success("Saved");
  };

  const sendTest = async () => {
    if (!chatId.trim()) return toast.error("Enter your chat ID first");
    setTesting(true);
    const { error } = await supabase.functions.invoke("telegram-send", {
      body: { chat_id: chatId.trim(), text: "✅ JobPilot AI test message — your bot is wired up correctly!" },
    });
    setTesting(false);
    if (error) return toast.error(error.message);
    toast.success("Test message sent");
  };

  if (loading) return <AppShell><div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></AppShell>;

  return (
    <AppShell>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-muted-foreground">Telegram, automation, and preferences.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" /> Telegram</CardTitle>
            <CardDescription>
              Get your chat ID by messaging <a className="text-primary underline" href="https://t.me/userinfobot" target="_blank" rel="noopener noreferrer">@userinfobot</a> on Telegram.
              Then message your bot once with /start so it can reply to you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="chat">Chat ID</Label>
              <div className="flex gap-2">
                <Input id="chat" value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="e.g. 123456789" />
                <Button variant="outline" onClick={sendTest} disabled={testing}>
                  {testing && <Loader2 className="h-4 w-4 animate-spin" />} Test
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Pause automation</Label>
                <p className="text-xs text-muted-foreground">No new matches will be sent.</p>
              </div>
              <Switch checked={paused} onCheckedChange={setPaused} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Matching</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><Label>Minimum match score</Label><span className="font-mono">{threshold}%</span></div>
              <Slider value={[threshold]} onValueChange={(v) => setThreshold(v[0])} min={40} max={95} step={5} />
              <p className="text-xs text-muted-foreground">Only matches at or above this score get tailored & notified.</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><Label>Daily match limit</Label><span className="font-mono">{dailyLimit}</span></div>
              <Slider value={[dailyLimit]} onValueChange={(v) => setDailyLimit(v[0])} min={1} max={30} step={1} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roles">Target roles (comma-separated)</Label>
              <Input id="roles" value={targetRoles} onChange={(e) => setTargetRoles(e.target.value)} placeholder="e.g. Backend Engineer, DevOps, Cloud Architect" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="loc">Preferred location</Label>
              <Input id="loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Berlin, Remote, US" />
            </div>
          </CardContent>
        </Card>

        <Button onClick={save} disabled={saving} className="bg-gradient-primary shadow-glow">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save settings
        </Button>
      </div>
    </AppShell>
  );
};

export default Settings;
