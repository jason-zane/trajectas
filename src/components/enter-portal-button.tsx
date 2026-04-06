"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createEnterPortalLaunchUrl } from "@/app/actions/enter-portal";

type EnterPortalButtonProps = {
  tenantType: "client" | "partner";
  tenantId: string;
  tenantName: string;
  variant?: "default" | "outline";
};

export function EnterPortalButton({
  tenantType,
  tenantId,
  tenantName,
  variant = "default",
}: EnterPortalButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    const result = await createEnterPortalLaunchUrl({ tenantType, tenantId });
    setIsLoading(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    const newWindow = window.open(result.launchUrl, "_blank");
    if (!newWindow) {
      toast.error("Popup blocked. Please allow popups and try again.");
      return;
    }

    toast.success(`Opening ${tenantName} ${tenantType} portal in new tab`);
  }

  const label =
    tenantType === "client" ? "Enter Client Portal" : "Enter Partner Portal";

  return (
    <Button onClick={handleClick} disabled={isLoading} variant={variant}>
      {isLoading ? "Starting session..." : label}
      <ExternalLink className="size-4 ml-2" />
    </Button>
  );
}
