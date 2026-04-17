"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Copy, Power, Trash2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ActionDialog,
  ActionDialogBody,
  ActionDialogFooter,
} from "@/components/action-dialog";
import {
  createAccessLink,
  deactivateAccessLink,
  reactivateAccessLink,
  deleteAccessLink,
} from "@/app/actions/campaigns";
import type { CampaignAccessLink } from "@/types/database";

export function CampaignAccessLinks({
  campaignId,
  links,
}: {
  campaignId: string;
  links: CampaignAccessLink[];
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState("");
  const [maxUses, setMaxUses] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const result = await createAccessLink(campaignId, {
      label: label || undefined,
      maxUses: maxUses ? parseInt(maxUses) : undefined,
    });

    if ("error" in result && result.error) {
      toast.error("Failed to create link");
      return;
    }

    toast.success("Access link created");
    setLabel("");
    setMaxUses("");
    setShowCreate(false);
  }

  async function handleToggleActive(linkId: string, currentlyActive: boolean) {
    const result = currentlyActive
      ? await deactivateAccessLink(campaignId, linkId)
      : await reactivateAccessLink(campaignId, linkId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success(currentlyActive ? "Link deactivated" : "Link activated");
  }

  async function handleDelete(linkId: string) {
    if (!confirm("Delete this access link? This cannot be undone.")) return;
    const result = await deleteAccessLink(campaignId, linkId);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Link deleted");
  }

  function copyUrl(token: string) {
    const url = `${window.location.origin}/assess/join/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Enrollment link copied");
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Access Links</CardTitle>
            <CardDescription>
              Shareable links for self-enrollment into this campaign.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="size-4" />
            New Link
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No access links yet.
          </p>
        ) : (
          <div className="space-y-2">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex items-center gap-3 py-2 border-b border-border last:border-0"
              >
                <Link2 className="size-4 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {link.label || "Unnamed link"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {link.useCount} uses
                    {link.maxUses ? ` / ${link.maxUses} max` : ""}
                  </p>
                </div>
                <Badge variant={link.isActive ? "default" : "outline"}>
                  {link.isActive ? "Active" : "Inactive"}
                </Badge>
                {link.isActive && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8"
                    onClick={() => copyUrl(link.token)}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground hover:text-foreground"
                  onClick={() => handleToggleActive(link.id, link.isActive)}
                  title={link.isActive ? "Deactivate link" : "Activate link"}
                >
                  <Power className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(link.id)}
                  title="Delete link"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <ActionDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        eyebrow="Access"
        title="Create access link"
        description="Generate a shareable URL. Anyone with the link can take the assessment."
      >
        <form
          onSubmit={handleCreate}
          className="flex min-h-0 flex-1 flex-col"
        >
          <ActionDialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="link-label">Label (optional)</Label>
              <Input
                id="link-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. LinkedIn post"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="link-max">Max uses (optional)</Label>
              <Input
                id="link-max"
                type="number"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="Unlimited"
              />
            </div>
          </ActionDialogBody>
          <ActionDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              <Link2 className="size-4" />
              Create link
            </Button>
          </ActionDialogFooter>
        </form>
      </ActionDialog>
    </Card>
  );
}
