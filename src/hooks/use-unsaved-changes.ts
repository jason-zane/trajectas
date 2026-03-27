"use client"

import { useEffect, useCallback, useRef, useState } from "react"

/**
 * Warns users before navigating away from a page with unsaved changes.
 *
 * Handles:
 * - Browser close / refresh / URL-bar navigation (`beforeunload`)
 * - Client-side navigation via Link / router.push (`history.pushState` interception)
 * - Browser back / forward buttons (`popstate`)
 */
export function useUnsavedChanges(isDirty: boolean) {
  const [showDialog, setShowDialog] = useState(false)
  const pendingHref = useRef<string | null>(null)
  const isBackNav = useRef(false)

  useEffect(() => {
    if (!isDirty) return

    // --- Browser close / refresh / URL-bar navigation ---
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener("beforeunload", handleBeforeUnload)

    // --- Client-side Link / router.push navigation ---
    const origPush = history.pushState.bind(history)

    history.pushState = function (
      data: unknown,
      unused: string,
      url?: string | URL | null
    ) {
      if (url) {
        const target = String(url)
        const current = location.pathname + location.search + location.hash
        if (target !== current) {
          pendingHref.current = target
          isBackNav.current = false
          // Defer to avoid calling setState during useInsertionEffect (Next.js router)
          queueMicrotask(() => setShowDialog(true))
          return
        }
      }
      return origPush(data, unused, url)
    }

    // --- Browser back / forward ---
    const handlePopState = () => {
      // Re-push the current URL to cancel the browser's navigation
      origPush(null, "", location.href)
      pendingHref.current = null
      isBackNav.current = true
      setShowDialog(true)
    }
    window.addEventListener("popstate", handlePopState)

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
      window.removeEventListener("popstate", handlePopState)
      history.pushState = origPush
    }
  }, [isDirty])

  const confirmNavigation = useCallback(() => {
    setShowDialog(false)

    if (isBackNav.current) {
      isBackNav.current = false
      window.history.back()
      return
    }

    const href = pendingHref.current
    pendingHref.current = null
    if (href) {
      // Full navigation bypasses our interceptor cleanly
      window.location.href = href
    }
  }, [])

  const cancelNavigation = useCallback(() => {
    setShowDialog(false)
    pendingHref.current = null
    isBackNav.current = false
  }, [])

  return { showDialog, confirmNavigation, cancelNavigation }
}
