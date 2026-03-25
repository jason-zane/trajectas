"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, X, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createItem, updateItem, deleteItem } from "@/app/actions/items";
import type { SelectOption } from "@/app/actions/items";
import type { ResponseFormat, ActiveResponseFormatType } from "@/types/database";

interface OptionEntry {
  label: string;
  value: number;
  displayOrder: number;
}

interface RubricEntry {
  optionIndex: number;
  rubricLabel: "best" | "good" | "neutral" | "poor";
  scoreValue: number;
  explanation?: string;
}

const RUBRIC_SCORES: Record<string, number> = {
  best: 4,
  good: 3,
  neutral: 2,
  poor: 1,
};

interface ItemFormProps {
  constructs: SelectOption[];
  factors: SelectOption[];
  responseFormats: ResponseFormat[];
  mode: "create" | "edit";
  itemId?: string;
  returnTo?: string;
  initialData?: {
    traitId: string;
    competencyId?: string;
    responseFormatId: string;
    stem: string;
    reverseScored: boolean;
    status: string;
    displayOrder: number;
    options: OptionEntry[];
    rubrics?: RubricEntry[];
  };
}

export function ItemForm({
  constructs,
  factors,
  responseFormats,
  mode,
  itemId,
  returnTo,
  initialData,
}: ItemFormProps) {
  const [traitId, setTraitId] = useState(initialData?.traitId ?? "");
  const [competencyId, setCompetencyId] = useState(
    initialData?.competencyId ?? ""
  );
  const [responseFormatId, setResponseFormatId] = useState(
    initialData?.responseFormatId ?? ""
  );
  const [stem, setStem] = useState(initialData?.stem ?? "");
  const [reverseScored, setReverseScored] = useState(
    initialData?.reverseScored ?? false
  );
  const [status, setStatus] = useState(initialData?.status ?? "draft");
  const [options, setOptions] = useState<OptionEntry[]>(
    initialData?.options ?? []
  );
  const [rubrics, setRubrics] = useState<RubricEntry[]>(
    initialData?.rubrics ?? []
  );
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedFormat = useMemo(() => {
    if (!responseFormatId) return null;
    return responseFormats.find((rf) => rf.id === responseFormatId) ?? null;
  }, [responseFormatId, responseFormats]);

  const formatType = selectedFormat?.type as ActiveResponseFormatType | undefined;

  const showOptions = formatType === "likert";
  const showReverseScored = formatType === "likert" || formatType === "binary";
  const showSjt = formatType === "sjt";
  const isBinary = formatType === "binary";
  const isFreeText = formatType === "free_text";
  const isForcedChoice = formatType === "forced_choice";

  const addOption = useCallback(() => {
    setOptions((prev) => [
      ...prev,
      { label: "", value: prev.length + 1, displayOrder: prev.length + 1 },
    ]);
  }, []);

  const removeOption = useCallback((index: number) => {
    setOptions((prev) => prev.filter((_, i) => i !== index));
    setRubrics((prev) =>
      prev
        .filter((r) => r.optionIndex !== index)
        .map((r) => ({
          ...r,
          optionIndex: r.optionIndex > index ? r.optionIndex - 1 : r.optionIndex,
        }))
    );
  }, []);

  const updateOption = useCallback(
    (index: number, field: keyof OptionEntry, value: string | number) => {
      setOptions((prev) =>
        prev.map((o, i) => (i === index ? { ...o, [field]: value } : o))
      );
    },
    []
  );

  const generateLikert5 = useCallback(() => {
    setOptions([
      { label: "Strongly Disagree", value: 1, displayOrder: 1 },
      { label: "Disagree", value: 2, displayOrder: 2 },
      { label: "Neutral", value: 3, displayOrder: 3 },
      { label: "Agree", value: 4, displayOrder: 4 },
      { label: "Strongly Agree", value: 5, displayOrder: 5 },
    ]);
  }, []);

  const generateBinaryOptions = useCallback(() => {
    setOptions([
      { label: "Yes", value: 1, displayOrder: 1 },
      { label: "No", value: 0, displayOrder: 2 },
    ]);
  }, []);

  const updateRubric = useCallback(
    (optionIndex: number, rubricLabel: "best" | "good" | "neutral" | "poor") => {
      setRubrics((prev) => {
        const existing = prev.findIndex((r) => r.optionIndex === optionIndex);
        const score = RUBRIC_SCORES[rubricLabel];
        if (existing >= 0) {
          return prev.map((r, i) =>
            i === existing ? { ...r, rubricLabel, scoreValue: score } : r
          );
        }
        return [...prev, { optionIndex, rubricLabel, scoreValue: score }];
      });
    },
    []
  );

  // Auto-generate options when selecting certain format types
  const handleFormatChange = useCallback(
    (newId: string | null) => {
      const id = newId ?? "";
      setResponseFormatId(id);
      const fmt = responseFormats.find((rf) => rf.id === id);
      if (fmt?.type === "binary" && options.length === 0) {
        generateBinaryOptions();
      }
      if (fmt?.type === "sjt" && options.length === 0) {
        setOptions([
          { label: "", value: 1, displayOrder: 1 },
          { label: "", value: 2, displayOrder: 2 },
          { label: "", value: 3, displayOrder: 3 },
          { label: "", value: 4, displayOrder: 4 },
        ]);
        setRubrics([]);
      }
    },
    [responseFormats, options.length, generateBinaryOptions]
  );

  async function handleSubmit(formData: FormData) {
    formData.set("options", JSON.stringify(options));
    formData.set("rubrics", JSON.stringify(rubrics));
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
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    await deleteItem(itemId);
  }

  const title = mode === "create" ? "Create Item" : "Edit Item";
  const backHref = returnTo ?? "/items";

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="size-3.5" />
          {returnTo ? "Back to Construct" : "Back to Items"}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          {mode === "create"
            ? "Create a new assessment item linked to a construct."
            : "Update this assessment item."}
        </p>
      </div>

      <Separator />

      <form action={handleSubmit}>
        {/* Item details */}
        <Card>
          <CardHeader>
            <CardTitle>Item Details</CardTitle>
            <CardDescription>
              The question stem and its classification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

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

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Construct</Label>
                <Select
                  name="traitId"
                  value={traitId}
                  onValueChange={(v) => setTraitId(v ?? "")}
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
              </div>

              <div className="space-y-2">
                <Label>Factor (optional)</Label>
                <Select
                  name="competencyId"
                  value={competencyId}
                  onValueChange={(v) => setCompetencyId(v ?? "")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select factor...">
                      {(value: string) =>
                        factors.find((f) => f.id === value)?.name ?? value
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {factors.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {competencyId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setCompetencyId("")}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Response Format</Label>
                <Select
                  name="responseFormatId"
                  value={responseFormatId}
                  onValueChange={handleFormatChange}
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

        {/* Type-specific sections */}

        {/* Likert options */}
        {formatType === "likert" && (
          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Response Options</CardTitle>
                  <CardDescription>
                    Define the Likert scale options for this item.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateLikert5}
                >
                  <Wand2 className="size-4" />
                  Generate 5-point
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Input
                    placeholder="Option label..."
                    value={opt.label}
                    onChange={(e) => updateOption(i, "label", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    placeholder="Value"
                    value={opt.value}
                    onChange={(e) =>
                      updateOption(i, "value", Number(e.target.value))
                    }
                    className="w-20"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeOption(i)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
              >
                <Plus className="size-4" />
                Add Option
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Binary options (read-only) */}
        {isBinary && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Response Options</CardTitle>
              <CardDescription>
                Binary items use fixed Yes/No options.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Input
                    value={opt.label}
                    className="flex-1"
                    disabled
                  />
                  <Input
                    type="number"
                    value={opt.value}
                    className="w-20"
                    disabled
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* SJT options with rubrics */}
        {showSjt && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>SJT Options & Rubrics</CardTitle>
              <CardDescription>
                Define 4 response options with scoring rubrics. Each option gets a quality label that determines its score.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {options.map((opt, i) => {
                const rubric = rubrics.find((r) => r.optionIndex === i);
                return (
                  <div key={i} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-muted-foreground w-6">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <Input
                        placeholder={`Option ${String.fromCharCode(65 + i)} text...`}
                        value={opt.label}
                        onChange={(e) => updateOption(i, "label", e.target.value)}
                        className="flex-1"
                      />
                    </div>
                    <div className="flex items-center gap-3 pl-9">
                      <Select
                        value={rubric?.rubricLabel ?? ""}
                        onValueChange={(v) =>
                          updateRubric(i, v as "best" | "good" | "neutral" | "poor")
                        }
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Rubric...">
                            {(value: string) => {
                              const labels: Record<string, string> = {
                                best: "Best",
                                good: "Good",
                                neutral: "Neutral",
                                poor: "Poor",
                              };
                              return labels[value] ?? value;
                            }}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="best">Best (4 pts)</SelectItem>
                          <SelectItem value="good">Good (3 pts)</SelectItem>
                          <SelectItem value="neutral">Neutral (2 pts)</SelectItem>
                          <SelectItem value="poor">Poor (1 pt)</SelectItem>
                        </SelectContent>
                      </Select>
                      {rubric && (
                        <span className="text-xs text-muted-foreground">
                          Score: {rubric.scoreValue}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Free text — no options */}
        {isFreeText && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Response Format</CardTitle>
              <CardDescription>
                Free text items capture an open-ended written response. No options are needed.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Forced choice — statement only */}
        {isForcedChoice && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Forced Choice</CardTitle>
              <CardDescription>
                Forced choice items are individual statements. After creating items, assign them to a forced choice block for grouped presentation.
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Actions */}
        <div
          className={`flex items-center ${mode === "edit" ? "justify-between" : "justify-end"} gap-3 mt-8 pb-8`}
        >
          {mode === "edit" && itemId && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="size-4" />
              {confirmDelete
                ? deleting
                  ? "Deleting..."
                  : "Confirm Delete"
                : "Delete"}
            </Button>
          )}
          <div className="flex items-center gap-3">
            <Link href={backHref}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={!stem.trim() || !traitId || !responseFormatId || pending}
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
        </div>
      </form>
    </div>
  );
}
