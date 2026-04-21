import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, FileCheck2, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface Cv { id: string; file_name: string; created_at: string; is_active: boolean; file_path: string }
interface Parsed { summary: string | null; skills: string[] | null; years_experience: number | null; experience: any; education: any }

const CV = () => {
  const { user } = useAuth();
  const [cvs, setCvs] = useState<Cv[]>([]);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: cvData }, { data: pData }] = await Promise.all([
      supabase.from("cv_documents").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("parsed_profile").select("summary, skills, years_experience, experience, education").eq("user_id", user.id).maybeSingle(),
    ]);
    setCvs(cvData ?? []);
    setParsed(pData);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 10 * 1024 * 1024) return toast.error("Max 10MB");
    const allowed = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"];
    if (!allowed.includes(file.type)) return toast.error("PDF, DOCX, or TXT only");

    setUploading(true);
    try {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("cvs").upload(path, file);
      if (upErr) throw upErr;

      // Deactivate prior CVs
      await supabase.from("cv_documents").update({ is_active: false }).eq("user_id", user.id);

      const { data: doc, error: insErr } = await supabase.from("cv_documents").insert({
        user_id: user.id, file_name: file.name, file_path: path, mime_type: file.type, size_bytes: file.size, is_active: true,
      }).select().single();
      if (insErr) throw insErr;

      toast.success("Uploaded. Parsing with AI…");
      setParsing(true);
      const { data: parseRes, error: parseErr } = await supabase.functions.invoke("parse-cv", { body: { cv_document_id: doc.id } });
      if (parseErr) throw parseErr;
      toast.success("CV parsed!");
      await load();
    } catch (err: any) {
      toast.error(err.message ?? "Upload failed");
    } finally {
      setUploading(false);
      setParsing(false);
      e.target.value = "";
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold mb-2">Your CV</h1>
          <p className="text-muted-foreground">Upload PDF, DOCX, or TXT. We extract your profile with AI.</p>
        </div>

        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Upload CV</CardTitle>
            <CardDescription>Replaces your active CV. Max 10MB.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <label className="block">
              <input type="file" accept=".pdf,.docx,.txt" onChange={onFile} disabled={uploading || parsing} className="hidden" id="cv-upload" />
              <Button asChild className="bg-gradient-primary cursor-pointer" disabled={uploading || parsing}>
                <span><Upload className="h-4 w-4" />{uploading ? "Uploading…" : parsing ? "Parsing…" : "Choose file"}</span>
              </Button>
            </label>
            {cvs.length > 0 && (
              <Button variant="outline" disabled={parsing || uploading} onClick={async () => {
                const active = cvs.find((c) => c.is_active) ?? cvs[0];
                if (!active) return;
                setParsing(true);
                try {
                  const { error } = await supabase.functions.invoke("parse-cv", { body: { cv_document_id: active.id } });
                  if (error) throw error;
                  toast.success("CV parsed!");
                  await load();
                } catch (e: any) {
                  toast.error(e.message ?? "Parse failed");
                } finally { setParsing(false); }
              }}>
                <Sparkles className="h-4 w-4" /> {parsing ? "Parsing…" : "Re-parse latest CV"}
              </Button>
            )}
            {(uploading || parsing) && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
          </CardContent>
        </Card>

        {parsed && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> AI-Extracted Profile</CardTitle>
              <CardDescription>What the AI sees about you. Used for job matching and tailoring.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {parsed.summary && (
                <div>
                  <h3 className="font-semibold mb-1 text-sm">Summary</h3>
                  <p className="text-sm text-muted-foreground">{parsed.summary}</p>
                </div>
              )}
              {parsed.years_experience != null && (
                <div className="text-sm"><span className="font-semibold">Experience:</span> {parsed.years_experience} years</div>
              )}
              {parsed.skills && parsed.skills.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 text-sm">Skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {parsed.skills.map((s) => <Badge key={s} variant="secondary">{s}</Badge>)}
                  </div>
                </div>
              )}
              {Array.isArray(parsed.experience) && parsed.experience.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 text-sm">Experience</h3>
                  <ul className="space-y-2 text-sm">
                    {parsed.experience.map((e: any, i: number) => (
                      <li key={i} className="border-l-2 border-primary/30 pl-3">
                        <div className="font-medium">{e.title} {e.company && <span className="text-muted-foreground">· {e.company}</span>}</div>
                        {e.dates && <div className="text-xs text-muted-foreground">{e.dates}</div>}
                        {e.description && <p className="text-xs text-muted-foreground mt-1">{e.description}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {Array.isArray(parsed.education) && parsed.education.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 text-sm">Education</h3>
                  <ul className="space-y-1 text-sm">
                    {parsed.education.map((e: any, i: number) => (
                      <li key={i}>{e.degree} {e.institution && `— ${e.institution}`} {e.year && <span className="text-muted-foreground text-xs">({e.year})</span>}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload history</CardTitle>
          </CardHeader>
          <CardContent>
            {cvs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No uploads yet.</p>
            ) : (
              <ul className="space-y-2">
                {cvs.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 text-muted-foreground" />
                      <span>{c.file_name}</span>
                      {c.is_active && <Badge variant="outline" className="border-success text-success">Active</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default CV;
