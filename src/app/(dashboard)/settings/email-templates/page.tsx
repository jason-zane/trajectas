import Link from "next/link"
import { ArrowRight, KeyRound, Megaphone, Settings2 } from "lucide-react"

import { listEmailTemplates } from "@/app/actions/email-templates"
import {
  EMAIL_TYPE_CATEGORIES,
  EMAIL_TYPE_LABELS,
  type EmailTemplateScope,
} from "@/lib/email/types"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollReveal } from "@/components/scroll-reveal"
import { TiltCard } from "@/components/tilt-card"

const CATEGORY_META: Record<string, { icon: typeof KeyRound; accentVar: string }> = {
  Authentication: { icon: KeyRound, accentVar: "--primary" },
  Campaigns: { icon: Megaphone, accentVar: "--primary" },
  Platform: { icon: Settings2, accentVar: "--primary" },
}

interface Props {
  searchParams: Promise<{ scope?: string; scopeId?: string }>
}

export default async function EmailTemplatesPage({ searchParams }: Props) {
  const params = await searchParams
  const scopeType = (params.scope ?? "platform") as EmailTemplateScope
  const scopeId = params.scopeId ?? null

  const templates = await listEmailTemplates(scopeType, scopeId)
  const templateMap = new Map(templates.map((t) => [t.type, t]))

  let cardIndex = 0

  return (
    <div className="space-y-8">
      <PageHeader
        title="Email Templates"
        eyebrow="Settings"
        description="Manage the email templates used across the platform for authentication, campaigns, and notifications."
      />

      {Object.entries(EMAIL_TYPE_CATEGORIES).map(([category, types]) => {
        const meta = CATEGORY_META[category] ?? CATEGORY_META.Platform
        const Icon = meta.icon

        return (
          <section key={category} className="space-y-3">
            <h2 className="text-section">{category}</h2>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {types.map((type) => {
                const template = templateMap.get(type)
                const label = EMAIL_TYPE_LABELS[type]
                const idx = cardIndex++

                return (
                  <ScrollReveal key={type} delay={idx * 60}>
                    <TiltCard>
                      <Link href={`/settings/email-templates/${type}?scope=${scopeType}${scopeId ? `&scopeId=${scopeId}` : ""}`}>
                        <Card variant="interactive" className="h-full">
                          <CardContent className="flex items-start gap-3">
                            <div
                              className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover/card:shadow-[0_0_20px_var(--glow-color)] transition-shadow duration-300"
                              style={
                                {
                                  "--glow-color": `var(${meta.accentVar})`,
                                } as React.CSSProperties
                              }
                            >
                              <Icon className="size-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-semibold truncate">
                                  {label}
                                </p>
                                <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 -translate-x-1 transition-all duration-200 group-hover/card:opacity-100 group-hover/card:translate-x-0" />
                              </div>
                              <p className="text-caption text-muted-foreground mt-0.5">
                                {template
                                  ? template.subject
                                  : "Using default template"}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </TiltCard>
                  </ScrollReveal>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
