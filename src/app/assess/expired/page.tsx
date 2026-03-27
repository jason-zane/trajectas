import { XCircle } from "lucide-react";

export default function ExpiredPage() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex size-20 items-center justify-center rounded-full bg-destructive/10 mb-6">
        <XCircle className="size-10 text-destructive" />
      </div>
      <h1 className="text-2xl font-semibold mb-2">
        Link Expired
      </h1>
      <p className="text-muted-foreground max-w-md">
        This assessment link is no longer valid. The campaign may have closed or
        your access may have been revoked. Please contact your administrator.
      </p>
    </div>
  );
}
