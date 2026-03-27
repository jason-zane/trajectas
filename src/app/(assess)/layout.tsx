import { Brain } from "lucide-react";

export default function AssessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Brand bar */}
      <header className="flex h-12 items-center border-b border-border px-4">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
            <Brain className="size-4 text-primary" />
          </div>
          <span className="text-sm font-semibold tracking-tight">
            TalentFit
          </span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl px-4 py-8">{children}</div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-3">
        <p className="text-center text-xs text-muted-foreground">
          Powered by TalentFit &middot; Your responses are saved automatically
        </p>
      </footer>
    </div>
  );
}
