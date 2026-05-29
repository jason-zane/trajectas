"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ArchitectModal } from "./architect-modal";

/**
 * CTA button + modal host for the Assessment Architect.
 *
 * Open state is derived from both a manual click and the `?new=architect`
 * query param, so the sidebar "Architect" link opens the wizard on arrival
 * (including when already on this page) without a dedicated route. Closing
 * strips the param so a refresh doesn't reopen it.
 */
export function ArchitectLauncher() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [manualOpen, setManualOpen] = useState(false);

  const urlOpen = searchParams.get("new") === "architect";
  const open = manualOpen || urlOpen;

  function setOpen(next: boolean) {
    if (next) {
      setManualOpen(true);
      return;
    }
    setManualOpen(false);
    if (urlOpen) {
      const params = new URLSearchParams(searchParams);
      params.delete("new");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Wand2 className="size-4" />
        Architect
      </Button>
      <ArchitectModal open={open} onOpenChange={setOpen} />
    </>
  );
}
