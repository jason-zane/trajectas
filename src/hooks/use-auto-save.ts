"use client"

import { useState, useCallback, useRef, useEffect } from "react"

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error"

interface UseAutoSaveOptions {
  /** Initial field value (from the database). */
  initialValue: string
  /** Server action that persists the value. Should return `{ error }` or `{ success }` or undefined. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSave: (value: string) => Promise<any>
  /** Debounce delay in ms (default 3000). */
  delay?: number
  /** Whether auto-save is enabled. Set false for create mode. */
  enabled?: boolean
}

export function useAutoSave({
  initialValue,
  onSave,
  delay = 3000,
  enabled = true,
}: UseAutoSaveOptions) {
  const [value, setValue] = useState(initialValue)
  const [status, setStatus] = useState<AutoSaveStatus>("idle")
  const [lastSavedValue, setLastSavedValue] = useState(initialValue)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const fadeRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const save = useCallback(
    async (val: string) => {
      if (!enabled || val === lastSavedValue) return
      setStatus("saving")
      try {
        const result = await onSave(val)
        if (result && "error" in result && result.error) {
          setStatus("error")
        } else {
          setLastSavedValue(val)
          setStatus("saved")
          clearTimeout(fadeRef.current)
          fadeRef.current = setTimeout(() => setStatus("idle"), 3000)
        }
      } catch {
        setStatus("error")
      }
    },
    [enabled, lastSavedValue, onSave]
  )

  // Debounced save on value change
  useEffect(() => {
    if (!enabled || value === lastSavedValue) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(value), delay)
    return () => clearTimeout(timerRef.current)
  }, [delay, enabled, lastSavedValue, save, value])

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current)
      clearTimeout(fadeRef.current)
    }
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      setValue(e.target.value)
    },
    []
  )

  const handleBlur = useCallback(() => {
    clearTimeout(timerRef.current)
    if (enabled && value !== lastSavedValue) {
      void save(value)
    }
  }, [enabled, lastSavedValue, save, value])

  const retry = useCallback(() => {
    void save(value)
  }, [value, save])

  /** Whether this field has local changes not yet persisted. */
  const isDirty = value !== lastSavedValue

  return { value, setValue, status, handleChange, handleBlur, retry, isDirty }
}
