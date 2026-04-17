"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";

import { favoriteCampaign, unfavoriteCampaign } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FavoriteCampaignButtonProps {
  campaignId: string;
  isFavorite: boolean;
  className?: string;
}

export function FavoriteCampaignButton({
  campaignId,
  isFavorite: initialFavorite,
  className,
}: FavoriteCampaignButtonProps) {
  const [isFavorite, setIsFavorite] = useState(initialFavorite);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    const next = !isFavorite;
    setIsFavorite(next);

    startTransition(async () => {
      const result = next
        ? await favoriteCampaign(campaignId)
        : await unfavoriteCampaign(campaignId);

      if (result?.error) {
        setIsFavorite(!next);
        toast.error(next ? "Unable to favorite" : "Unable to unfavorite", {
          description: result.error,
        });
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("size-8", className)}
      onClick={handleToggle}
      disabled={isPending}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Star
        className={cn(
          "size-4 transition-colors",
          isFavorite
            ? "fill-amber-400 text-amber-400"
            : "text-muted-foreground",
        )}
      />
    </Button>
  );
}
