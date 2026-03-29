"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Dna, Settings2, ArrowLeftRight, Weight, Shield, AlertTriangle, Eye, BarChart3, ListOrdered, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AutoSaveIndicator } from "@/components/auto-save-indicator";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import {
  createItem,
  updateItem,
  deleteItem,
  restoreItem,
  updateItemField,
} from "@/app/actions/items";
import type { SelectOption } from "@/app/actions/items";
import type { ResponseFormat, ActiveResponseFormatType, ItemPurpose } from "@/types/database";

type SaveButtonState = "idle" | "saving" | "saved";

interface ItemFormProps {
  constructs: SelectOption[];
  responseFormats: ResponseFormat[];
  mode: "create" | "edit";
  itemId?: string;
  returnTo?: string;
  irtParameters?: {
    modelType: string;
    discrimination: number;
    difficulty: number;
    guessing: number;
    calibrationDate: string;
    sampleSize: number;
  } | null;
  initialOptions?: { label: string; value: number }[];
  initialData?: {
    purpose: ItemPurpose;
    constructId?: string;
    responseFormatId: string;
    stem: string;
    reverseScored: boolean;
    weight: number;
    status: string;
    displayOrder: number;
    keyedAnswer?: number;
  };
}

export function ItemForm({
  constructs,
  responseFormats,
  mode,
  itemId,
  returnTo,
  irtParameters,
  initialOptions,
  initialData,
}: ItemFormProps) {
  const router = useRouter();

  const [purpose, setPurpose] = useState<ItemPurpose>(initialData?.purpose ?? "construct");
  const [constructId, setConstructId] = useState(initialData?.constructId ?? "");
  const [responseFormatId, setResponseFormatId] = useState(
    initialData?.responseFormatId ?? ""
  );
  const [stem, setStem] = useState(initialData?.stem ?? "");
  const [reverseScored, setReverseScored] = useState(
    initialData?.reverseScored ?? false
  );
  const [weight, setWeight] = useState(initialData?.weight ?? 1.0);
  const [keyedAnswer, setKeyedAnswer] = useState<string>(
    initialData?.keyedAnswer != null ? String(initialData.keyedAnswer) : ""
  );
  const [status, setStatus] = useState(initialData?.status ?? "draft");
  const [options, setOptions] = useState<{ label: string; value: number }[]>(
    initialOptions ?? []
  );
  const isConstructItem = purpose === "construct";

  // Auto-populate options from Likert format anchors when format changes
  const handleFormatChange = useCallback((formatId: string) => {
    setResponseFormatId(formatId);
    const fmt = responseFormats.find((rf) => rf.id === formatId);
    if (fmt?.type === "likert" && fmt.config && typeof fmt.config === "object") {
      const anchors = (fmt.config as Record<string, unknown>).anchors as Record<string, string> | undefined;
      if (anchors) {
        const newOptions = Object.entries(anchors)
          .map(([val, label]) => ({ label, value: Number(val) }))
          .sort((a, b) => a.value - b.value);
        setOptions(newOptions);
      }
    } else if (fmt?.type === "binary" && fmt.config && typeof fmt.config === "object") {
      const labels = (fmt.config as Record<string, unknown>).labels as Record<string, string> | undefined;
      if (labels) {
        setOptions(Object.entries(labels).map(([val, label]) => ({ label, value: Number(val) })));
      } else {
        setOptions([{ label: "No", value: 0 }, { label: "Yes", value: 1 }]);
      }
    }
  }, [responseFormats]);
  const [isActive] = useState(initialData?.status !== "archived");
  const [saveState, setSaveState] = useState<SaveButtonState>("idle");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Auto-save for stem (edit mode only) ──
  const stemAutoSave = useAutoSave({
    initialValue: initialData?.stem ?? "",
    onSave: (val) => updateItemField(itemId!, "stem", val),
    enabled: mode === "edit" && !!itemId,
  });

  // ── Structural dirty tracking ──
  const structuralDirty = useMemo(() => {
    if (mode !== "edit" || !initialData) return false;
    return (
      purpose !== initialData.purpose ||
      constructId !== initialData.constructId ||
      responseFormatId !== initialData.responseFormatId ||
      reverseScored !== initialData.reverseScored ||
      weight !== initialData.weight ||
      status !== initialData.status
    );
  }, [mode, initialData, purpose, constructId, responseFormatId, reverseScored, weight, status]);

  const { showDialog, confirmNavigation, cancelNavigation } =
    useUnsavedChanges(structuralDirty);

  const selectedFormat = useMemo(() => {
    if (!responseFormatId) return null;
    return responseFormats.find((rf) => rf.id === responseFormatId) ?? null;
  }, [responseFormatId, responseFormats]);

  const formatType = selectedFormat?.type as ActiveResponseFormatType | undefined;
  const showReverseScored = isConstructItem && (formatType === "likert" || formatType === "binary");

  const purposeOptions: { value: ItemPurpose; label: string; icon: typeof Shield; description: string }[] = [
    { value: "construct", label: "Construct Item", icon: Dna, description: "Standard scoring item" },
    { value: "impression_management", label: "Impression Mgmt", icon: Shield, description: "Detects faking-good" },
    { value: "infrequency", label: "Infrequency", icon: AlertTriangle, description: "Bogus items" },
    { value: "attention_check", label: "Attention Check", icon: Eye, description: "Verifies reading" },
  ];

  // Group response formats by type for a cleaner selector
  const groupedFormats = useMemo(() => {
    const groups: Record<string, ResponseFormat[]> = {};
    for (const rf of responseFormats) {
      if (!groups[rf.type]) groups[rf.type] = [];
      groups[rf.type].push(rf);
    }
    return groups;
  }, [responseFormats]);

  // ── Save button state cycle: idle → saving → saved → idle ──
  const flashSaved = useCallback(() => {
    setSaveState("saved");
    const t = setTimeout(() => setSaveState("idle"), 2000);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(formData: FormData) {
    // In edit mode, sync the auto-saved stem value into the form data
    if (mode === "edit") {
      formData.set("stem", stemAutoSave.value);
    }

    if (returnTo) {
      formData.set("returnTo", returnTo);
    }

    setSaveState("saving");
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
      toast.error(msg ?? "Validation failed");
      setSaveState("idle");
      return;
    }

    // Success
    if (mode === "create" && result && "id" in result) {
      toast.success("Item created");
      router.replace(`/items/${result.id}/edit`);
    } else {
      toast.success("Item saved");
      flashSaved();
    }
  }

  async function handleDelete() {
    if (!itemId) return;
    setDeleting(true);

    const result = await deleteItem(itemId);
    if (result?.error) {
      toast.error(typeof result.error === "string" ? result.error : "Failed to delete");
      setDeleting(false);
      return;
    }

    const deletedId = itemId;
    toast.success("Item deleted", {
      action: {
        label: "Undo",
        onClick: async () => {
          await restoreItem(deletedId);
          toast.success("Item restored");
        },
      },
    });

    router.push(returnTo ?? "/items");
  }

  const title = mode === "create" ? "Create Item" : "Edit Item";
  const subtitle =
    mode === "create"
      ? "Create a new assessment item linked to a construct."
      : "Update this assessment item.";
  const backHref = returnTo ?? "/items";

  // Determine the effective stem value for validation / create mode
  const effectiveStem = mode === "edit" ? stemAutoSave.value : stem;

  // Save button label
  const saveButtonLabel = (() => {
    if (saveState === "saving") {
      return mode === "create" ? "Creating..." : "Saving...";
    }
    if (saveState === "saved") {
      return "Saved";
    }
    return mode === "create" ? "Create Item" : "Save Changes";
  })();

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
            {formatType !== "free_text" && (
              <TabsTrigger value="options">
                Options
                {options.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                    {options.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {isConstructItem && (
              <TabsTrigger value="classification">
                Classification
                {constructId && (
                  <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                    1
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {mode === "edit" && (
              <TabsTrigger value="irt">
                IRT
                {irtParameters && (
                  <Badge variant="secondary" className="ml-1.5 text-xs px-1.5 py-0">
                    {irtParameters.modelType}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* ── Details tab ── */}
          <TabsContent value="details" keepMounted>
            <div className="space-y-6">
              {/* Validity banner for non-construct items */}
              {!isConstructItem && (
                <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  {purpose === "impression_management" && <Shield className="size-4 text-amber-600 shrink-0" />}
                  {purpose === "infrequency" && <AlertTriangle className="size-4 text-amber-600 shrink-0" />}
                  {purpose === "attention_check" && <Eye className="size-4 text-amber-600 shrink-0" />}
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
                      {purposeOptions.find((p) => p.value === purpose)?.label} Item
                    </p>
                    <p className="text-xs text-muted-foreground">
                      This item will not be scored against any construct. It is used for response validity detection only.
                    </p>
                  </div>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Question Stem</CardTitle>
                  <CardDescription>
                    The statement or question presented to the participant.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {mode === "edit" ? (
                    <>
                      <Textarea
                        id="stem"
                        name="stem"
                        placeholder="e.g. I find it easy to see situations from other people's perspectives, even when I disagree with them."
                        value={stemAutoSave.value}
                        onChange={stemAutoSave.handleChange}
                        onBlur={stemAutoSave.handleBlur}
                        className="min-h-20 resize-y"
                        required
                      />
                      <AutoSaveIndicator
                        status={stemAutoSave.status}
                        onRetry={stemAutoSave.retry}
                      />
                    </>
                  ) : (
                    <Textarea
                      id="stem"
                      name="stem"
                      placeholder="e.g. I find it easy to see situations from other people's perspectives, even when I disagree with them."
                      value={stem}
                      onChange={(e) => setStem(e.target.value)}
                      className="min-h-20 resize-y"
                      required
                    />
                  )}
                </CardContent>
              </Card>

              <Card className="border-l-[3px] border-l-item-accent">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Settings2 className="size-4 text-item-accent" />
                    <div>
                      <CardTitle>Response Configuration</CardTitle>
                      <CardDescription>
                        How participants interact with this item.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Item Purpose</Label>
                    <Select
                      name="purpose"
                      value={purpose}
                      onValueChange={(v) => {
                        const val = v as ItemPurpose;
                        setPurpose(val);
                        if (val !== "construct") {
                          setConstructId("");
                          setReverseScored(false);
                          setWeight(1.0);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {purposeOptions.map(({ value, label, icon: Icon }) => (
                          <SelectItem key={value} value={value}>
                            <span className="flex items-center gap-2">
                              <Icon className="size-3.5 text-muted-foreground" />
                              {label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Whether this item scores a construct or serves a validity function.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Response Format</Label>
                    <Select
                      name="responseFormatId"
                      value={responseFormatId}
                      onValueChange={(v) => handleFormatChange(v ?? "")}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a response format...">
                          {(value: string) =>
                            responseFormats.find((rf) => rf.id === value)?.name ?? value
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(groupedFormats).map(([type, formats]) => (
                          <div key={type}>
                            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              {type.replace(/_/g, " ")}
                            </div>
                            {formats.map((rf) => (
                              <SelectItem key={rf.id} value={rf.id}>
                                {rf.name}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Determines the answer format and scoring approach.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      name="status"
                      value={status}
                      onValueChange={(v) => setStatus(v ?? "draft")}
                    >
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {isConstructItem && showReverseScored && (
                    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                          <ArrowLeftRight className="size-4 text-amber-600" />
                        </div>
                        <div className="space-y-0.5">
                          <Label htmlFor="reverse-scored">Reverse Scored</Label>
                          <p className="text-xs text-muted-foreground">
                            Invert scoring direction — high responses map to low scores.
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="reverse-scored"
                        checked={reverseScored}
                        onCheckedChange={setReverseScored}
                      />
                    </div>
                  )}

                  {isConstructItem && (
                    <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Weight className="size-4 text-primary" />
                        </div>
                        <div className="space-y-0.5">
                          <Label htmlFor="weight">Scoring Weight</Label>
                          <p className="text-xs text-muted-foreground">
                            How much this item contributes to its construct score. Default 1.0 — increase for higher-quality items.
                          </p>
                        </div>
                      </div>
                      <input
                        id="weight"
                        name="weight"
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={weight}
                        onChange={(e) => setWeight(Number(e.target.value) || 1.0)}
                        className="w-20 rounded-md border bg-background px-3 py-1.5 text-sm tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  )}

                  {purpose === "attention_check" && (
                    <div className="flex items-center justify-between gap-4 rounded-lg border border-blue-500/30 p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                          <Eye className="size-4 text-blue-600" />
                        </div>
                        <div className="space-y-0.5">
                          <Label htmlFor="keyed-answer">Keyed Answer</Label>
                          <p className="text-xs text-muted-foreground">
                            The expected numeric response value (e.g. 4 for &quot;Agree&quot; on a 5-point scale).
                          </p>
                        </div>
                      </div>
                      <input
                        id="keyed-answer"
                        name="keyedAnswer"
                        type="number"
                        step="1"
                        value={keyedAnswer}
                        onChange={(e) => setKeyedAnswer(e.target.value)}
                        className="w-20 rounded-md border bg-background px-3 py-1.5 text-sm tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-ring"
                        required
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            <input
              type="hidden"
              name="reverseScored"
              value={reverseScored ? "true" : "false"}
            />
            <input type="hidden" name="displayOrder" value="0" />
            <input type="hidden" name="options" value={JSON.stringify(options)} />
          </TabsContent>

          {/* ── Options tab ── */}
          {formatType !== "free_text" && (
            <TabsContent value="options" keepMounted>
              <Card className="border-l-[3px] border-l-item-accent">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ListOrdered className="size-4 text-item-accent" />
                      <div>
                        <CardTitle>Response Options</CardTitle>
                        <CardDescription>
                          {formatType === "likert" || formatType === "binary"
                            ? "Options are auto-populated from the response format. You can customise labels below."
                            : "Add the options that participants can choose from (min 2, max 10)."}
                        </CardDescription>
                      </div>
                    </div>
                    {formatType !== "likert" && formatType !== "binary" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setOptions((prev) => [
                            ...prev,
                            { label: "", value: prev.length + 1 },
                          ])
                        }
                        disabled={options.length >= 10}
                      >
                        <Plus className="size-4" />
                        Add Option
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {options.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center">
                      <ListOrdered className="size-8 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No options configured. Select a response format to auto-populate, or add options manually.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {options.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground tabular-nums w-6 text-right">
                            {idx + 1}.
                          </span>
                          <input
                            type="text"
                            value={opt.label}
                            onChange={(e) => {
                              const updated = [...options];
                              updated[idx] = { ...updated[idx], label: e.target.value };
                              setOptions(updated);
                            }}
                            placeholder="Option label"
                            className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          <input
                            type="number"
                            value={opt.value}
                            onChange={(e) => {
                              const updated = [...options];
                              updated[idx] = { ...updated[idx], value: Number(e.target.value) };
                              setOptions(updated);
                            }}
                            className="w-20 rounded-md border bg-background px-3 py-1.5 text-sm tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-ring"
                          />
                          {formatType !== "likert" && formatType !== "binary" && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => setOptions((prev) => prev.filter((_, i) => i !== idx))}
                              disabled={options.length <= 2}
                            >
                              <Trash2 className="size-3.5 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* ── Classification tab (construct items only) ── */}
          {isConstructItem && <TabsContent value="classification" keepMounted>
            <Card className="border-l-[3px] border-l-trait-accent">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Dna className="size-4 text-trait-accent" />
                  <div>
                    <CardTitle>Construct Assignment</CardTitle>
                    <CardDescription>
                      The psychological construct this item is designed to measure.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  name="constructId"
                  value={constructId}
                  onValueChange={(v) => setConstructId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a construct...">
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

                {constructId && (
                  <div className="rounded-lg bg-trait-bg/50 p-3">
                    <div className="flex items-center gap-2">
                      <div className="flex size-6 shrink-0 items-center justify-center rounded bg-trait-bg">
                        <Dna className="size-3 text-trait-accent" />
                      </div>
                      <span className="text-sm font-medium">
                        {constructs.find((c) => c.id === constructId)?.name}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground pl-8">
                      This item will contribute to the score for this construct.
                    </p>
                  </div>
                )}

                {!constructId && (
                  <div className="flex flex-col items-center py-6 text-center">
                    <Dna className="size-8 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      Select a construct to classify this item.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>}

          {/* ── IRT tab (edit mode only) ── */}
          {mode === "edit" && (
            <TabsContent value="irt" keepMounted>
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <BarChart3 className="size-4 text-primary" />
                    <div>
                      <CardTitle>IRT Parameters</CardTitle>
                      <CardDescription>
                        Item Response Theory calibration data from the most recent calibration run.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {irtParameters ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-caption">Model Type</p>
                          <Badge variant="secondary" className="text-xs">
                            {irtParameters.modelType}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <p className="text-caption">Sample Size</p>
                          <p className="text-sm font-medium tabular-nums">
                            {irtParameters.sampleSize.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">Discrimination (a)</p>
                            <p className="text-xs text-muted-foreground">
                              Higher values indicate more informative items.
                            </p>
                          </div>
                          <p className="text-sm font-semibold tabular-nums">
                            {irtParameters.discrimination.toFixed(3)}
                          </p>
                        </div>

                        <div className="border-t" />

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <p className="text-sm font-medium">Difficulty (b)</p>
                            <p className="text-xs text-muted-foreground">
                              Centred around 0 on the theta scale.
                            </p>
                          </div>
                          <p className="text-sm font-semibold tabular-nums">
                            {irtParameters.difficulty.toFixed(3)}
                          </p>
                        </div>

                        {irtParameters.modelType === "3PL" && (
                          <>
                            <div className="border-t" />
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium">Guessing (c)</p>
                                <p className="text-xs text-muted-foreground">
                                  Pseudo-guessing lower asymptote.
                                </p>
                              </div>
                              <p className="text-sm font-semibold tabular-nums">
                                {irtParameters.guessing.toFixed(3)}
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="text-caption">Calibration Date</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(irtParameters.calibrationDate).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center py-8 text-center">
                      <BarChart3 className="size-8 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        No calibration data — IRT parameters will appear here after a calibration run.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

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
            disabled={
              !effectiveStem.trim() ||
              (isConstructItem && !constructId) ||
              !responseFormatId ||
              (purpose === "attention_check" && !keyedAnswer) ||
              saveState === "saving"
            }
          >
            {saveButtonLabel}
          </Button>
        </div>
      </form>

      {/* Unsaved changes dialog */}
      <ConfirmDialog
        open={showDialog}
        onOpenChange={(open) => {
          if (!open) cancelNavigation();
        }}
        title="Unsaved changes"
        description="You have unsaved changes that will be lost if you leave this page."
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="destructive"
        onConfirm={confirmNavigation}
      />
    </div>
  );
}
