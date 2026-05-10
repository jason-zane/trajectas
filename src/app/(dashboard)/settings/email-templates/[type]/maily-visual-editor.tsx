"use client"

import "@maily-to/core/style.css"

import { Editor } from "@maily-to/core"
import {
  text,
  heading1,
  heading2,
  heading3,
  button as buttonBlock,
  spacer,
  divider,
  image,
  columns,
} from "@maily-to/core/blocks"
import type { JSONContent } from "@tiptap/core"

type TiptapEditorInstance = {
  getJSON(): Record<string, unknown>
  commands: { setContent(content: Record<string, unknown>): boolean }
}

const EDITOR_BLOCKS = [
  {
    title: "Content",
    commands: [text, heading1, heading2, heading3, buttonBlock, image],
  },
  {
    title: "Layout",
    commands: [spacer, divider, columns],
  },
]

interface MailyVisualEditorProps {
  contentJson: Record<string, unknown>
  onUpdate: (editor: TiptapEditorInstance) => void
  onCreate: (editor: TiptapEditorInstance) => void
}

export function MailyVisualEditor({
  contentJson,
  onUpdate,
  onCreate,
}: MailyVisualEditorProps) {
  return (
    <Editor
      contentJson={contentJson as JSONContent}
      onUpdate={(editor) => onUpdate(editor as TiptapEditorInstance)}
      onCreate={(editor) => onCreate(editor as TiptapEditorInstance)}
      blocks={EDITOR_BLOCKS}
      config={{
        hasMenuBar: true,
        spellCheck: true,
      }}
    />
  )
}
