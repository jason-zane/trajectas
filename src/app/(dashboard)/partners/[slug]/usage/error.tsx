"use client";
import { BrandedError } from "@/components/errors/branded-error";
export default function UsageError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <BrandedError {...props} />;
}
