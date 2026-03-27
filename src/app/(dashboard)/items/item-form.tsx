"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { SettingsTab } from "@/app/(dashboard)/_shared/settings-tab";
import { createItem, updateItem, deleteItem } from "@/app/actions/items";
import type { SelectOption } from "@/app/actions/items";
import type { ResponseFormat, ActiveResponseFormatType } from "@/types/database";

interface ItemFormProps {
  constructs: SelectOption[];
  responseFormats: ResponseFormat[];
  mode: "create" | "edit";
  itemId?: string;
  returnTo?: string;
  initialData?: {
    constructId: string;
    responseFormatId: string;
    stem: string;
    reverseScored: boolean;
    status: string;
    displayOrder: number;
  };
}

export function ItemForm({
  constructs,
  responseFormats,
  mode,
  itemId,
  returnTo,
  initialData,
}: ItemFormProps) {
  const [constructId, setConstructId] = useState(initialData?.constructId ?? "");
  const [responseFormatId, setResponseFormatId] = useState(
    initialData?.responseFormatId ?? ""
  );
  const [stem, setStem] = useState(initialData?.stem ?? "");
  const [reverseScored, setReverseScored] = useState(
    initialData?.reverseScored ?? false
  );
  const [status, setStatus] = useState(initialData?.status ?? "draft");
  const [isActive] = useState(initialData?.status !== "archived");
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedFormat = useMemo(() => {
    if (!responseFormatId) return null;
    return responseFormats.find((rf) => rf.id === responseFormatId) ?? null;
  }, [responseFormatId, responseFormats]);

  const formatType = selectedFormat?.type as ActiveResponseFormatType | undefined;
  const showReverseScored = formatType === "likert" || formatType === "binary";

  async function handleSubmit(formData: FormData) {
    if (returnTo) {
      formData.set("returnTo", returnTo);
    }

    setPending(true);
    setError(null);

    const result =
      mode === "edit" && itemId
        ? await updateItem(itemId, formData)
        : await createItem(formData);

    if (result?.error) {
      const errors = result.error;
      const msg =
        typeof errors === "object" && "_form" in errors
          ? (errors as Record<string, string[]>)._form?.[0]
          : Object.values(errors).flat().join(", ");
      setError(msg ?? "Validation failed");
      setPending(false);
    }
  }

  async function handleDelete() {
    if (!itemId) return;
    setDeleting(true);
    await deleteItem(itemId);
  }

  const title = mode === "create" ? "Create Item" : "Edit Item";
  const subtitle =
    mode === "create"
      ? "Create a new assessment item linked to a construct."
      : "Update this assessment item.";
  const backHref = returnTo ?? "/items";

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
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="details" keepMounted>
            <Card className="border-l-[3px] border-l-item-accent">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileQuestion className="size-4 text-item-accent" />
                  <div>
                    <CardTitle>Item Details</CardTitle>
                    <CardDescription>
                      The question stem and its classification.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="stem">Stem</Label>
                  <Textarea
                    id="stem"
                    name="stem"
                    placeholder="Enter the question or stimulus text..."
                    value={stem}
                    onChange={(e) => setStem(e.target.value)}
                    className="min-h-24"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Construct</Label>
                  <Select
                    name="constructId"
                    value={constructId}
                    onValueChange={(v) => setConstructId(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select construct...">
                        {(value: string) =>
                          constructs.find((c) => c.id === value)?.name ?? value
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {constructs.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    The construct this item measures.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Response Format</Label>
                    <Select
                      name="responseFormatId"
                      value={responseFormatId}
                      onValueChange={(v) => setResponseFormatId(v ?? "")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select format...">
                          {(value: string) =>
                            responseFormats.find((rf) => rf.id === value)?.name ?? value
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {responseFormats.map((rf) => (
                          <SelectItem key={rf.id} value={rf.id}>
                            {rf.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Defines how candidates respond to this item.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      name="status"
                      value={status}
                      onValueChange={(v) => setStatus(v ?? "draft")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {showReverseScored && (
                  <div className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label htmlFor="reverse-scored">Reverse scored</Label>
                      <p className="text-xs text-muted-foreground">
                        Scoring direction is inverted for this item.
                      </p>
                    </div>
                    <Switch
                      id="reverse-scored"
                      checked={reverseScored}
                      onCheckedChange={setReverseScored}
                    />
                  </div>
                )}
                <input
                  type="hidden"
                  name="reverseScored"
                  value={reverseScored ? "true" : "false"}
                />
                <input type="hidden" name="displayOrder" value="0" />
              </CardContent>
            </Card>
          </TabsContent>

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
                  entityName="Item"
                  isActive={isActive}
                  onActiveChange={() => {}}
                  onDelete={itemId ? handleDelete : undefined}
                  deleting={deleting}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Sticky action bar */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 py-4 mt-6 bg-background/80 backdrop-blur-sm -mx-4 px-4 border-t border-border/50">
          <Link href={backHref}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={!stem.trim() || !constructId || !responseFormatId || pending}
          >
            {pending
              ? mode === "create"
                ? "Creating..."
                : "Saving..."
              : mode === "create"
                ? "Create Item"
                : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
