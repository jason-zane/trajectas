'use client'

import { useEffect, useRef, useState } from 'react'
import { parseModelText } from '@/lib/instrument/model-parser'
import type { ProposedConstruct } from '@/lib/instrument/structure'
import type { ParsedModel } from '@/lib/instrument/model-parser'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface ModelInputProps {
  value: string
  onChange: (raw: string) => void
  onAccept: (constructs: ProposedConstruct[]) => void
  disabled?: boolean
  className?: string
}

export function ModelInput({
  value,
  onChange,
  onAccept,
  disabled = false,
  className = '',
}: ModelInputProps) {
  const [parsed, setParsed] = useState<ParsedModel>({
    constructs: [],
    format: 'none',
    warnings: [],
    unparsedLines: [],
  })
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Live parse as user types, debounced ~250ms
  useEffect(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }

    debounceTimeoutRef.current = setTimeout(() => {
      const result = parseModelText(value)
      setParsed(result)
    }, 250)

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current)
      }
    }
  }, [value])

  const humanizeFormat = (format: string): string => {
    const formatMap: Record<string, string> = {
      json: 'JSON',
      yaml: 'YAML',
      'markdown-list': 'Markdown list',
      delimited: 'Delimited',
      none: 'Unknown',
    }
    return formatMap[format] || format
  }

  const hasConstructs = parsed.constructs.length > 0

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Textarea */}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={
          'Adaptability: Adjusts approach when conditions change.\n' +
          'Communication: Expresses ideas clearly and listens actively.'
        }
        className="font-mono text-xs min-h-48"
      />

      {/* Preview strip */}
      {hasConstructs && (
        <div className="space-y-3">
          {/* Summary line */}
          <div className="text-xs text-muted-foreground">
            {parsed.constructs.length} construct{parsed.constructs.length !== 1 ? 's' : ''} read · {humanizeFormat(parsed.format)}
          </div>

          {/* Construct name badges */}
          <div className="flex flex-wrap gap-2">
            {parsed.constructs.map((construct, idx) => (
              <Badge key={idx} variant="default">
                {construct.name}
              </Badge>
            ))}
          </div>

          {/* Warnings */}
          {parsed.warnings.length > 0 && (
            <Alert variant="warning">
              <AlertDescription>
                <ul className="space-y-1 text-xs">
                  {parsed.warnings.map((warning, idx) => (
                    <li key={idx} className="list-disc list-inside">
                      {warning}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Unparsed lines (collapsed) */}
          {parsed.unparsedLines.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                {parsed.unparsedLines.length} line{parsed.unparsedLines.length !== 1 ? 's' : ''} not recognized
              </summary>
              <div className="mt-2 p-2 bg-muted/50 rounded border border-border/50 max-h-40 overflow-y-auto">
                <pre className="text-xs whitespace-pre-wrap break-words text-muted-foreground">
                  {parsed.unparsedLines.slice(0, 5).join('\n')}
                  {parsed.unparsedLines.length > 5 && `\n... and ${parsed.unparsedLines.length - 5} more`}
                </pre>
              </div>
            </details>
          )}
        </div>
      )}

      {/* Format not recognized info alert */}
      {value.trim() !== '' && parsed.format === 'none' && (
        <Alert variant="info">
          <AlertDescription className="text-xs space-y-1">
            <div>Format not recognized. Try one of these:</div>
            <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
              <li><span className="font-mono">JSON</span>: object with constructs array</li>
              <li><span className="font-mono">YAML</span>: - name: ... definition: ...</li>
              <li><span className="font-mono">Markdown</span>: 1. Name or ## Header</li>
              <li><span className="font-mono">Delimited</span>: Name: definition or Name — definition</li>
            </ul>
            <div className="pt-1">Or leave blank and have AI propose the model instead.</div>
          </AlertDescription>
        </Alert>
      )}

      {/* Accept button */}
      <Button
        onClick={() => onAccept(parsed.constructs)}
        disabled={disabled || parsed.constructs.length === 0}
        className="w-full"
      >
        {/* The count is the useful part once there is one; "Use these 0 constructs"
            on an untouched box is just noise. */}
        {parsed.constructs.length === 0
          ? 'Use these constructs'
          : `Use these ${parsed.constructs.length} construct${parsed.constructs.length !== 1 ? 's' : ''}`}
      </Button>
    </div>
  )
}
