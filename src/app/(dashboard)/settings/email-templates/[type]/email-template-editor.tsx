"use client"

import { useCallback, useRef, useState } from "react"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import { Send, Code, Eye } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { upsertEmailTemplate, sendTestEmail } from "@/app/actions/email-templates"
import {
  MERGE_VARIABLES,
  type EmailType,
  type EmailTemplateScope,
} from "@/lib/email/types"

const MailyVisualEditor = dynamic(
  () => import("./maily-visual-editor").then((mod) => mod.MailyVisualEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-64 items-center justify-center rounded-lg border border-input bg-background text-sm text-muted-foreground">
        Loading visual editor...
      </div>
    ),
  },
)

// Maily re-exports its own Editor type which differs from @tiptap/core's.
// We use a minimal interface that covers what we need from callbacks.
type TiptapEditorInstance = {
  getJSON(): Record<string, unknown>
  commands: { setContent(content: Record<string, unknown>): boolean }
}

type SaveState = "idle" | "saving" | "saved"
type EditorMode = "visual" | "json"

interface EmailTemplateEditorProps {
  type: EmailType
  scopeType: EmailTemplateScope
  scopeId: string | null
  initialSubject: string
  initialPreviewText: string
  initialEditorJson: Record<string, unknown> | null
}

export function EmailTemplateEditor({
  type,
  scopeType,
  scopeId,
  initialSubject,
  initialPreviewText,
  initialEditorJson,
}: EmailTemplateEditorProps) {
  const [subject, setSubject] = useState(initialSubject)
  const [previewText, setPreviewText] = useState(initialPreviewText)
  const [editorJson, setEditorJson] = useState<Record<string, unknown>>(
    initialEditorJson ?? { type: "doc", content: [] }
  )
  const [jsonStr, setJsonStr] = useState(
    initialEditorJson ? JSON.stringify(initialEditorJson, null, 2) : "{}"
  )
  const [editorMode, setEditorMode] = useState<EditorMode>("visual")
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const tiptapRef = useRef<TiptapEditorInstance | null>(null)

  const [savedSnapshot, setSavedSnapshot] = useState({
    subject: initialSubject,
    previewText: initialPreviewText,
    editorJson: JSON.stringify(initialEditorJson ?? {}),
  })

  const currentJsonStr = editorMode === "visual"
    ? JSON.stringify(editorJson)
    : (() => { try { return JSON.stringify(JSON.parse(jsonStr)) } catch { return jsonStr } })()

  const isDirty =
    subject !== savedSnapshot.subject ||
    previewText !== savedSnapshot.previewText ||
    currentJsonStr !== savedSnapshot.editorJson

  const { showDialog, confirmNavigation, cancelNavigation } =
    useUnsavedChanges(isDirty)

  const mergeVars = MERGE_VARIABLES[type]

  const handleEditorUpdate = useCallback((editor: TiptapEditorInstance) => {
    tiptapRef.current = editor
    const json = editor.getJSON()
    setEditorJson(json)
  }, [])

  const handleEditorCreate = useCallback((editor: TiptapEditorInstance) => {
    tiptapRef.current = editor
  }, [])

  const switchToJson = useCallback(() => {
    setJsonStr(JSON.stringify(editorJson, null, 2))
    setEditorMode("json")
  }, [editorJson])

  const switchToVisual = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonStr)
      setEditorJson(parsed)
      if (tiptapRef.current) {
        tiptapRef.current.commands.setContent(parsed)
      }
      setEditorMode("visual")
    } catch {
      toast.error("Invalid JSON — fix it before switching to visual mode")
    }
  }, [jsonStr])

  const handleSave = useCallback(async () => {
    setError(null)
    clearTimeout(savedTimerRef.current)

    let parsedJson: Record<string, unknown>
    if (editorMode === "visual") {
      parsedJson = editorJson as Record<string, unknown>
    } else {
      try {
        parsedJson = JSON.parse(jsonStr)
      } catch {
        setError("Invalid JSON in editor content")
        toast.error("Invalid JSON in editor content")
        return
      }
    }

    setSaveState("saving")

    const result = await upsertEmailTemplate({
      type,
      scopeType,
      scopeId,
      subject: subject.trim(),
      previewText: previewText.trim() || null,
      editorJson: parsedJson,
    })

    if (result && "error" in result && result.error) {
      const errors = result.error as Record<string, string[]>
      const msg =
        "_form" in errors
          ? errors._form?.[0]
          : Object.values(errors).flat().join(", ")
      setError(msg ?? "Validation failed")
      toast.error(msg ?? "Failed to save template")
      setSaveState("idle")
      return
    }

    toast.success("Template saved")
    setSaveState("saved")
    setSavedSnapshot({
      subject,
      previewText,
      editorJson: JSON.stringify(parsedJson),
    })
    savedTimerRef.current = setTimeout(() => setSaveState("idle"), 2000)
  }, [type, scopeType, scopeId, subject, previewText, editorJson, jsonStr, editorMode])

  const handleSendTest = useCallback(async () => {
    setSending(true)
    try {
      await sendTestEmail(type, scopeType, scopeId)
      toast.success("Test email sent — check your inbox")
    } catch {
      toast.error("Failed to send test email")
    } finally {
      setSending(false)
    }
  }, [type, scopeType, scopeId])

  const saveLabel =
    saveState === "saving"
      ? "Saving..."
      : saveState === "saved"
        ? "Saved"
        : "Save Changes"

  return (
    <div className="space-y-6 max-w-4xl">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Email Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject Line</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="previewText">Preview Text</Label>
            <Input
              id="previewText"
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              placeholder="Brief preview shown in inbox..."
            />
            <p className="text-xs text-muted-foreground">
              Shown after the subject in most email clients.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Merge Variables</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Available variables for this template. Use the variable button (/) in the editor to insert them.
          </p>
          <div className="flex flex-wrap gap-2">
            {mergeVars.map((v) => (
              <Badge key={v} variant="secondary" className="font-mono text-xs">
                {`{{${v}}}`}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Template Content</CardTitle>
            <div className="flex gap-1">
              <Button
                variant={editorMode === "visual" ? "default" : "ghost"}
                size="sm"
                onClick={editorMode === "json" ? switchToVisual : undefined}
              >
                <Eye className="size-3.5" />
                Visual
              </Button>
              <Button
                variant={editorMode === "json" ? "default" : "ghost"}
                size="sm"
                onClick={editorMode === "visual" ? switchToJson : undefined}
              >
                <Code className="size-3.5" />
                JSON
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {editorMode === "visual" ? (
            <div className="rounded-lg border border-input bg-background min-h-64 [&_.maily-editor]:min-h-64">
              <MailyVisualEditor
                contentJson={editorJson}
                onUpdate={handleEditorUpdate}
                onCreate={handleEditorCreate}
              />
            </div>
          ) : (
            <Textarea
              value={jsonStr}
              onChange={(e) => setJsonStr(e.target.value)}
              className="min-h-64 font-mono text-xs"
              placeholder='{"type": "doc", "content": [...]}'
            />
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={handleSendTest}
          disabled={sending}
        >
          <Send className="size-4" />
          {sending ? "Sending..." : "Send Test Email"}
        </Button>

        <Button
          onClick={handleSave}
          disabled={!subject.trim() || saveState === "saving" || saveState === "saved"}
        >
          {saveLabel}
        </Button>
      </div>

      <ConfirmDialog
        open={showDialog}
        onOpenChange={(open) => {
          if (!open) cancelNavigation()
        }}
        title="Unsaved changes"
        description="You have unsaved changes. Are you sure you want to leave? Your changes will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="destructive"
        onConfirm={confirmNavigation}
      />
    </div>
  )
}
