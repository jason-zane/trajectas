import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LoginForm } from "@/app/login/login-form";
import { resolveSessionActor } from "@/lib/auth/actor";
import {
  buildSurfaceDestinationUrl,
  resolveDefaultWorkspaceContext,
} from "@/lib/auth/staff-auth";

const errorCopy: Record<string, string> = {
  missing_code: "That sign-in link is missing required verification details.",
  callback_failed:
    "We couldn't complete that sign-in link. Request a fresh email and try again.",
  session_missing:
    "We couldn't establish a session from that sign-in link. Request a fresh email and try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
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
      <div className="relative isolate min-h-screen">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(201,169,98,0.22),transparent_32%),radial-gradient(circle_at_80%_18%,rgba(45,106,90,0.14),transparent_30%),linear-gradient(180deg,#f8f6f1_0%,#efe7da_100%)]" />
        <div className="absolute -right-24 top-20 h-80 w-80 rounded-full bg-[rgba(45,106,90,0.12)] blur-3xl" />
        <div className="absolute left-[-4rem] top-[38%] h-72 w-72 rounded-full bg-[rgba(201,169,98,0.16)] blur-3xl" />

        <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-10">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-[var(--mk-primary-dark)]"
          >
            Trajectas
          </Link>
          <Link
            href="/"
            className="mk-mono text-[var(--mk-primary-dark)]/70 transition-colors duration-200 hover:text-[var(--mk-primary-dark)]"
          >
            Back to site
          </Link>
        </header>

        <main className="relative z-10 mx-auto flex min-h-[calc(100svh-88px)] max-w-6xl flex-col gap-12 px-6 pb-16 pt-4 md:px-10 lg:flex-row lg:items-center lg:justify-between lg:gap-20">
          <section className="max-w-2xl space-y-6">
            <p className="mk-eyebrow">Workspace access</p>
            <div className="space-y-5">
              <h1 className="mk-display max-w-4xl font-[family-name:var(--font-display)] text-[var(--mk-primary-dark)]">
                One sign-in, routed to the right Trajectas workspace.
              </h1>
              <p className="mk-body max-w-xl text-[var(--mk-text-muted)]">
                Platform admins, partner teams, and client teams all enter here.
                Use the email already registered to your account and we&apos;ll
                send a secure sign-in link.
              </p>
            </div>

            <div className="grid max-w-xl gap-4 text-sm text-[var(--mk-text-muted)] md:grid-cols-3">
              <div className="border-t border-[rgba(30,74,62,0.18)] pt-4">
                <p className="mk-mono text-[var(--mk-primary-dark)]">01</p>
                <p className="mt-2">
                  We recognise your email and select the right surface
                  automatically.
                </p>
              </div>
              <div className="border-t border-[rgba(30,74,62,0.18)] pt-4">
                <p className="mk-mono text-[var(--mk-primary-dark)]">02</p>
                <p className="mt-2">
                  Admin users land in platform admin. Partner and client users go
                  straight to their workspace.
                </p>
              </div>
              <div className="border-t border-[rgba(30,74,62,0.18)] pt-4">
                <p className="mk-mono text-[var(--mk-primary-dark)]">03</p>
                <p className="mt-2">
                  The same entry point also supports invite acceptance and
                  requested deep links.
                </p>
              </div>
            </div>
          </section>

          <section className="w-full max-w-lg">
            {errorMessage ? (
              <div className="mb-4 rounded-[24px] border border-[rgba(166,88,62,0.22)] bg-[rgba(255,245,239,0.92)] px-5 py-4 text-sm text-[#8f4a35] shadow-[0_12px_40px_rgba(143,74,53,0.08)]">
                {errorMessage}
              </div>
            ) : null}
            <div className="rounded-[30px] border border-white/65 bg-white/78 p-2 shadow-[0_24px_80px_rgba(30,74,62,0.14)] backdrop-blur">
              <LoginForm nextPath={params.next} />
            </div>
            <p className="mt-4 text-sm text-[var(--mk-text-muted)]">
              If the email has access, we&apos;ll send a magic link. If you were
              expecting an invite, use the address the invite was sent to or ask
              your Trajectas admin to resend it.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
