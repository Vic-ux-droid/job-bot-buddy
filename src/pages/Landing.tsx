import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Briefcase, FileText, Send, Sparkles, Target, Zap } from "lucide-react";
import { InstallButton } from "@/components/InstallButton";

const Landing = () => {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="container flex items-center justify-between h-16">
        <div className="flex items-center gap-2 font-bold text-lg">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-gradient">JobPilot AI</span>
        </div>
        <Button asChild size="sm"><Link to="/auth">Sign in</Link></Button>
      </header>

      <section className="container py-16 md:py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6">
          <Zap className="h-3 w-3" /> AI-powered job pipeline
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
          Stop spraying CVs. <br />
          <span className="text-gradient">Land interviews.</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Upload your CV once. Our AI scans IT jobs across Remotive, Arbeitnow, RemoteOK & Adzuna,
          scores each match, and tailors your CV for every role — delivered straight to your Telegram.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button asChild size="lg" className="bg-gradient-primary shadow-glow hover:opacity-90">
            <Link to="/auth">Get started — free</Link>
          </Button>
          <InstallButton size="lg" variant="outline" />
          <Button asChild size="lg" variant="ghost">
            <a href="#how">How it works</a>
          </Button>
        </div>
      </section>

      <section id="how" className="container py-16 grid md:grid-cols-4 gap-6">
        {[
          { icon: FileText, title: "Upload your CV", desc: "PDF or DOCX. We parse skills, experience, and education with AI." },
          { icon: Target, title: "AI matches jobs", desc: "Scored 0–100 against your profile. Only relevant IT roles." },
          { icon: Sparkles, title: "Tailored CV per role", desc: "ATS-optimized rewrite for every match. Truthful, never fabricated." },
          { icon: Send, title: "Telegram alerts", desc: "Tailored PDF + apply link sent to you. One tap to submit." },
        ].map((s, i) => (
          <div key={i} className="rounded-2xl border bg-card p-6 shadow-sm hover:shadow-elegant transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center mb-4">
              <s.icon className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold mb-2">{s.title}</h3>
            <p className="text-sm text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </section>

      <section className="container py-16">
        <div className="rounded-3xl bg-gradient-hero p-10 md:p-16 text-center text-primary-foreground shadow-glow">
          <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-90" />
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to apply smarter?</h2>
          <p className="opacity-90 mb-6 max-w-xl mx-auto">
            Sign up, drop your CV, and start getting tailored matches in minutes.
          </p>
          <Button asChild size="lg" variant="secondary">
            <Link to="/auth">Create your account</Link>
          </Button>
        </div>
      </section>

      <footer className="container py-8 text-center text-xs text-muted-foreground">
        Semi-auto: we prepare everything, you click submit. We never fabricate experience.
      </footer>
    </div>
  );
};

export default Landing;
