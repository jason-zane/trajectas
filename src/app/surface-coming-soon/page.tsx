import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight, Building2, Shield, Users } from "lucide-react";
import { buildSurfaceUrl } from "@/lib/hosts";
import { coerceSurface, surfaceDescriptions, surfaceLabels } from "@/lib/surfaces";

const surfaceIcons = {
  public: ArrowRight,
  assess: Users,
  admin: Shield,
  partner: Building2,
  client: Building2,
} as const;

export default async function SurfaceComingSoonPage() {
  const headerStore = await headers();
  const surface = coerceSurface(headerStore.get("x-talentfit-surface"), "public");
  const SurfaceIcon = surfaceIcons[surface];
  const adminUrl = buildSurfaceUrl("admin", "/");
  const assessUrl = buildSurfaceUrl("assess", "/assess");

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(61,122,110,0.18),_transparent_50%),_linear-gradient(180deg,_#f8f6f2,_#fff)] px-6 py-16">
      <div className="w-full max-w-2xl rounded-[28px] border border-black/5 bg-white/90 p-8 shadow-[0_40px_120px_rgba(17,24,32,0.08)] backdrop-blur">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-black/70">
          <SurfaceIcon className="size-3.5" />
          {surfaceLabels[surface]}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-[#111820]">
          This surface is reserved but not built yet.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-black/65">
          {surfaceDescriptions[surface]}. The host boundary is active now so the
          route cannot fall through to the wrong workspace while the dedicated
          UI is still being implemented.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {adminUrl ? (
            <Link
              href={adminUrl.toString()}
              className="inline-flex items-center gap-2 rounded-full bg-[#111820] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1d2937]"
            >
              Open admin surface
              <ArrowRight className="size-4" />
            </Link>
          ) : null}
          {assessUrl ? (
            <Link
              href={assessUrl.toString()}
              className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-[#111820] transition-colors hover:bg-black/[0.03]"
            >
              Open assessment runtime
              <Users className="size-4" />
            </Link>
          ) : null}
        </div>
      </div>
    </main>
  );
}
