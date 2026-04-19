"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Calendar,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Loader2,
  Mail,
  Plus,
  Shield,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { addMembership, updateMembershipRole, updateUserRole, type UserDetail } from "@/app/actions/user-management";
import {
  revokeMembershipById,
  toggleUserActiveState,
} from "@/app/actions/staff-users";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSelectLabel } from "@/lib/select-display";
import { cn } from "@/lib/utils";

type TenantOption = {
  id: string;
  name: string;
};

type TenantType = "partner" | "client";
type MembershipRole = "admin" | "member";
type RoleChoiceValue =
  | "platform_admin"
  | "partner_admin"
  | "partner_member"
  | "org_admin"
  | "client_member";

const ROLE_CHOICES: Array<{
  value: RoleChoiceValue;
  label: string;
  dbRole: UserDetail["role"];
}> = [
  { value: "platform_admin", label: "Platform Admin", dbRole: "platform_admin" },
  { value: "partner_admin", label: "Partner Admin", dbRole: "partner_admin" },
  { value: "partner_member", label: "Partner Member", dbRole: "consultant" },
  { value: "org_admin", label: "Client Admin", dbRole: "org_admin" },
  { value: "client_member", label: "Client Member", dbRole: "consultant" },
];

const ROLE_CHOICE_OPTIONS = ROLE_CHOICES.map(({ value, label }) => ({
  value,
  label,
}));

const MEMBERSHIP_ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
] as const;

const TENANT_TYPE_OPTIONS = [
  { value: "partner", label: "Partner" },
  { value: "client", label: "Client" },
] as const;

function formatDateTime(dateString: string) {
  return new Date(dateString).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatRelativeTime(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const diffDays = Math.round(diffMs / 86_400_000);

  if (diffDays === 0) {
    const diffHours = Math.round(diffMs / 3_600_000);
    if (Math.abs(diffHours) < 1) return "just now";
    return diffHours > 0 ? `${diffHours}h ago` : `in ${Math.abs(diffHours)}h`;
  }

  if (Math.abs(diffDays) < 7) {
    return diffDays > 0 ? `${diffDays}d ago` : `in ${Math.abs(diffDays)}d`;
  }

  return formatDateTime(dateString);
}

function getInitials(name: string | null, email: string) {
  const source = name?.trim() || email.trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getCurrentRoleChoice(user: UserDetail): RoleChoiceValue {
  switch (user.role) {
    case "platform_admin":
      return "platform_admin";
    case "partner_admin":
      return "partner_admin";
    case "org_admin":
      return "org_admin";
    case "consultant":
      if (user.partnerMemberships.some((membership) => !membership.revokedAt)) {
        return "partner_member";
      }

      return "client_member";
    default:
      return "platform_admin";
  }
}

function getRoleHint(user: UserDetail, roleChoice: RoleChoiceValue) {
  if (roleChoice === "partner_admin" && user.partnerMemberships.filter((membership) => !membership.revokedAt).length === 0) {
    return "Add a partner membership below to complete this role assignment.";
  }

  if (roleChoice === "org_admin" && user.clientMemberships.filter((membership) => !membership.revokedAt).length === 0) {
    return "Add a client membership below to complete this role assignment.";
  }

  if ((roleChoice === "partner_member" || roleChoice === "client_member") && user.partnerMemberships.filter((membership) => !membership.revokedAt).length === 0 && user.clientMemberships.filter((membership) => !membership.revokedAt).length === 0) {
    return "Add a partner or client membership below to complete this role assignment.";
  }

  return null;
}

function statusMeta(isActive: boolean) {
  return isActive
    ? {
        label: "Active",
        className:
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-700",
      }
    : {
        label: "Inactive",
        className: "text-muted-foreground",
      };
}

function tenantTypeLabel(tenantType: TenantType) {
  return tenantType === "partner" ? "Partner" : "Client";
}

function membershipTitle(tenantType: TenantType, name: string | null) {
  return name ?? `${tenantTypeLabel(tenantType)} membership`;
}

export function UserDetailClient({
  user,
  partners,
  clients,
}: {
  user: UserDetail;
  partners: TenantOption[];
  clients: TenantOption[];
}) {
  const router = useRouter();
  const [roleChoice, setRoleChoice] = useState<RoleChoiceValue>(
    getCurrentRoleChoice(user)
  );
  const [isRoleSaving, startRoleSaving] = useTransition();
  const [roleSaveState, setRoleSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [membershipRoleTarget, setMembershipRoleTarget] = useState<string | null>(null);
  const [isMembershipChanging, startMembershipChanging] = useTransition();
  const [revokeTarget, setRevokeTarget] = useState<{
    id: string;
    tenantType: TenantType;
    tenantId: string;
    role: string;
    name: string | null;
  } | null>(null);
  const [isRevoking, startRevoking] = useTransition();
  const [activeDialogOpen, setActiveDialogOpen] = useState(false);
  const [isUpdatingActive, startUpdatingActive] = useTransition();
  const [tenantType, setTenantType] = useState<TenantType>("partner");
  const [tenantId, setTenantId] = useState("");
  const [tenantPickerOpen, setTenantPickerOpen] = useState(false);
  const [membershipFormRole, setMembershipFormRole] = useState<MembershipRole>("member");
  const [isAddingMembership, startAddingMembership] = useTransition();

  useEffect(() => {
    setRoleChoice(getCurrentRoleChoice(user));
  }, [user]);

  const activePartnerMemberships = user.partnerMemberships.filter(
    (membership) => !membership.revokedAt
  );
  const revokedPartnerMemberships = user.partnerMemberships.filter(
    (membership) => membership.revokedAt
  );
  const activeClientMemberships = user.clientMemberships.filter(
    (membership) => !membership.revokedAt
  );
  const revokedClientMemberships = user.clientMemberships.filter(
    (membership) => membership.revokedAt
  );

  const currentChoice = ROLE_CHOICES.find((choice) => choice.value === roleChoice) ?? ROLE_CHOICES[0];
  const roleHasChanged = currentChoice.dbRole !== user.role;
  const roleHint = getRoleHint(user, roleChoice);

  const currentTenantOptions = tenantType === "partner" ? partners : clients;
  const selectedTenant = currentTenantOptions.find((tenant) => tenant.id === tenantId) ?? null;

  function handleSaveRole() {
    if (!roleHasChanged) {
      return;
    }

    startRoleSaving(async () => {
      setRoleSaveState("saving");
      const result = await updateUserRole(user.id, currentChoice.dbRole);
      if ("error" in result) {
        toast.error(result.error);
        setRoleSaveState("idle");
        return;
      }

      toast.success("User role updated");
      setRoleSaveState("saved");
      router.refresh();
      setTimeout(() => setRoleSaveState("idle"), 2000);
    });
  }

  function handleMembershipRoleChange(
    membershipId: string,
    nextRole: MembershipRole,
    tenantType: TenantType
  ) {
    setMembershipRoleTarget(membershipId);
    startMembershipChanging(async () => {
      const result = await updateMembershipRole(membershipId, tenantType, nextRole);
      setMembershipRoleTarget(null);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Membership role updated");
      router.refresh();
    });
  }

  function handleConfirmRevokeMembership() {
    if (!revokeTarget) {
      return;
    }

    startRevoking(async () => {
      const result = await revokeMembershipById(revokeTarget.id, revokeTarget.tenantType, user.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Membership revoked", {
        action: {
          label: "Undo",
          onClick: async () => {
            const { addMembership } = await import("@/app/actions/user-management");
            const undoResult = await addMembership(user.id, revokeTarget.tenantType, revokeTarget.tenantId, revokeTarget.role as "admin" | "member");
            if ("error" in undoResult) {
              toast.error(undoResult.error);
            } else {
              toast.success("Membership restored");
            }
          },
        },
        duration: 5000,
      });
      setRevokeTarget(null);
      router.refresh();
    });
  }

  function handleToggleActive() {
    startUpdatingActive(async () => {
      const result = await toggleUserActiveState(user.id, !user.isActive);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(user.isActive ? "User deactivated" : "User reactivated");
      setActiveDialogOpen(false);
      router.refresh();
    });
  }

  function handleAddMembership() {
    if (!tenantId) {
      toast.error(`Select a ${tenantTypeLabel(tenantType).toLowerCase()} first.`);
      return;
    }

    startAddingMembership(async () => {
      const result = await addMembership(
        user.id,
        tenantType,
        tenantId,
        membershipFormRole
      );

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Membership added");
      setTenantId("");
      setTenantPickerOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Avatar size="lg" className="size-14">
          <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold">
            {getInitials(user.displayName, user.email)}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className={cn("border", statusMeta(user.isActive).className)}>
                  {statusMeta(user.isActive).label}
                </Badge>
                <Badge variant="outline" className="border-primary/20 text-primary">
                  {currentChoice.label}
                </Badge>
              </div>
              <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="size-3.5" />
                {user.email}
              </p>
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="size-3.5" />
                Created {formatDateTime(user.createdAt)}
              </p>
            </div>

          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle>Platform role</CardTitle>
            <CardDescription>
              Change the profile role used for platform-level access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user-role">Role</Label>
              <Select
                value={roleChoice}
                onValueChange={(value) => setRoleChoice(value as RoleChoiceValue)}
              >
                <SelectTrigger id="user-role" className="w-full">
                  <SelectValue>
                    {(value: string | null) =>
                      getSelectLabel(value as RoleChoiceValue | null, ROLE_CHOICE_OPTIONS)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {ROLE_CHOICES.map((choice) => (
                      <SelectItem key={choice.value} value={choice.value}>
                        {choice.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {roleHint ? (
              <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
                {roleHint}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Consultant uses memberships to define partner or client scope.
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleSaveRole}
                disabled={isRoleSaving || !roleHasChanged || roleSaveState === "saved"}
              >
                {roleSaveState === "saving" ? (
                  <>
                    <Loader2 className="size-3 animate-spin mr-1.5" />
                    Saving...
                  </>
                ) : roleSaveState === "saved" ? (
                  <>
                    <Check className="size-3 mr-1.5" />
                    Saved
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                Changes are audited and take effect immediately.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Memberships</CardTitle>
            <CardDescription>
              Partner and client memberships determine workspace access.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <BriefcaseBusiness className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Partner memberships</h3>
                <Badge variant="outline">{activePartnerMemberships.length}</Badge>
              </div>
              {activePartnerMemberships.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active partner memberships.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activePartnerMemberships.map((membership) => (
                      <TableRow key={membership.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <BriefcaseBusiness className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium">{membership.partnerName ?? "Unknown partner"}</p>
                              <p className="text-xs text-muted-foreground">Partner membership</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={membership.role}
                            onValueChange={(value) =>
                              handleMembershipRoleChange(
                                membership.id,
                                value as MembershipRole,
                                "partner"
                              )
                            }
                            disabled={membershipRoleTarget === membership.id || isMembershipChanging}
                          >
                            <SelectTrigger className="w-[110px]" size="sm">
                              <SelectValue>
                                {(value: string | null) =>
                                  getSelectLabel(
                                    value as MembershipRole | null,
                                    MEMBERSHIP_ROLE_OPTIONS
                                  )
                                }
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="member">Member</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatRelativeTime(membership.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                              setRevokeTarget({
                                id: membership.id,
                                tenantType: "partner",
                                tenantId: membership.partnerId,
                                role: membership.role,
                                name: membership.partnerName,
                              })
                            }
                          >
                            <X className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {revokedPartnerMemberships.length > 0 ? (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-muted-foreground">
                    Revoked
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    Revoked memberships remain visible for auditability.
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Partner</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Revoked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revokedPartnerMemberships.map((membership) => (
                      <TableRow key={membership.id} className="opacity-75">
                        <TableCell>{membership.partnerName ?? "Unknown partner"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">Revoked</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {membership.revokedAt ? formatRelativeTime(membership.revokedAt) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Client memberships</h3>
                <Badge variant="outline">{activeClientMemberships.length}</Badge>
              </div>
              {activeClientMemberships.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active client memberships.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeClientMemberships.map((membership) => (
                      <TableRow key={membership.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Building2 className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium">{membership.clientName ?? "Unknown client"}</p>
                              <p className="text-xs text-muted-foreground">Client membership</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={membership.role}
                            onValueChange={(value) =>
                              handleMembershipRoleChange(
                                membership.id,
                                value as MembershipRole,
                                "client"
                              )
                            }
                            disabled={membershipRoleTarget === membership.id || isMembershipChanging}
                          >
                            <SelectTrigger className="w-[110px]" size="sm">
                              <SelectValue>
                                {(value: string | null) =>
                                  getSelectLabel(
                                    value as MembershipRole | null,
                                    MEMBERSHIP_ROLE_OPTIONS
                                  )
                                }
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="member">Member</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatRelativeTime(membership.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() =>
                              setRevokeTarget({
                                id: membership.id,
                                tenantType: "client",
                                tenantId: membership.clientId,
                                role: membership.role,
                                name: membership.clientName,
                              })
                            }
                          >
                            <X className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            {revokedClientMemberships.length > 0 ? (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-muted-foreground">
                    Revoked
                  </Badge>
                  <p className="text-xs text-muted-foreground">
                    Revoked memberships remain visible for auditability.
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Revoked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revokedClientMemberships.map((membership) => (
                      <TableRow key={membership.id} className="opacity-75">
                        <TableCell>{membership.clientName ?? "Unknown client"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">Revoked</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {membership.revokedAt ? formatRelativeTime(membership.revokedAt) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center gap-2">
                <Plus className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Add membership</h3>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="tenant-type">Tenant type</Label>
                  <Select
                    value={tenantType}
                    onValueChange={(value) => {
                      setTenantType(value as TenantType);
                      setTenantId("");
                    }}
                  >
                    <SelectTrigger id="tenant-type" className="w-full">
                      <SelectValue>
                        {(value: string | null) =>
                          getSelectLabel(value as TenantType | null, TENANT_TYPE_OPTIONS)
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="partner">Partner</SelectItem>
                        <SelectItem value="client">Client</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tenant</Label>
                  <Popover open={tenantPickerOpen} onOpenChange={setTenantPickerOpen}>
                    <PopoverTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-between"
                          disabled={currentTenantOptions.length === 0}
                        />
                      }
                    >
                      {selectedTenant?.name ?? `Select ${tenantTypeLabel(tenantType).toLowerCase()}`}
                      <ChevronDown className="size-4 opacity-60" />
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-0" align="start">
                      <Command>
                        <CommandInput
                          placeholder={`Search ${tenantTypeLabel(tenantType).toLowerCase()}s`}
                        />
                        <CommandList>
                          <CommandEmpty>
                            No {tenantTypeLabel(tenantType).toLowerCase()}s found.
                          </CommandEmpty>
                          <CommandGroup>
                            {currentTenantOptions.map((tenant) => (
                              <CommandItem
                                key={tenant.id}
                                value={tenant.name}
                                onSelect={() => {
                                  setTenantId(tenant.id);
                                  setTenantPickerOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "size-4",
                                    tenantId === tenant.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {tenant.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="membership-role">Role</Label>
                  <Select
                    value={membershipFormRole}
                    onValueChange={(value) => setMembershipFormRole(value as MembershipRole)}
                  >
                    <SelectTrigger id="membership-role" className="w-full">
                      <SelectValue>
                        {(value: string | null) =>
                          getSelectLabel(value as MembershipRole | null, MEMBERSHIP_ROLE_OPTIONS)
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={handleAddMembership}
                  disabled={isAddingMembership || !currentTenantOptions.length}
                >
                  {isAddingMembership ? "Adding..." : "Save membership"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Revoked memberships are reactivated automatically when the same tenant is added again.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-destructive/20 bg-destructive/[0.03]">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Deactivate or reactivate this account without deleting historical data.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Shield className="size-4" />
            {user.isActive
              ? "This user can access platform surfaces and memberships."
              : "This user is currently disabled and cannot sign in."}
          </div>
          <Button
            type="button"
            variant={user.isActive ? "destructive" : "default"}
            onClick={() => setActiveDialogOpen(true)}
          >
            {user.isActive ? "Deactivate" : "Reactivate"}
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={activeDialogOpen}
        onOpenChange={setActiveDialogOpen}
        title={user.isActive ? "Deactivate user?" : "Reactivate user?"}
        description={
          user.isActive
            ? "This will disable the account while preserving memberships and audit history."
            : "This will restore account access without changing roles or memberships."
        }
        confirmLabel={user.isActive ? "Deactivate" : "Reactivate"}
        variant={user.isActive ? "destructive" : "default"}
        onConfirm={handleToggleActive}
        loading={isUpdatingActive}
      />

      <ConfirmDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevokeTarget(null);
          }
        }}
        title="Revoke membership?"
        description={`This will revoke ${membershipTitle(revokeTarget?.tenantType ?? "partner", revokeTarget?.name ?? null)}'s access. The record will remain for audit history.`}
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={handleConfirmRevokeMembership}
        loading={isRevoking}
      />
    </div>
  );
}
