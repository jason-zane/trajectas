import Link from "next/link";
import { Plus, LayoutGrid, Layers, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ScrollReveal } from "@/components/scroll-reveal";
import { getDimensions } from "@/app/actions/dimensions";

export default async function DimensionsPage() {
  const dimensions = await getDimensions();

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        eyebrow="Library"
        title="Dimensions"
        description="Dimensions are top-level groupings that organise your factors into meaningful clusters for assessment and reporting."
      >
        <Link href="/dimensions/create">
          <Button>
            <Plus className="size-4" />
            Create Dimension
          </Button>
        </Link>
      </PageHeader>

      {dimensions.length === 0 ? (
        <EmptyState
          variant="dimension"
          title="No dimensions yet"
          description="Dimensions help you organise factors into logical groups. Create your first dimension to get started."
          actionLabel="Create Dimension"
          actionHref="/dimensions/create"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {dimensions.map((dimension, index) => (
            <ScrollReveal key={dimension.id} delay={index * 60}>
            <Link
              href={`/dimensions/${dimension.slug}/edit`}
            >
              <Card
                variant="interactive"
                className="border-l-[3px] border-l-dimension-accent"
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-dimension-bg transition-colors">
                        <LayoutGrid className="size-5 text-dimension-accent" />
                      </div>
                      <div>
                        <CardTitle>{dimension.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="dot">
                            <span
                              className={`size-1.5 rounded-full ${dimension.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                            />
                            {dimension.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity mt-1" />
                  </div>
                </CardHeader>
                <CardContent>
                  {dimension.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                      {dimension.description}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Layers className="size-3.5" />
                    <span>
                      {dimension.competencyCount}{" "}
                      {dimension.competencyCount === 1
                        ? "factor"
                        : "factors"}
                    </span>
                  </div>
                  <div className="mt-2 h-0.5 w-full rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-dimension-accent transition-all"
                      style={{ width: `${Math.min((dimension.competencyCount / 10) * 100, 100)}%`, opacity: 0.6 }}
                    />
                  </div>
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
