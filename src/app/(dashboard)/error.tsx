"use client";

import { BrandedError } from "@/components/errors/branded-error";

export default function DashboardError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <BrandedError {...props} homeHref="/" homeLabel="Dashboard" />;
}
