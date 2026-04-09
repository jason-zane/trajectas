"use client";

import { useState } from "react";
import type { TaxonomyAssignmentRow } from "@/app/actions/partner-taxonomy";
import { LibraryDimensionsTable } from "./library-dimensions-table";
import { LibraryFactorsTable } from "./library-factors-table";
import { LibraryConstructsTable } from "./library-constructs-table";
import { cn } from "@/lib/utils";

type Tab = "dimensions" | "factors" | "constructs";

const tabs: { key: Tab; label: string }[] = [
  { key: "dimensions", label: "Dimensions" },
  { key: "factors", label: "Factors" },
  { key: "constructs", label: "Constructs" },
];

interface LibraryTabsProps {
  partnerId: string;
  dimensions: TaxonomyAssignmentRow[];
  factors: TaxonomyAssignmentRow[];
  constructs: TaxonomyAssignmentRow[];
  isPlatformAdmin: boolean;
}

export function LibraryTabs({
  partnerId,
  dimensions,
  factors,
  constructs,
  isPlatformAdmin,
}: LibraryTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("dimensions");

  return (
    <div className="space-y-4">
      {/* Pill tabs */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-sm font-medium transition-all",
              activeTab === tab.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "dimensions" && (
        <LibraryDimensionsTable
          rows={dimensions}
          partnerId={partnerId}
          isPlatformAdmin={isPlatformAdmin}
        />
      )}
      {activeTab === "factors" && (
        <LibraryFactorsTable
          rows={factors}
          partnerId={partnerId}
          isPlatformAdmin={isPlatformAdmin}
        />
      )}
      {activeTab === "constructs" && (
        <LibraryConstructsTable
          rows={constructs}
          partnerId={partnerId}
          isPlatformAdmin={isPlatformAdmin}
        />
      )}
    </div>
  );
}
