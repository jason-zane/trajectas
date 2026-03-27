"use client"

import { toast } from "sonner"

type ActionResult =
  | { error: Record<string, string[]> }
  | { error: { _form: string[] } }
  | { error: string }
  | { success: true; id?: string; slug?: string }
  | undefined
  | void

/**
 * Show a toast based on a server action result.
 * Returns true if the action succeeded (no error).
 */
export function showActionToast(
  result: ActionResult,
  {
    success: successMsg,
    error: errorMsg,
  }: { success?: string; error?: string } = {}
): boolean {
  if (!result) return false

  if ("error" in result) {
    const err = result.error
    let message: string

    if (typeof err === "string") {
      message = err
    } else if ("_form" in err) {
      message = err._form?.[0] ?? "Something went wrong"
    } else {
      message =
        Object.values(err).flat().join(", ") || "Validation failed"
    }

    toast.error(errorMsg ?? message)
    return false
  }

  if ("success" in result && result.success) {
    if (successMsg) toast.success(successMsg)
    return true
  }

  return false
}
