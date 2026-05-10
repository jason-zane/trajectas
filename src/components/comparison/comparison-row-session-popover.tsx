'use client'
import { useEffect, useState } from 'react'
import { getSessionOptionsForRow, type SessionOption } from '@/app/actions/comparison'

export function ComparisonRowSessionPopover({
  campaignParticipantId,
  assessmentIds,
  open,
  onClose,
  onPick,
}: {
  campaignParticipantId: string
  assessmentIds: string[]
  open: boolean
  onClose: () => void
  onPick: (assessmentId: string, sessionId: string) => void
}) {
  const [options, setOptions] = useState<SessionOption[] | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    getSessionOptionsForRow(campaignParticipantId, assessmentIds).then((opts) => {
      if (!cancelled) setOptions(opts)
    })
    return () => {
      cancelled = true
    }
  }, [open, campaignParticipantId, assessmentIds])

  const loading = options === null

  if (!open) return null
  return (
    <>
      <div
        className="fixed inset-0 z-20"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label="Pick a session for this row"
        className="absolute z-30 mt-1 w-72 rounded-md border border-border bg-card p-2 shadow-lg"
      >
        {loading && <div className="text-xs opacity-70 p-2">Loading sessions…</div>}
        {!loading && options.length === 0 && (
          <div className="text-xs opacity-70 p-2">No sessions found.</div>
        )}
        <ul className="max-h-72 overflow-auto text-xs">
          {(options ?? []).map((o) => (
            <li key={o.sessionId}>
              <button
                type="button"
                className="w-full text-left rounded px-2 py-1.5 hover:bg-muted"
                onClick={() => {
                  onPick(o.assessmentId, o.sessionId)
                  onClose()
                }}
              >
                <div className="font-medium">
                  {o.assessmentName} · attempt {o.attemptNumber}
                </div>
                <div className="opacity-70">
                  {o.startedAt ? new Date(o.startedAt).toLocaleDateString() : '—'} · {o.status}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
