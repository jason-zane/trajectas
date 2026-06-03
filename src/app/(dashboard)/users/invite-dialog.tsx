"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, CheckCircle2, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";

import { createStaffInviteAction, revokeInviteById } from "@/app/actions/staff-users";
import { resendInvite } from "@/app/actions/user-management";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InviteLinkField } from "@/components/invite-link-field";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  ActionDialog,
  ActionDialogBody,
  ActionDialogFooter,
} from "@/components/action-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSelectLabel } from "@/lib/select-display";
import { cn } from "@/lib/utils";

type InviteTenantType = "platform" | "partner" | "client";
type InviteRole =
  | "platform_admin"
  | "partner_admin"
  | "partner_member"
  | "client_admin"
  | "client_member";

type InviteActionResult = Awaited<ReturnType<typeof createStaffInviteAction>>;

interface TenantOption {
  id: string;
  name: string;
}

interface InviteDialogProps {
  partners: TenantOption[];
  clients: TenantOption[];
}

const SCOPE_OPTIONS: Array<{
  value: InviteTenantType;
  label: string;
  description: string;
}> = [
  {
    value: "platform",
    label: "Platform",
    description: "Invite a platform administrator with full access.",
  },
  {
    value: "partner",
    label: "Partner",
    description: "Invite a user into a specific partner workspace.",
  },
  {
    value: "client",
    label: "Client",
    description: "Invite a user into a specific client workspace.",
  },
];

const ROLE_OPTIONS: Record<
  InviteTenantType,
  Array<{ value: InviteRole; label: string }>
> = {
  platform: [{ value: "platform_admin", label: "Platform Admin" }],
  partner: [
    { value: "partner_admin", label: "Partner Admin" },
    { value: "partner_member", label: "Partner Member" },
  ],
  client: [
    { value: "client_admin", label: "Client Admin" },
    { value: "client_member", label: "Client Member" },
  ],
};

function getRoleHelperText(role: InviteRole) {
  if (role === "platform_admin") {
    return "Platform admins can manage the entire Trajectas workspace.";
  }
  if (role === "partner_admin" || role === "client_admin") {
    return "Admins can manage people and settings within the selected workspace.";
  }
  return "Members get contributor access within the selected workspace.";
}

function TenantCombobox({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: TenantOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <button
            type="button"
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm text-left transition-colors",
              "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              "disabled:cursor-not-allowed disabled:opacity-50",
              open && "ring-2 ring-primary/30"
            )}
          />
        }
      >
        <span className="truncate">
          {selected?.name ?? `Select ${label.toLowerCase()}`}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-[min(24rem,calc(100vw-4rem))] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label.toLowerCase()}...`} />
          <CommandList className="max-h-64">
            <CommandEmpty>No {label.toLowerCase()} found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = option.id === value;
                return (
                  <CommandItem
                    key={option.id}
                    value={`${option.name} ${option.id}`}
                    data-checked={isSelected}
                    onSelect={() => {
                      onChange(option.id);
                      setOpen(false);
                    }}
                    className="gap-2"
                  >
                    <span className="min-w-0 flex-1 truncate">{option.name}</span>
                    {isSelected ? <Check className="size-4 text-primary" /> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function InviteDialog({ partners, clients }: InviteDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [tenantType, setTenantType] = useState<InviteTenantType>("platform");
  const [role, setRole] = useState<InviteRole>("platform_admin");
  const [tenantId, setTenantId] = useState("");
  const [result, setResult] = useState<InviteActionResult>();
  const [isPending, startTransition] = useTransition();

  const tenantOptions = tenantType === "partner" ? partners : clients;
  const roleOptions = ROLE_OPTIONS[tenantType];

  const selectedTenantName = useMemo(
    () => tenantOptions.find((option) => option.id === tenantId)?.name ?? null,
    [tenantId, tenantOptions]
  );

  function resetForm() {
    setEmail("");
    setTenantType("platform");
    setRole("platform_admin");
    setTenantId("");
    setResult(undefined);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  }

  function handleScopeChange(nextScope: InviteTenantType) {
    setTenantType(nextScope);
    setRole(ROLE_OPTIONS[nextScope][0]?.value ?? "platform_admin");
    setTenantId("");
    setResult(undefined);
  }

  function buildFormData() {
    const formData = new FormData();
    formData.set("email", email.trim());
    formData.set("tenantType", tenantType);
    formData.set("role", role);

    if (tenantType !== "platform" && tenantId) {
      formData.set("tenantId", tenantId);
    }

    return formData;
  }

  function handleCreateResult(nextResult: InviteActionResult) {
    setResult(nextResult);

    if (!nextResult) {
      toast.error("Failed to create invite.");
      return;
    }

    if (nextResult.error) {
      // A duplicate keeps the dialog open so the inline resolution banner
      // (resend / revoke & send) can be acted on; other errors just toast.
      if (!nextResult.duplicate) {
        toast.error(nextResult.error);
      }
      return;
    }

    if (nextResult.emailDelivered === false) {
      toast.warning(
        `Invite created, but the email couldn’t be sent — copy the link to share it.`
      );
    } else {
      toast.success(`Invite email sent to ${email.trim()}.`);
    }
    // Keep the dialog open so the shareable link (carried on `result`) stays
    // visible to copy — the fallback when the invite email is filtered.
    router.refresh();
  }

  function handleSubmit() {
    const formData = buildFormData();
    startTransition(async () => {
      handleCreateResult(await createStaffInviteAction(undefined, formData));
    });
  }

  function handleResendExisting() {
    const inviteId = result?.duplicate?.inviteId;
    if (!inviteId) return;

    startTransition(async () => {
      const outcome = await resendInvite(inviteId);
      if ("error" in outcome) {
        toast.error(outcome.error);
        return;
      }

      if (outcome.emailDelivered) {
        toast.success(`Invite email resent to ${email.trim()}.`);
      } else {
        toast.warning(
          `Couldn’t send the email — use Copy invite link on the pending invite to share it.`
        );
      }
      setOpen(false);
      resetForm();
      router.refresh();
    });
  }

  function handleRevokeAndSend() {
    const inviteId = result?.duplicate?.inviteId;
    if (!inviteId) return;

    const formData = buildFormData();
    startTransition(async () => {
      const revoked = await revokeInviteById(inviteId);
      if ("error" in revoked) {
        toast.error(revoked.error);
        return;
      }

      handleCreateResult(await createStaffInviteAction(undefined, formData));
    });
  }

  const canSubmit =
    email.trim().length > 0 &&
    (tenantType === "platform" || tenantId.length > 0) &&
    !isPending;

  // Present only after a successful send — switches the dialog to the
  // "share the link" success state.
  const sentLink = result?.inviteLink ?? null;
  const emailDelivered = result?.emailDelivered !== false;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        Invite User
      </Button>

      <ActionDialog
        open={open}
        onOpenChange={handleOpenChange}
        eyebrow="Team"
        title="Invite user"
        description="Send a staff invite email. Invites expire in 7 days."
      >
        <ActionDialogBody className="space-y-5">
          {sentLink ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2 text-sm text-foreground">
                {emailDelivered ? (
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                )}
                <span>
                  {emailDelivered
                    ? `Invite email sent to ${email.trim()}.`
                    : `Couldn’t send the email to ${email.trim()}. Share the link below instead.`}
                </span>
              </div>
              <div className="space-y-2">
                <Label>Shareable invite link</Label>
                <InviteLinkField link={sentLink} />
                <p className="text-xs text-muted-foreground">
                  If the email doesn&rsquo;t arrive, send this link directly. It
                  expires in 7 days.
                </p>
              </div>
            </div>
          ) : (
            <>
          <div className="space-y-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setResult(undefined);
              }}
              placeholder="name@example.com"
              disabled={isPending}
              autoFocus
            />
            {result?.fields?.email?.[0] ? (
              <p className="text-sm text-destructive">{result.fields.email[0]}</p>
            ) : null}
          </div>

          <div className="space-y-3">
            <Label>Scope</Label>
            <RadioGroup
              value={tenantType}
              onValueChange={(value) => handleScopeChange(value as InviteTenantType)}
              className="grid gap-2 md:grid-cols-3"
            >
              {SCOPE_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                    tenantType === option.value
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <RadioGroupItem value={option.value} />
                  <div className="space-y-1">
                    <div className="font-medium text-foreground">{option.label}</div>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                value={role}
                onValueChange={(value) => {
                  setRole(value as InviteRole);
                  setResult(undefined);
                }}
                disabled={isPending}
              >
                <SelectTrigger id="invite-role" className="w-full">
                  <SelectValue>
                    {(value: string | null) =>
                      getSelectLabel(value as InviteRole | null, roleOptions)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {roleOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{getRoleHelperText(role)}</p>
            </div>

            {tenantType !== "platform" ? (
              <div className="space-y-2">
                <Label>{tenantType === "partner" ? "Partner" : "Client"}</Label>
                <TenantCombobox
                  label={tenantType === "partner" ? "Partner" : "Client"}
                  options={tenantOptions}
                  value={tenantId}
                  onChange={(nextTenantId) => {
                    setTenantId(nextTenantId);
                    setResult(undefined);
                  }}
                  disabled={isPending}
                />
                {selectedTenantName ? (
                  <Badge variant="outline">{selectedTenantName}</Badge>
                ) : null}
                {result?.fields?.tenantId?.[0] ? (
                  <p className="text-sm text-destructive">{result.fields.tenantId[0]}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          {result?.fields?.role?.[0] ? (
            <p className="text-sm text-destructive">{result.fields.role[0]}</p>
          ) : null}
          {result?.fields?.tenantType?.[0] ? (
            <p className="text-sm text-destructive">{result.fields.tenantType[0]}</p>
          ) : null}
          {result?.duplicate ? (
            <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
              <p className="text-sm text-foreground">
                {result.error ??
                  "An active invite already exists for this person with this role."}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleResendExisting}
                  disabled={isPending}
                >
                  Resend existing invite
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleRevokeAndSend}
                  disabled={isPending}
                >
                  Revoke & send new
                </Button>
              </div>
            </div>
          ) : result?.error ? (
            <p className="text-sm text-destructive">{result.error}</p>
          ) : null}
            </>
          )}
        </ActionDialogBody>
        <ActionDialogFooter>
          {sentLink ? (
            <>
              <Button variant="ghost" onClick={resetForm} disabled={isPending}>
                Invite another
              </Button>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                {isPending ? "Sending..." : "Send invite"}
              </Button>
            </>
          )}
        </ActionDialogFooter>
      </ActionDialog>
    </>
  );
}
