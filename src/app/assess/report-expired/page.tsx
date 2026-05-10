import { XCircle } from "lucide-react";
import { ReportExpiredForm } from "./report-expired-form";

interface Props {
  searchParams: Promise<{ snapshotId?: string }>;
}

export default async function ReportExpiredPage({ searchParams }: Props) {
  const { snapshotId } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="flex h-14 items-center px-4 sm:px-6"
        style={{
          background: "var(--brand-neutral-50, hsl(var(--background)))",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-sm font-semibold tracking-tight"
            style={{ color: "var(--brand-text, hsl(var(--foreground)))" }}
          >
            Trajectas
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[520px] text-center space-y-6">
          <div className="flex justify-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="size-10 text-destructive" />
            </div>
          </div>

          <div className="space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              This report link has expired
            </h1>
            <p className="mx-auto max-w-md leading-relaxed text-muted-foreground">
              Report links expire after 48 hours for security. Enter the email
              address you used when taking the assessment and we&rsquo;ll send
              you a fresh link.
            </p>
          </div>

          <ReportExpiredForm snapshotId={snapshotId} />
        </div>
      </main>

      <footer className="flex items-center justify-center px-4 py-4">
        <span className="text-xs text-muted-foreground">Trajectas</span>
      </footer>
    </div>
  );
}
