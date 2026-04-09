"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteAssessment } from "@/app/actions/assessments";
import type { AssessmentWithMeta } from "@/app/actions/assessments";
import {
  DataTable,
  DataTableActionsMenu,
  DataTableColumnHeader,
  DataTableRowLink,
} from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

const STATUS_VARIANT: Record<string, "secondary" | "default" | "outline"> = {
  draft: "secondary",
  active: "default",
  archived: "outline",
};

const CREATION_MODE_LABEL: Record<string, string> = {
  manual: "Manual",
  ai_generated: "AI Generated",
  org_choice: "Org Choice",
};

const columns: ColumnDef<AssessmentWithMeta>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title" />
    ),
    cell: ({ row }) => (
      <DataTableRowLink
        href={`/assessments/${row.original.id}/edit`}
        ariaLabel={`Open ${row.original.title}`}
        className="min-w-0"
      >
        <p className="truncate font-semibold text-foreground hover:text-primary">
          {row.original.title}
        </p>
      </DataTableRowLink>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.status] ?? "secondary"}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "creationMode",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Creation Mode" />
    ),
    cell: ({ row }) => (
      <Badge variant="outline">
        {CREATION_MODE_LABEL[row.original.creationMode] ?? row.original.creationMode}
      </Badge>
    ),
  },
  {
    accessorKey: "factorCount",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Factors" />
    ),
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.factorCount}
      </span>
    ),
  },
  {
    id: "actions",
    enableSorting: false,
    cell: ({ row }) => <AssessmentRowActions assessment={row.original} />,
  },
];

function AssessmentRowActions({ assessment }: { assessment: AssessmentWithMeta }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteAssessment(assessment.id);
      if (result && "error" in result && result.error) {
        toast.error(
          typeof result.error === "string" ? result.error : "Failed to archive assessment"
        );
        return;
      }

      toast.success("Assessment archived");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <DataTableActionsMenu label={`Open actions for ${assessment.title}`}>
        <DropdownMenuItem onClick={() => router.push(`/assessments/${assessment.id}/edit`)}>
          <ExternalLink className="size-4" />
          Edit assessment
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setOpen(true)}
          disabled={isPending}
          variant="destructive"
        >
          <Trash2 className="size-4" />
          Archive assessment
        </DropdownMenuItem>
      </DataTableActionsMenu>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Archive assessment?"
        description={`Archive "${assessment.title}". You can restore it later if needed.`}
        confirmLabel="Archive"
        variant="destructive"
        onConfirm={handleDelete}
        loading={isPending}
      />
    </>
  );
}

export function AssessmentsDataTable({
  assessments,
}: {
  assessments: AssessmentWithMeta[];
}) {
  return (
    <DataTable
      columns={columns}
      data={assessments}
      searchableColumns={["title"]}
      searchPlaceholder="Search assessments"
      filterableColumns={[
        {
          id: "status",
          title: "Status",
          options: [
            { label: "Draft", value: "draft" },
            { label: "Active", value: "active" },
            { label: "Archived", value: "archived" },
          ],
        },
      ]}
      defaultSort={{ id: "title", desc: false }}
      rowHref={(row) => `/assessments/${row.id}/edit`}
      pageSize={20}
    />
  );
}
