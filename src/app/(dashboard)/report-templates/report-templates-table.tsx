"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Copy, ExternalLink, LayoutTemplate, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { cloneReportTemplate, deleteReportTemplate } from "@/app/actions/reports";
import type { ReportTemplate } from "@/types/database";
import {
  DataTable,
  DataTableActionsMenu,
  DataTableColumnHeader,
  DataTableRowLink,
} from "@/components/data-table";
import { CreateTemplateButton } from "./create-template-button";
import { Badge } from "@/components/ui/badge";
import { ActiveToggle } from "./active-toggle";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

const REPORT_TYPE_LABELS: Record<string, string> = {
  self_report: "Self-report",
  "360": "360",
};

const DISPLAY_LEVEL_LABELS: Record<string, string> = {
  dimension: "Dimension",
  factor: "Factor",
  construct: "Construct",
};

type ReportTemplateRow = ReportTemplate & {
  blocksCount: number;
};

const columns: ColumnDef<ReportTemplateRow>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Template" />
    ),
    cell: ({ row }) => (
      <DataTableRowLink
        href={`/report-templates/${row.original.id}/builder`}
        ariaLabel={`Open ${row.original.name}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LayoutTemplate className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold hover:text-primary">{row.original.name}</p>
            {row.original.description ? (
              <p className="truncate text-sm text-muted-foreground">
                {row.original.description}
              </p>
            ) : null}
          </div>
        </div>
      </DataTableRowLink>
    ),
  },
  {
    accessorKey: "reportType",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">
        {REPORT_TYPE_LABELS[row.original.reportType] ?? row.original.reportType}
      </Badge>
    ),
  },
  {
    accessorKey: "displayLevel",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Display Level" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {DISPLAY_LEVEL_LABELS[row.original.displayLevel] ?? row.original.displayLevel}
      </span>
    ),
  },
  {
    accessorKey: "blocksCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Blocks" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.blocksCount}
      </span>
    ),
  },
  {
    accessorKey: "isActive",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Active" />
    ),
    cell: ({ row }) => (
      <div data-stop-row-click onClick={(event) => event.stopPropagation()}>
        <ActiveToggle templateId={row.original.id} isActive={row.original.isActive} />
      </div>
    ),
  },
  {
    id: "actions",
    enableSorting: false,
    cell: ({ row }) => <ReportTemplateRowActions template={row.original} />,
  },
];

function ReportTemplateRowActions({ template }: { template: ReportTemplateRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClone() {
    startTransition(async () => {
      try {
        const cloned = await cloneReportTemplate(template.id);
        toast.success("Template cloned");
        router.push(`/report-templates/${cloned.id}/builder`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to clone template");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteReportTemplate(template.id);
        toast.success("Template deleted");
        setOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to delete template");
      }
    });
  }

  return (
    <>
      <DataTableActionsMenu label={`Open actions for ${template.name}`}>
        <DropdownMenuItem onClick={() => router.push(`/report-templates/${template.id}/builder`)}>
          <ExternalLink className="size-4" />
          Open builder
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleClone} disabled={isPending}>
          <Copy className="size-4" />
          Clone template
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setOpen(true)}
          disabled={isPending}
          variant="destructive"
        >
          <Trash2 className="size-4" />
          Delete template
        </DropdownMenuItem>
      </DataTableActionsMenu>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete template?"
        description={`Delete "${template.name}". Any campaigns using this template will lose their report config.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        loading={isPending}
      />
    </>
  );
}

export function ReportTemplatesTable({
  templates,
}: {
  templates: ReportTemplate[];
}) {
  const rows = templates.map((template) => ({
    ...template,
    blocksCount: template.blocks.length,
  }));

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchableColumns={["name"]}
      searchPlaceholder="Search templates"
      defaultSort={{ id: "name", desc: false }}
      rowHref={(row) => `/report-templates/${row.id}/builder`}
      pageSize={20}
      emptyState={
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LayoutTemplate className="size-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">No templates yet</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Create a template to start building reports for campaigns.
            </p>
          </div>
          <CreateTemplateButton />
        </div>
      }
    />
  );
}
