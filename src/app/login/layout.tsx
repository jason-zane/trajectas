import type { Metadata } from "next";
import "../(marketing)/globals-marketing.css";

export const metadata: Metadata = {
  title: "Sign in — Trajectas",
  description:
    "Secure workspace sign-in for platform admins, partners, and clients.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-surface="marketing">
      {children}
    </div>
  );
}
