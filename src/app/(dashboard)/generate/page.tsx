import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { getGenerationRuns } from "@/app/actions/generation";
import { GenerationRunsTable } from "./generation-runs-table";

export default async function GeneratePage() {
  const runs = await getGenerationRuns();

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        eyebrow="Library"
        title="Item Generator"
        description="Generate psychometric items for your constructs using AI. Review and accept items into your library."
      >
        <Link href="/generate/new">
          <Button>
            <Plus className="size-4" />
            New Generation
          </Button>
        </Link>
      </PageHeader>

      <GenerationRunsTable runs={runs} />
    </div>
  );
}
