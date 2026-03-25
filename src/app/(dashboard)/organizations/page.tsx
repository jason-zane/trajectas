import Link from "next/link";
import { Plus, Building2, ArrowRight, ClipboardList, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { getOrganizations } from "@/app/actions/organizations";

export default async function OrganisationsPage() {
  const organizations = await getOrganizations();

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        title="Organisations"
        description="Manage client organisations and their assessment engagements."
      >
        <Link href="/organizations/create">
          <Button>
            <Plus className="size-4" />
            Add Organisation
          </Button>
        </Link>
      </PageHeader>

      {organizations.length === 0 ? (
        <EmptyState
          title="No organisations yet"
          description="Add your first client organisation to begin running diagnostics and assessments."
          actionLabel="Add Organisation"
          actionHref="/organizations/create"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {organizations.map((org, index) => (
            <Link
              key={org.id}
              href={`/organizations/${org.slug}/edit`}
            >
              <Card
                variant="interactive"
                className={`stagger-${index + 1} animate-fade-in-up`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted transition-colors">
                        <Building2 className="size-5 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle>{org.name}</CardTitle>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant="dot">
                            <span
                              className={`size-1.5 rounded-full ${org.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
                            />
                            {org.isActive ? "Active" : "Inactive"}
                          </Badge>
                          {org.industry && (
                            <Badge variant="secondary">{org.industry}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground opacity-0 group-hover/card:opacity-100 transition-opacity mt-1" />
                  </div>
                </CardHeader>
                <CardContent>
                  {org.sizeRange && (
                    <p className="text-sm text-muted-foreground mb-4">
                      {org.sizeRange} employees
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <ClipboardList className="size-3.5" />
                      <span>
                        {org.assessmentCount}{" "}
                        {org.assessmentCount === 1
                          ? "assessment"
                          : "assessments"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="size-3.5" />
                      <span>
                        {org.sessionCount}{" "}
                        {org.sessionCount === 1
                          ? "session"
                          : "sessions"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
