"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Layers,
  Search,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  FileQuestion,
  Dna,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { SettingsTab } from "@/app/(dashboard)/_shared/settings-tab";
import {
  createBlock,
  updateBlock,
  deleteBlock,
} from "@/app/actions/forced-choice-blocks";
import type { BlockItemOption } from "@/app/actions/forced-choice-blocks";

interface SelectedItem {
  id: string;
  stem: string;
  constructName: string;
}

interface BlockFormProps {
  mode: "create" | "edit";
  blockId?: string;
  itemOptions: BlockItemOption[];
  initialData?: {
    name: string;
    description: string;
    items: {
      id: string;
      stem: string;
      constructName: string;
      position: number;
    }[];
  };
}

export function BlockForm({
  mode,
  blockId,
  itemOptions,
  initialData,
}: BlockFormProps) {
  const router = useRouter();

  const [name, setName] = useState(initialData?.name ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>(
    initialData?.items.map((i) => ({
      id: i.id,
      stem: i.stem,
      constructName: i.constructName,
    })) ?? []
  );
  const [isActive] = useState(true);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState("");

  // Filter available items (exclude already selected)
  const selectedIds = useMemo(
    () => new Set(selectedItems.map((i) => i.id)),
    [selectedItems]
  );

  const availableItems = useMemo(() => {
    let items = itemOptions.filter((i) => !selectedIds.has(i.id));
    if (itemSearch) {
      const q = itemSearch.toLowerCase();
      items = items.filter(
        (i) =>
          i.stem.toLowerCase().includes(q) ||
          i.constructName.toLowerCase().includes(q)
      );
    }
    return items;
  }, [itemOptions, selectedIds, itemSearch]);

  // Check for duplicate constructs warning
  const duplicateConstructWarning = useMemo(() => {
    const constructCounts: Record<string, number> = {};
    for (const item of selectedItems) {
      if (item.constructName) {
        constructCounts[item.constructName] =
          (constructCounts[item.constructName] ?? 0) + 1;
      }
    }
    const duplicates = Object.entries(constructCounts)
      .filter(([, count]) => count >= 2)
      .map(([name]) => name);
    return duplicates;
  }, [selectedItems]);

  const canAddMore = selectedItems.length < 4;
  const hasMinimumItems = selectedItems.length >= 3;

  function addItem(item: BlockItemOption) {
    if (!canAddMore) return;
    setSelectedItems((prev) => [
      ...prev,
      { id: item.id, stem: item.stem, constructName: item.constructName },
    ]);
  }

  function removeItem(itemId: string) {
    setSelectedItems((prev) => prev.filter((i) => i.id !== itemId));
  }

  function moveItem(index: number, direction: "up" | "down") {
    const newItems = [...selectedItems];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    [newItems[index], newItems[targetIndex]] = [
      newItems[targetIndex],
      newItems[index],
    ];
    setSelectedItems(newItems);
  }

  async function handleSubmit(formData: FormData) {
    formData.set("itemIds", JSON.stringify(selectedItems.map((i) => i.id)));

    setPending(true);
    setError(null);

    const result =
      mode === "edit" && blockId
        ? await updateBlock(blockId, formData)
        : await createBlock(formData);

    if (result?.error) {
      const errors = result.error;
      const msg =
        typeof errors === "object" && "_form" in errors
          ? (errors as Record<string, string[]>)._form?.[0]
          : typeof errors === "object"
            ? Object.values(errors).flat().join(", ")
            : String(errors);
      setError(msg ?? "Validation failed");
      toast.error(msg ?? "Validation failed");
      setPending(false);
      return;
    }

    if (mode === "create" && result && "id" in result) {
      toast.success("Block created");
      router.replace(`/forced-choice-blocks/${result.id}/edit`);
    } else {
      toast.success("Block saved");
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!blockId) return;
    setDeleting(true);

    const result = await deleteBlock(blockId);
    if (result?.error) {
      toast.error(
        typeof result.error === "string" ? result.error : "Failed to delete"
      );
      setDeleting(false);
      return;
    }

    toast.success("Block deleted");
    router.push("/forced-choice-blocks");
  }

  const title = mode === "create" ? "Create Block" : "Edit Block";
  const subtitle =
    mode === "create"
      ? "Create a new forced choice block with 3-4 items."
      : "Update this forced choice block.";

  const saveButtonLabel = pending
    ? mode === "create"
      ? "Creating..."
      : "Saving..."
    : mode === "create"
      ? "Create Block"
      : "Save Changes";

  return (
    <div className="space-y-8 max-w-3xl">
      <PageHeader title={title} description={subtitle} />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form action={handleSubmit}>
        <Tabs defaultValue="details">
          <TabsList variant="line" className="mb-6">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="items">
              Items
              {selectedItems.length > 0 && (
                <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                  {selectedItems.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* ── Details tab ── */}
          <TabsContent value="details" keepMounted>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Layers className="size-4 text-primary" />
                    <div>
                      <CardTitle>Block Details</CardTitle>
                      <CardDescription>
                        Name and describe this forced choice block.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="e.g. Leadership Communication Block A"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Optional description of this block's purpose or content theme..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="min-h-20 resize-y"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── Items tab ── */}
          <TabsContent value="items" keepMounted>
            <div className="space-y-6">
              {/* Selected items */}
              <Card className="border-l-[3px] border-l-primary">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Layers className="size-4 text-primary" />
                    <div>
                      <CardTitle>Selected Items</CardTitle>
                      <CardDescription>
                        {selectedItems.length}/4 items selected (minimum 3).
                        Reorder using the arrows.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedItems.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center">
                      <Layers className="size-8 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No items selected. Add 3-4 items from the picker below.
                      </p>
                    </div>
                  ) : (
                    <>
                      {selectedItems.map((item, index) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-lg border p-3 bg-card"
                        >
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm line-clamp-2">{item.stem}</p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <Dna className="size-3 text-trait-accent" />
                              <span className="text-xs text-muted-foreground">
                                {item.constructName || "No construct"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="size-7 p-0"
                              disabled={index === 0}
                              onClick={() => moveItem(index, "up")}
                            >
                              <ChevronUp className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="size-7 p-0"
                              disabled={index === selectedItems.length - 1}
                              onClick={() => moveItem(index, "down")}
                            >
                              <ChevronDown className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="size-7 p-0 text-muted-foreground hover:text-destructive"
                              onClick={() => removeItem(item.id)}
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      {!hasMinimumItems && (
                        <p className="text-xs text-amber-600 flex items-center gap-1.5">
                          <AlertTriangle className="size-3.5" />
                          Add at least {3 - selectedItems.length} more item{3 - selectedItems.length !== 1 ? "s" : ""} (minimum 3).
                        </p>
                      )}
                    </>
                  )}

                  {duplicateConstructWarning.length > 0 && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                      <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                        <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                        <span>
                          Items from the same construct detected:{" "}
                          <strong>{duplicateConstructWarning.join(", ")}</strong>.
                          For best measurement, items should ideally come from
                          different constructs.
                        </span>
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Item picker */}
              {canAddMore && (
                <Card>
                  <CardHeader>
                    <CardTitle>Add Items</CardTitle>
                    <CardDescription>
                      Search and select active construct items to add to this block.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search by stem or construct name..."
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-1.5 rounded-lg border p-2">
                      {availableItems.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">
                          {itemSearch
                            ? "No matching items found."
                            : "No available items."}
                        </p>
                      ) : (
                        availableItems.slice(0, 50).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => addItem(item)}
                            className="w-full flex items-start gap-3 rounded-md p-2.5 text-left transition-colors hover:bg-muted/50 group"
                          >
                            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-item-bg mt-0.5">
                              <FileQuestion className="size-3.5 text-item-accent" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm line-clamp-2">
                                {item.stem}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1">
                                <Dna className="size-3 text-trait-accent" />
                                <span className="text-xs text-muted-foreground">
                                  {item.constructName || "No construct"}
                                </span>
                              </div>
                            </div>
                            <Plus className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                          </button>
                        ))
                      )}
                      {availableItems.length > 50 && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          Showing 50 of {availableItems.length} items. Refine your search.
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* ── Settings tab ── */}
          <TabsContent value="settings" keepMounted>
            <Card>
              <CardHeader>
                <CardTitle>Settings</CardTitle>
                <CardDescription>
                  Status and lifecycle management.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SettingsTab
                  entityName="Block"
                  isActive={isActive}
                  onActiveChange={() => {}}
                  onDelete={blockId ? handleDelete : undefined}
                  deleting={deleting}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 py-4 mt-6 bg-background/80 backdrop-blur-sm -mx-4 px-4 border-t border-border/50">
          <Link href="/forced-choice-blocks">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={!name.trim() || !hasMinimumItems || pending}
          >
            {saveButtonLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
