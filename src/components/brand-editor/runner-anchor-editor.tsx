"use client"

import { DerivedColorEditor } from "./derived-color-editor"
import type { DerivedColorField } from "./derived-color-editor"
import { deriveRunnerAnchors } from "@/lib/brand/runner-tokens"
import type { BrandConfig, RunnerAnchorOverrides } from "@/lib/brand/types"

type Anchor = keyof RunnerAnchorOverrides

const ANCHORS: readonly DerivedColorField<Anchor>[] = [
  {
    key: "ink",
    label: "Ink",
    description:
      "The dark brand surface. In dark mode this is the whole runner page; in light mode it fills buttons and selected answers.",
  },
  {
    key: "paper",
    label: "Paper",
    description:
      "The warm off-white. In dark mode this is body text and selected answers; in light mode it is the page base.",
  },
  {
    key: "accent",
    label: "Accent",
    description:
      "Wayfinding on dark surfaces — overlines, keycaps, progress, CTA fill.",
  },
  {
    key: "accentOnPaper",
    label: "Accent on paper",
    description:
      "The accent used on light surfaces. Derived by darkening the accent until it clears 4.5:1 on paper — pin it only if you can hold that yourself.",
  },
]

interface RunnerAnchorEditorProps {
  /** The fully resolved config, including any pins already applied. */
  config: BrandConfig
  value: RunnerAnchorOverrides | undefined
  onChange: (next: RunnerAnchorOverrides | undefined) => void
}

export function RunnerAnchorEditor({
  config,
  value,
  onChange,
}: RunnerAnchorEditorProps) {
  // Derive with the pins stripped, so the "Derived" state shows what the
  // pipeline would produce on its own rather than echoing the pin back.
  const derived = deriveRunnerAnchors({ ...config, runnerAnchors: undefined })
  const resolved = deriveRunnerAnchors(config)

  return (
    <DerivedColorEditor
      fields={ANCHORS}
      value={value}
      derived={derived}
      onChange={onChange}
      swatchBackdrop={resolved.ink}
    />
  )
}
