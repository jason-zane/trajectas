import Link from "next/link";
import { TrajectasLogo } from "@/components/brand/trajectas-logo";

export function WallHeader({ email }: { email?: string | null }) {
  return (
    <header className="flex items-center justify-between gap-4 px-6 py-6 sm:px-12">
      <Link href="/" className="mark" aria-label="Trajectas home">
        <TrajectasLogo variant="horizontal" light height={20} />
      </Link>
      {email && (
        <span className="tag relative">
          <i className="pin" aria-hidden="true" />
          Verified &middot; {email}
        </span>
      )}
    </header>
  );
}
