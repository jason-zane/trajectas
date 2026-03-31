"use client";

import { useActionState, useState } from "react";
import { createStaffInviteAction } from "@/app/actions/staff-users";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InviteUserFormProps {
  partners: Array<{ id: string; name: string }>;
  clients: Array<{ id: string; name: string }>;
}

export function InviteUserForm({ partners, clients }: InviteUserFormProps) {
  const [tenantType, setTenantType] = useState<"platform" | "partner" | "client">(
    "platform"
  );
  const [state, formAction, pending] = useActionState(createStaffInviteAction, undefined);

  const roleOptions =
    tenantType === "platform"
      ? [{ value: "platform_admin", label: "Platform admin" }]
      : tenantType === "partner"
        ? [
            { value: "partner_admin", label: "Partner admin" },
            { value: "partner_member", label: "Partner member" },
          ]
        : [
            { value: "client_admin", label: "Client admin" },
            { value: "client_member", label: "Client member" },
          ];

  const tenantOptions = tenantType === "partner" ? partners : clients;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite staff user</CardTitle>
        <CardDescription>
          Create an invite and copy the acceptance link. Platform admins are the
          only inviters in v1.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" name="email" type="email" required />
            {state?.fields?.email?.length ? (
              <p className="text-sm text-destructive">{state.fields.email[0]}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-tenant-type">Scope</Label>
            <select
              id="invite-tenant-type"
              name="tenantType"
              value={tenantType}
              onChange={(event) =>
                setTenantType(event.target.value as "platform" | "partner" | "client")
              }
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
            >
              <option value="platform">Platform</option>
              <option value="partner">Partner</option>
              <option value="client">Client</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <select
              id="invite-role"
              name="role"
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
              defaultValue={roleOptions[0].value}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {tenantType !== "platform" ? (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="invite-tenant-id">
                {tenantType === "partner" ? "Partner" : "Client"}
              </Label>
              <select
                id="invite-tenant-id"
                name="tenantId"
                className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs"
                defaultValue=""
                required
              >
                <option value="" disabled>
                  Select {tenantType}
                </option>
                {tenantOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
              {state?.fields?.tenantId?.length ? (
                <p className="text-sm text-destructive">{state.fields.tenantId[0]}</p>
              ) : null}
            </div>
          ) : null}

          {state?.error ? <p className="text-sm text-destructive md:col-span-2">{state.error}</p> : null}
          {state?.success ? <p className="text-sm text-emerald-700 md:col-span-2">{state.success}</p> : null}
          {state?.inviteLink ? (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="invite-link">Acceptance link</Label>
              <div className="flex gap-2">
                <Input id="invite-link" readOnly value={state.inviteLink} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigator.clipboard.writeText(state.inviteLink ?? "")}
                >
                  Copy
                </Button>
              </div>
            </div>
          ) : null}
          <div className="md:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating invite..." : "Create invite"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
