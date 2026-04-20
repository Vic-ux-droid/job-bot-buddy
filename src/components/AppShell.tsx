import { Link, NavLink, useNavigate } from "react-router-dom";
import { Briefcase, FileText, LayoutDashboard, LogOut, Settings, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/cv", label: "My CV", icon: FileText },
  { to: "/matches", label: "Job Matches", icon: Briefcase },
  { to: "/settings", label: "Settings", icon: Settings },
];

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-40">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Link to="/dashboard" className="flex items-center gap-2 font-bold text-lg">
            <div className="h-8 w-8 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-gradient">JobPilot AI</span>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs text-muted-foreground truncate max-w-[140px]">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <nav className="md:hidden flex items-center gap-1 px-3 pb-2 overflow-x-auto">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
                )
              }
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="container py-6 md:py-10">{children}</main>
    </div>
  );
};
