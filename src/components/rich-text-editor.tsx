'use client'

import dynamic from 'next/dynamic'

export interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  onBlur?: () => void
  placeholder?: string
}

const RichTextEditorImpl = dynamic<RichTextEditorProps>(
  () => import('./rich-text-editor-impl').then((mod) => mod.RichTextEditorImpl),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[168px] rounded-lg border border-border bg-background">
        <div className="flex h-10 items-center gap-1 border-b border-border bg-muted/50 px-2">
          {Array.from({ length: 7 }).map((_, index) => (
            <div
              key={index}
              className="size-7 animate-shimmer rounded-md bg-muted"
            />
          ))}
        </div>
        <div className="space-y-2 p-3">
          <div className="h-4 w-3/4 animate-shimmer rounded bg-muted" />
          <div className="h-4 w-1/2 animate-shimmer rounded bg-muted" />
        </div>
      </div>
    ),
  },
)

export function RichTextEditor(props: RichTextEditorProps) {
  return <RichTextEditorImpl {...props} />
}
