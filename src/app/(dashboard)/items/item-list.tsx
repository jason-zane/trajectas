"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollReveal } from "@/components/scroll-reveal";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import type { ItemStatus, ActiveResponseFormatType } from "@/types/database";
import type { ItemWithMeta } from "@/app/actions/items";

const statusConfig: Record<
  ItemStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  active: { label: "Active", variant: "default" },
  draft: { label: "Draft", variant: "secondary" },
  archived: { label: "Archived", variant: "outline" },
};

const formatConfig: Record<ActiveResponseFormatType, { label: string }> = {
  likert: { label: "Likert" },
  forced_choice: { label: "Forced Choice" },
  binary: { label: "Binary" },
  free_text: { label: "Free Text" },
  sjt: { label: "SJT" },
};

const allStatuses: { value: ItemStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "archived", label: "Archived" },
];

const allFormats: { value: ActiveResponseFormatType | "all"; label: string }[] = [
  { value: "all", label: "All Formats" },
  { value: "likert", label: "Likert" },
  { value: "forced_choice", label: "Forced Choice" },
  { value: "binary", label: "Binary" },
  { value: "free_text", label: "Free Text" },
  { value: "sjt", label: "SJT" },
];

export function ItemList({ items }: { items: ItemWithMeta[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ItemStatus | "all">("all");
  const [formatFilter, setFormatFilter] = useState<ActiveResponseFormatType | "all">(
    "all"
  );

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.stem.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.constructName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.factorName &&
        item.factorName.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;
    const matchesFormat =
      formatFilter === "all" || item.responseFormatType === formatFilter;
    return matchesSearch && matchesStatus && matchesFormat;
  });

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Library"
        title="Items"
        description="Items are individual questions and stimuli that form the building blocks of your assessments. Each item is linked to a construct and optionally to a factor."
      >
        <Link href="/items/create">
          <Button>
            <Plus className="size-4" />
            Create Item
          </Button>
        </Link>
      </PageHeader>

      {items.length === 0 ? (
        <EmptyState
          variant="item"
          title="No items yet"
          description="Items are the questions presented to candidates during assessments. Create your first item to begin building your item pool."
          actionLabel="Create Item"
          actionHref="/items/create"
        />
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search items by stem, construct, or factor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {/* Segmented status control */}
            <div className="flex rounded-lg bg-muted p-0.5">
              {allStatuses.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    statusFilter === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Format filter pills */}
          <div className="flex gap-2 flex-wrap -mt-4">
            {allFormats.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setFormatFilter(value)}
                className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  formatFilter === value
                    ? "bg-item-bg text-item-fg"
                    : "bg-transparent text-muted-foreground hover:text-foreground border border-border"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Table */}
          <ScrollReveal>
          <Card>
            <div className="rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Stem</TableHead>
                    <TableHead>Construct</TableHead>
                    <TableHead>Factor</TableHead>
                    <TableHead>Format</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-12 text-muted-foreground"
                      >
                        No items match your filters. Try adjusting your search
                        or filter criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => {
                      const status = statusConfig[item.status];
                      const format =
                        formatConfig[
                          item.responseFormatType as ActiveResponseFormatType
                        ];
                      return (
                        <TableRow
                          key={item.id}
                          className="group cursor-pointer"
                        >
                          <TableCell>
                            <Link href={`/items/${item.id}/edit`}>
                              <p className="text-sm line-clamp-2 whitespace-normal max-w-md hover:underline">
                                {item.stem}
                              </p>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {item.constructName}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {item.factorName || "\u2014"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="item">
                              {format?.label ?? item.responseFormatName}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>
                              {status.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
          </ScrollReveal>

          <p className="text-caption text-muted-foreground text-center">
            Showing {filteredItems.length} of {items.length} items
          </p>
        </>
      )}
    </div>
  );
}
