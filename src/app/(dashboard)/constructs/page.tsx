import Link from "next/link";
import { Plus, Dna, Brain, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ScrollReveal } from "@/components/scroll-reveal";
import { getTraits } from "@/app/actions/traits";

export default async function ConstructsPage() {
  const constructs = await getTraits();

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        eyebrow="Library"
        title="Constructs"
        description="Constructs are measurable attributes that sit between factors and items. They provide finer-grained measurement within each factor."
      >
        <Link href="/constructs/create">
          <Button>
            <Plus className="size-4" />
            Create Construct
          </Button>
        </Link>
      </PageHeader>

      {constructs.length === 0 ? (
        <EmptyState
          variant="trait"
          title="No constructs yet"
          description="Constructs add a layer of granularity between factors and items. Create your first construct to start building your measurement model."
          actionLabel="Create Construct"
          actionHref="/constructs/create"
        />
      ) : (
        <div className="grid gap-3">
          {constructs.map((construct, index) => (
            <ScrollReveal key={construct.id} delay={index * 60}>
            <Link href={`/constructs/${construct.slug}/edit`}>
              <Card
                variant="interactive"
                className="border-l-[3px] border-l-transparent hover:border-l-trait-accent"
              >
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-trait-bg transition-colors">
                    <Dna className="size-5 text-trait-accent" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium">{construct.name}</h3>
                      <Badge variant="dot">
                        <span
                          className={`size-1.5 rounded-full ${construct.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                        />
                        {construct.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {construct.description && (
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                        {construct.description}
                      </p>
                    )}
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                    <Brain className="size-3.5" />
                    <span>
                      {construct.competencyCount}{" "}
                      {construct.competencyCount === 1 ? "factor" : "factors"}
                    </span>
                  </div>

                  <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0" />
                </CardContent>
              </Card>
            </Link>
            </ScrollReveal>
          ))}
        </div>
      )}
    </div>
  );
}
