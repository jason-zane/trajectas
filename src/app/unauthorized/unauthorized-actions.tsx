"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function UnauthorizedActions() {
  return (
    <div className="flex gap-3">
      <Link href="/login" className={buttonVariants()}>
        Back to sign in
      </Link>
      <Link href="/logout" className={buttonVariants({ variant: "outline" })}>
        Sign out
      </Link>
    </div>
  );
}
