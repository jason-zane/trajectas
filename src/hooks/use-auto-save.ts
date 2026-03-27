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
  const lastSaved = useRef(initialValue)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const fadeRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const save = useCallback(
    async (val: string) => {
      if (!enabled || val === lastSaved.current) return
      setStatus("saving")
      try {
        const result = await onSave(val)
        if (result && "error" in result && result.error) {
          setStatus("error")
        } else {
          lastSaved.current = val
          setStatus("saved")
          clearTimeout(fadeRef.current)
          fadeRef.current = setTimeout(() => setStatus("idle"), 3000)
        }
      } catch {
        setStatus("error")
      }
    },
    [onSave, enabled]
  )

  // Debounced save on value change
  useEffect(() => {
    if (!enabled || value === lastSaved.current) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(value), delay)
    return () => clearTimeout(timerRef.current)
  }, [value, delay, save, enabled])

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
    if (enabled && value !== lastSaved.current) {
      save(value)
    }
  }, [value, save, enabled])

  const retry = useCallback(() => {
    save(value)
  }, [value, save])

  /** Whether this field has local changes not yet persisted. */
  const isDirty = value !== lastSaved.current

  return { value, setValue, status, handleChange, handleBlur, retry, isDirty }
}
