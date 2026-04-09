import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import { resolveSessionActor } from "@/lib/auth/actor";
import {
  buildSurfaceDestinationUrl,
  resolveDefaultWorkspaceContext,
} from "@/lib/auth/staff-auth";

const publicHomeUrl =
  process.env.PUBLIC_APP_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3002";

const errorCopy: Record<string, string> = {
  missing_code: "That sign-in link is missing required verification details.",
  callback_failed:
    "We couldn't complete that sign-in. Request a fresh link and try again.",
  session_missing:
    "We couldn't establish a session. Request a fresh link and try again.",
  session_expired:
    "Your session expired due to inactivity. Please sign in again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; email?: string; step?: string }>;
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

  const errorMessage =
    params.error && errorCopy[params.error]
      ? errorCopy[params.error]
      : null;

  return (
    <div className="min-h-screen overflow-hidden bg-[var(--mk-bg)] text-[var(--mk-text)]">
      <div className="relative isolate flex min-h-screen flex-col">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,169,98,0.22),transparent_32%),radial-gradient(circle_at_80%_18%,rgba(45,106,90,0.14),transparent_30%),linear-gradient(180deg,#f8f6f1_0%,#efe7da_100%)]" />
        <div className="absolute -right-24 top-20 h-80 w-80 rounded-full bg-[rgba(45,106,90,0.12)] blur-3xl" />
        <div className="absolute left-[-4rem] top-[38%] h-72 w-72 rounded-full bg-[rgba(201,169,98,0.16)] blur-3xl" />

        {/* Header */}
        <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-10">
          <Link
            href={publicHomeUrl}
            className="text-lg font-bold tracking-tight text-[var(--mk-primary-dark)]"
          >
            Trajectas
          </Link>
        </header>

        {/* Centered form */}
        <main className="relative z-10 flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-[420px]">
            {errorMessage ? (
              <div className="mb-4 rounded-2xl border border-[rgba(166,88,62,0.22)] bg-[rgba(255,245,239,0.92)] px-5 py-4 text-sm text-[#8f4a35]">
                {errorMessage}
              </div>
            ) : null}
            <div className="rounded-3xl border border-white/65 bg-white/78 p-2 shadow-[0_24px_80px_rgba(30,74,62,0.14)] backdrop-blur">
              <LoginForm
                nextPath={params.next}
                initialEmail={params.email}
                initialStep={params.step === "code" ? "code" : "email"}
              />
            </div>
            <p className="mt-4 text-center text-xs text-[var(--mk-text-muted)]">
              We&apos;ll send a secure sign-in code to your registered email.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
