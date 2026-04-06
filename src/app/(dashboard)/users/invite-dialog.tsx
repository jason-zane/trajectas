"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { toast } from "sonner";

import { createStaffInviteAction } from "@/app/actions/staff-users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    return "Platform admins can manage the entire TalentFit workspace.";
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

  function handleSubmit() {
    const formData = new FormData();
    formData.set("email", email.trim());
    formData.set("tenantType", tenantType);
    formData.set("role", role);

    if (tenantType !== "platform" && tenantId) {
      formData.set("tenantId", tenantId);
    }

    startTransition(async () => {
      const nextResult = await createStaffInviteAction(undefined, formData);
      setResult(nextResult);

      if (!nextResult) {
        toast.error("Failed to create invite.");
        return;
      }

      if (nextResult.error) {
        toast.error(nextResult.error);
        return;
      }

      if (!nextResult.inviteLink) {
        toast.error("Invite was created, but no acceptance link was returned.");
        return;
      }

      try {
        await navigator.clipboard.writeText(nextResult.inviteLink);
        toast.success(`Invite sent to ${email.trim()}. Acceptance link copied.`);
      } catch {
        toast.success(`Invite sent to ${email.trim()}.`);
      }

      setOpen(false);
      resetForm();
      router.refresh();
    });
  }

  const canSubmit =
    email.trim().length > 0 &&
    (tenantType === "platform" || tenantId.length > 0) &&
    !isPending;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus data-icon="inline-start" />
        Invite User
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send a staff invite and copy the acceptance link. Invites expire in 7 days.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
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
                    <SelectValue />
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
            {result?.error ? (
              <p className="text-sm text-destructive">{result.error}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {isPending ? "Sending..." : "Send Invite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
