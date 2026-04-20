import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileDown, Loader2, MapPin, Sparkles, Building2 } from "lucide-react";
import { toast } from "sonner";

interface Match {
  id: string;
  score: number;
  reasoning: string | null;
  status: string;
  job: {
    id: string; title: string; company: string | null; location: string | null; remote: boolean;
    source: string; url: string; description: string | null;
  };
  application?: { tailored_cv_path: string | null; cover_letter: string | null; status: string } | null;
}

const Matches = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [tailoring, setTailoring] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("job_matches")
      .select("id, score, reasoning, status, job:jobs(id, title, company, location, remote, source, url, description), application:applications(tailored_cv_path, cover_letter, status)")
      .eq("user_id", user.id)
      .order("score", { ascending: false })
      .limit(50);
    setMatches((data as any) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const tailor = async (m: Match) => {
    setTailoring(m.id);
    try {
      const { error } = await supabase.functions.invoke("tailor-cv", { body: { match_id: m.id } });
      if (error) throw error;
      toast.success("Tailored CV ready");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Tailoring failed");
    } finally {
      setTailoring(null);
    }
  };

  const downloadPdf = async (path: string) => {
    const { data, error } = await supabase.storage.from("tailored-cvs").createSignedUrl(path, 60);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank");
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Job Matches</h1>
          <p className="text-muted-foreground">Sorted by AI match score. Tailor your CV with one click.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : matches.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No matches yet. Upload a CV and click "Run now" on the dashboard.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {matches.map((m) => (
              <Card key={m.id} className="hover:shadow-elegant transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {m.job.title}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-3 flex-wrap mt-1">
                        {m.job.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{m.job.company}</span>}
                        {m.job.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{m.job.location}</span>}
                        {m.job.remote && <Badge variant="outline">Remote</Badge>}
                        <Badge variant="secondary" className="text-[10px]">{m.job.source}</Badge>
                      </CardDescription>
                    </div>
                    <ScoreBadge score={m.score} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {m.reasoning && <p className="text-sm text-muted-foreground italic">"{m.reasoning}"</p>}
                  {m.job.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{m.job.description.replace(/<[^>]+>/g, "")}</p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button asChild size="sm" variant="outline">
                      <a href={m.job.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" /> Open job
                      </a>
                    </Button>
                    {m.application?.tailored_cv_path ? (
                      <Button size="sm" variant="secondary" onClick={() => downloadPdf(m.application!.tailored_cv_path!)}>
                        <FileDown className="h-3.5 w-3.5" /> Download tailored CV
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => tailor(m)} disabled={tailoring === m.id} className="bg-gradient-primary">
                        {tailoring === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                        Tailor my CV
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
};

const ScoreBadge = ({ score }: { score: number }) => {
  const color = score >= 85 ? "bg-success text-success-foreground" : score >= 70 ? "bg-primary text-primary-foreground" : score >= 50 ? "bg-warning text-warning-foreground" : "bg-muted text-muted-foreground";
  return <div className={`px-3 py-1.5 rounded-lg font-bold text-sm ${color}`}>{score}%</div>;
};

export default Matches;
