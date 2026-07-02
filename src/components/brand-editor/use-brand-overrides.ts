import { useState, useCallback, useMemo } from 'react'
import { mergeBrandLayers } from '@/lib/brand/merge'
import type { BrandConfig, BrandOverrides } from '@/lib/brand/types'

export interface UseBrandOverridesProps {
  inherited: BrandConfig
  initialOverrides: BrandOverrides | null
}

export interface UseBrandOverridesReturn {
  overrides: BrandOverrides
  effective: BrandConfig
  isOverridden: (key: keyof BrandConfig) => boolean
  setField: <K extends keyof BrandConfig>(key: K, value: BrandConfig[K]) => void
  clearField: (key: keyof BrandConfig) => void
  clearAll: () => void
  hasOverrides: boolean
  setOverrides: (overrides: BrandOverrides) => void
}

/**
 * Client hook for managing brand overrides with live merging.
 *
 * Tracks the override layer and computes the effective (merged) config.
 * Provides utilities for setting/clearing individual fields and checking
 * override status.
 */
export function useBrandOverrides({
  inherited,
  initialOverrides,
}: UseBrandOverridesProps): UseBrandOverridesReturn {
  const [overrides, setOverrides] = useState<BrandOverrides>(initialOverrides ?? {})

  const effective = useMemo(
    () => mergeBrandLayers([inherited, overrides]),
    [inherited, overrides]
  )

  const isOverridden = useCallback(
    (key: keyof BrandConfig): boolean => {
      const val = (overrides as unknown as Record<string, unknown>)[key]
      return val !== undefined && val !== null
    },
    [overrides]
  )

  const setField = useCallback(
    <K extends keyof BrandConfig>(key: K, value: BrandConfig[K]): void => {
      setOverrides((prev) => ({
        ...prev,
        [key]: value,
      }))
    },
    []
  )

  const clearField = useCallback(
    (key: keyof BrandConfig): void => {
      setOverrides((prev) => {
        const next = { ...prev }
        delete (next as unknown as Record<string, unknown>)[key]
        return next
      })
    },
    []
  )

  const clearAll = useCallback(() => {
    setOverrides({})
  }, [])

  const hasOverrides = Object.values(overrides).some((v) => v !== undefined && v !== null)

  return {
    overrides,
    effective,
    isOverridden,
    setField,
    clearField,
    clearAll,
    hasOverrides,
    setOverrides,
  }
}
