import { CheckCircle2 } from "lucide-react";

export default function CompletePage() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 mb-6">
        <CheckCircle2 className="size-10 text-primary animate-in zoom-in duration-500" />
      </div>
      <h1 className="text-2xl font-semibold mb-2">
        Thank You
      </h1>
      <p className="text-muted-foreground max-w-md">
        Your assessment has been submitted successfully. You can safely close
        this page.
      </p>
    </div>
  );
}
