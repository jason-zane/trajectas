import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import { resolveSessionActor } from "@/lib/auth/actor";
import {
  buildSurfaceDestinationUrl,
  resolveDefaultWorkspaceContext,
} from "@/lib/auth/staff-auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const actor = await resolveSessionActor();
  const params = await searchParams;
  const headerStore = await headers();

  if (actor?.isActive) {
    const context = resolveDefaultWorkspaceContext(actor);
    const destination = buildSurfaceDestinationUrl({
      surface: context.surface,
      path: params.next && params.next.startsWith("/") ? params.next : "/",
      requestUrl: process.env.PUBLIC_APP_URL ?? process.env.ADMIN_APP_URL ?? "http://localhost:3002",
      host: headerStore.get("host"),
    });
    redirect(destination.toString());
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-6 py-16">
      <LoginForm nextPath={params.next} />
    </div>
  );
}
