import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Smartphone } from "lucide-react";
import { toast } from "sonner";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export const InstallButton = ({ size = "lg", variant = "outline" as const }: { size?: "sm" | "lg" | "default"; variant?: "outline" | "default" | "secondary" }) => {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua));
    setStandalone(window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => setInstalled(true);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (standalone || installed) return null;

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
      return;
    }
    if (isIOS) {
      toast.info("Tap the Share button, then 'Add to Home Screen' to install.");
      return;
    }
    toast.info("Open your browser menu and choose 'Install app' or 'Add to Home Screen'.");
  };

  return (
    <Button onClick={handleClick} size={size} variant={variant} className="gap-2">
      {isIOS ? <Smartphone className="h-4 w-4" /> : <Download className="h-4 w-4" />}
      Install app
    </Button>
  );
};
