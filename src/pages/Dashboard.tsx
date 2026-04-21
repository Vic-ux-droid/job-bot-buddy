import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, FileText, Send, Settings, Sparkles, TrendingUp, MessageCircle, CheckCircle2, XCircle, PauseCircle, Clock } from "lucide-react";
import { toast } from "sonner";

type TgStatus = {
  connected: boolean;
  paused: boolean;
  sent: number;
  failed: number;
  pending: number;
  lastSentAt: string | null;
};

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ matches: 0, applications: 0, topScore: 0, hasCv: false, hasTelegram: false });
  const [tg, setTg] = useState<TgStatus>({ connected: false, paused: false, sent: 0, failed: 0, pending: 0, lastSentAt: null });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [matches, apps, cv, tgSettings, sent, failed, pending, lastSent] = await Promise.all([
        supabase.from("job_matches").select("score", { count: "exact" }).eq("user_id", user.id).order("score", { ascending: false }).limit(1),
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("parsed_profile").select("id").eq("user_id", user.id).maybeSingle(),
        supabase.from("telegram_settings").select("chat_id, paused").eq("user_id", user.id).maybeSingle(),
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("notified_at", "is", null),
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "failed"),
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "queued"),
        supabase.from("applications").select("notified_at").eq("user_id", user.id).not("notified_at", "is", null).order("notified_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setStats({
        matches: matches.count ?? 0,
        applications: apps.count ?? 0,
        topScore: matches.data?.[0]?.score ?? 0,
        hasCv: !!cv.data,
        hasTelegram: !!tgSettings.data?.chat_id,
      });
      setTg({
        connected: !!tgSettings.data?.chat_id,
        paused: !!tgSettings.data?.paused,
        sent: sent.count ?? 0,
        failed: failed.count ?? 0,
        pending: pending.count ?? 0,
        lastSentAt: lastSent.data?.notified_at ?? null,
      });
    })();
  }, [user]);

  const formatRelative = (iso: string | null) => {
    if (!iso) return "Never";
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  const runNow = async () => {
    setLoading(true);
    toast.info("Running pipeline: fetching jobs, scoring, tailoring…");
    const { data, error } = await supabase.functions.invoke("run-automation", { body: { user_id: user?.id } });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(`Done. ${data?.notified ?? 0} new matches notified.`);
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Welcome back</h1>
          <p className="text-muted-foreground">Your AI job pipeline at a glance.</p>
        </div>

        {(!stats.hasCv || !stats.hasTelegram) && (
          <Card className="border-warning/50 bg-warning/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-warning" /> Finish setup
              </CardTitle>
              <CardDescription>Complete these to start receiving matches.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {!stats.hasCv && <Button asChild variant="outline"><Link to="/cv">Upload your CV</Link></Button>}
              {!stats.hasTelegram && <Button asChild variant="outline"><Link to="/settings">Connect Telegram</Link></Button>}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard icon={Briefcase} label="Job matches" value={stats.matches} />
          <StatCard icon={Send} label="Applications" value={stats.applications} />
          <StatCard icon={TrendingUp} label="Top match score" value={`${stats.topScore}%`} />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-primary/10 grid place-items-center">
                  <MessageCircle className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Telegram notifications</CardTitle>
                  <CardDescription className="text-xs">Delivery status of your match alerts</CardDescription>
                </div>
              </div>
              {!tg.connected ? (
                <Badge variant="outline" className="border-warning/50 text-warning">Not connected</Badge>
              ) : tg.paused ? (
                <Badge variant="outline" className="gap-1"><PauseCircle className="h-3 w-3" /> Paused</Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-success/50 text-success"><CheckCircle2 className="h-3 w-3" /> Active</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <TgStat icon={Clock} label="Last sent" value={formatRelative(tg.lastSentAt)} />
              <TgStat icon={Send} label="Sent" value={tg.sent} />
              <TgStat icon={XCircle} label="Failed" value={tg.failed} tone={tg.failed > 0 ? "danger" : "default"} />
              <TgStat icon={Clock} label="Pending" value={tg.pending} />
            </div>
            {!tg.connected && (
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link to="/settings">Connect Telegram</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>Run the pipeline now</CardTitle>
            <CardDescription>
              Fetch fresh IT jobs from Remotive, Arbeitnow, RemoteOK, and Adzuna; score them against your profile;
              tailor your CV for each match; notify you on Telegram.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={runNow} disabled={loading || !stats.hasCv} className="bg-gradient-primary shadow-glow">
              {loading ? "Running…" : "Run now"}
            </Button>
            {!stats.hasCv && (
              <Badge variant="outline" className="ml-3">Upload a CV first</Badge>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <QuickLink to="/cv" icon={FileText} title="My CV" desc="Manage uploads" />
          <QuickLink to="/matches" icon={Briefcase} title="Matches" desc="Review scored jobs" />
          <QuickLink to="/settings" icon={Settings} title="Settings" desc="Telegram & threshold" />
        </div>
      </div>
    </AppShell>
  );
};

const StatCard = ({ icon: Icon, label, value }: any) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const QuickLink = ({ to, icon: Icon, title, desc }: any) => (
  <Link to={to}>
    <Card className="hover:shadow-elegant transition-shadow cursor-pointer h-full">
      <CardContent className="pt-6 flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </CardContent>
    </Card>
  </Link>
);

export default Dashboard;
