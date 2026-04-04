import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UnauthorizedActions } from "./unauthorized-actions";

const reasonCopy: Record<string, string> = {
  invite: "That invite is invalid, expired, or was accepted with the wrong email address.",
  inactive: "Your account is authenticated but currently inactive.",
  membership: "Your account does not have an active workspace membership yet.",
};

export default async function UnauthorizedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const description =
    (reason && reasonCopy[reason]) ??
    "You are signed in, but this account does not have permission to enter the requested workspace.";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg items-center px-6 py-16">
      <Card className="w-full border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle>Access not available</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <UnauthorizedActions />
        </CardContent>
      </Card>
    </div>
  );
}
