import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, FileText, Send, Settings, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ matches: 0, applications: 0, topScore: 0, hasCv: false, hasTelegram: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [matches, apps, cv, tg] = await Promise.all([
        supabase.from("job_matches").select("score", { count: "exact" }).eq("user_id", user.id).order("score", { ascending: false }).limit(1),
        supabase.from("applications").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("parsed_profile").select("id").eq("user_id", user.id).maybeSingle(),
        supabase.from("telegram_settings").select("chat_id").eq("user_id", user.id).maybeSingle(),
      ]);
      setStats({
        matches: matches.count ?? 0,
        applications: apps.count ?? 0,
        topScore: matches.data?.[0]?.score ?? 0,
        hasCv: !!cv.data,
        hasTelegram: !!tg.data?.chat_id,
      });
    })();
  }, [user]);

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
