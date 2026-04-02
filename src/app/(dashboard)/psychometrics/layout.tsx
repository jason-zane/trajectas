"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const tabs = [
  { label: "Overview", href: "/psychometrics" },
  { label: "Item Health", href: "/psychometrics/items" },
  { label: "Reliability", href: "/psychometrics/reliability" },
  { label: "Norms", href: "/psychometrics/norms" },
]

export default function PsychometricsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div>
      <nav className="flex gap-1 border-b border-border mb-6 px-6">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/psychometrics"
              ? pathname === "/psychometrics"
              : pathname.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
      {children}
    </div>
  )
}
