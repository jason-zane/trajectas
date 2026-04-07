"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Cable,
  Copy,
  KeyRound,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Webhook,
} from "lucide-react";

import type { ClientInternalIntegrationSettings } from "@/app/actions/integrations";
import {
  createInternalIntegrationCredentialAction,
  createInternalWebhookEndpointAction,
  revokeInternalIntegrationCredentialAction,
  rotateInternalWebhookEndpointSecretAction,
  updateInternalWebhookEndpointAction,
} from "@/app/actions/integrations";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { INTEGRATION_EVENT_TYPES } from "@/lib/integrations/events";
import { INTEGRATION_API_SCOPES } from "@/lib/integrations/types";

interface ClientIntegrationsPanelProps {
  clientId: string;
  clientSlug: string;
  settings: ClientInternalIntegrationSettings;
}

type CredentialFormState = {
  label: string;
  scopes: string[];
};

type WebhookFormState = {
  endpointId?: string;
  label: string;
  url: string;
  subscribedEvents: string[];
  status: "active" | "inactive";
};

const DEFAULT_CREDENTIAL_SCOPES = [...INTEGRATION_API_SCOPES];
const EVENT_LABELS: Record<string, string> = {
  "integration.launch.created": "Assessment launch created",
  "integration.assessment.completed": "Assessment completed",
  "integration.report.ready": "Report ready",
  "integration.report.released": "Report released",
};

function formatTimestamp(value: string | null) {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function humanizeScope(scope: string) {
  const [resource, action] = scope.split(":");
  return `${resource.replace(/_/g, " ")} ${action}`;
}

function copySecret(text: string, label: string) {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    toast.error(`Copy ${label} manually from this page.`);
    return;
  }

  void navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied`),
    () => toast.error(`Failed to copy ${label}`),
  );
}

function SecretRevealAlert(props: {
  title: string;
  description: string;
  secret: string;
  copyLabel: string;
  onDismiss: () => void;
}) {
  return (
    <Alert className="border-primary/20 bg-primary/[0.03]">
      <ShieldCheck className="size-4 text-primary" />
      <AlertTitle>{props.title}</AlertTitle>
      <AlertDescription>
        <p>{props.description}</p>
        <p className="rounded-md bg-background/80 px-3 py-2 font-mono text-xs break-all text-foreground">
          {props.secret}
        </p>
      </AlertDescription>
      <AlertAction className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => copySecret(props.secret, props.copyLabel)}
        >
          <Copy data-icon="inline-start" />
          Copy
        </Button>
        <Button variant="ghost" size="sm" onClick={props.onDismiss}>
          Dismiss
        </Button>
      </AlertAction>
    </Alert>
  );
}

function CredentialDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: CredentialFormState;
  onChange: (next: CredentialFormState) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create API credential</DialogTitle>
          <DialogDescription>
            Create a machine credential for the private internal integrations API.
            The full key is shown once after creation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="credential-label">Label</Label>
            <Input
              id="credential-label"
              value={props.value.label}
              onChange={(event) =>
                props.onChange({
                  ...props.value,
                  label: event.target.value,
                })
              }
              placeholder="Greenhouse sandbox"
              disabled={props.pending}
            />
          </div>

          <div className="space-y-2">
            <Label>Scopes</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {INTEGRATION_API_SCOPES.map((scope) => {
                const checked = props.value.scopes.includes(scope);
                return (
                  <label
                    key={scope}
                    className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(nextChecked) => {
                        props.onChange({
                          ...props.value,
                          scopes: nextChecked
                            ? [...props.value.scopes, scope]
                            : props.value.scopes.filter((value) => value !== scope),
                        });
                      }}
                      disabled={props.pending}
                    />
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium capitalize">{humanizeScope(scope)}</p>
                      <p className="text-xs text-muted-foreground font-mono">{scope}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={props.pending}>
            Cancel
          </Button>
          <Button
            onClick={props.onSubmit}
            disabled={props.pending || !props.value.label.trim() || props.value.scopes.length === 0}
          >
            {props.pending ? "Creating…" : "Create Credential"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WebhookEndpointDialog(props: {
  open: boolean;
  mode: "create" | "edit";
  value: WebhookFormState;
  onOpenChange: (open: boolean) => void;
  onChange: (next: WebhookFormState) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{props.mode === "create" ? "Add webhook endpoint" : "Edit webhook endpoint"}</DialogTitle>
          <DialogDescription>
            Trajectas will send signed JSON event payloads to this URL. Use HTTPS unless you are testing locally.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="webhook-label">Label</Label>
              <Input
                id="webhook-label"
                value={props.value.label}
                onChange={(event) =>
                  props.onChange({
                    ...props.value,
                    label: event.target.value,
                  })
                }
                placeholder="Greenhouse webhook"
                disabled={props.pending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Destination URL</Label>
              <Input
                id="webhook-url"
                type="url"
                value={props.value.url}
                onChange={(event) =>
                  props.onChange({
                    ...props.value,
                    url: event.target.value,
                  })
                }
                placeholder="https://example.com/hooks/trajectas"
                disabled={props.pending}
              />
            </div>
          </div>

          {props.mode === "edit" && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-background/60 px-3 py-2">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">Endpoint active</p>
                <p className="text-xs text-muted-foreground">
                  Inactive endpoints stay saved but will not receive deliveries.
                </p>
              </div>
              <Switch
                checked={props.value.status === "active"}
                onCheckedChange={(checked) =>
                  props.onChange({
                    ...props.value,
                    status: checked ? "active" : "inactive",
                  })
                }
                disabled={props.pending}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Subscribed events</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {INTEGRATION_EVENT_TYPES.map((eventType) => {
                const checked = props.value.subscribedEvents.includes(eventType);
                return (
                  <label
                    key={eventType}
                    className="flex items-start gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(nextChecked) =>
                        props.onChange({
                          ...props.value,
                          subscribedEvents: nextChecked
                            ? [...props.value.subscribedEvents, eventType]
                            : props.value.subscribedEvents.filter((value) => value !== eventType),
                        })
                      }
                      disabled={props.pending}
                    />
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{EVENT_LABELS[eventType]}</p>
                      <p className="text-xs text-muted-foreground font-mono">{eventType}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={props.pending}>
            Cancel
          </Button>
          <Button
            onClick={props.onSubmit}
            disabled={
              props.pending ||
              !props.value.label.trim() ||
              !props.value.url.trim() ||
              props.value.subscribedEvents.length === 0
            }
          >
            {props.pending
              ? props.mode === "create"
                ? "Creating…"
                : "Saving…"
              : props.mode === "create"
                ? "Create Endpoint"
                : "Save Endpoint"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ClientIntegrationsPanel({
  clientId,
  clientSlug,
  settings,
}: ClientIntegrationsPanelProps) {
  const router = useRouter();
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false);
  const [endpointDialogOpen, setEndpointDialogOpen] = useState(false);
  const [credentialForm, setCredentialForm] = useState<CredentialFormState>({
    label: "",
    scopes: DEFAULT_CREDENTIAL_SCOPES,
  });
  const [endpointForm, setEndpointForm] = useState<WebhookFormState>({
    label: "",
    url: "",
    subscribedEvents: [...INTEGRATION_EVENT_TYPES],
    status: "active",
  });
  const [secretReveal, setSecretReveal] = useState<{
    kind: "apiKey" | "signingSecret";
    value: string;
    label: string;
  } | null>(null);
  const [credentialToRevoke, setCredentialToRevoke] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [pendingAction, startTransition] = useTransition();

  const editingEndpoint = useMemo(
    () =>
      endpointDialogOpen && endpointForm.endpointId
        ? settings.webhookEndpoints.find((endpoint) => endpoint.id === endpointForm.endpointId) ?? null
        : null,
    [endpointDialogOpen, endpointForm.endpointId, settings.webhookEndpoints],
  );

  function refreshAfterSuccess() {
    router.refresh();
  }

  function resetCredentialForm() {
    setCredentialForm({
      label: "",
      scopes: DEFAULT_CREDENTIAL_SCOPES,
    });
  }

  function resetEndpointForm() {
    setEndpointForm({
      label: "",
      url: "",
      subscribedEvents: [...INTEGRATION_EVENT_TYPES],
      status: "active",
    });
  }

  function handleCreateCredential() {
    startTransition(async () => {
      const result = await createInternalIntegrationCredentialAction({
        clientId,
        clientSlug,
        label: credentialForm.label,
        scopes: credentialForm.scopes as typeof INTEGRATION_API_SCOPES[number][],
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      setSecretReveal({
        kind: "apiKey",
        value: result.apiKey,
        label: credentialForm.label.trim(),
      });
      toast.success("Integration credential created");
      setCredentialDialogOpen(false);
      resetCredentialForm();
      refreshAfterSuccess();
    });
  }

  function handleSaveEndpoint() {
    startTransition(async () => {
      const payload = {
        clientId,
        clientSlug,
        label: endpointForm.label,
        url: endpointForm.url,
        subscribedEvents: endpointForm.subscribedEvents as typeof INTEGRATION_EVENT_TYPES[number][],
      };

      const result = endpointForm.endpointId
        ? await updateInternalWebhookEndpointAction({
            ...payload,
            endpointId: endpointForm.endpointId,
            status: endpointForm.status,
          })
        : await createInternalWebhookEndpointAction(payload);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if ("signingSecret" in result && typeof result.signingSecret === "string") {
        setSecretReveal({
          kind: "signingSecret",
          value: result.signingSecret,
          label: endpointForm.label.trim(),
        });
      }

      toast.success(endpointForm.endpointId ? "Webhook endpoint updated" : "Webhook endpoint created");
      setEndpointDialogOpen(false);
      resetEndpointForm();
      refreshAfterSuccess();
    });
  }

  function handleRotateSecret(endpointId: string, label: string) {
    startTransition(async () => {
      const result = await rotateInternalWebhookEndpointSecretAction({
        clientId,
        clientSlug,
        endpointId,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      setSecretReveal({
        kind: "signingSecret",
        value: result.signingSecret,
        label,
      });
      toast.success("Webhook signing secret rotated");
      refreshAfterSuccess();
    });
  }

  function handleRevokeCredential() {
    if (!credentialToRevoke) return;

    startTransition(async () => {
      const result = await revokeInternalIntegrationCredentialAction({
        clientId,
        clientSlug,
        credentialId: credentialToRevoke.id,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Integration credential revoked");
      setCredentialToRevoke(null);
      refreshAfterSuccess();
    });
  }

  if (!settings.canManage) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-2">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Cable className="size-4" />
          </div>
          <div>
            <p className="font-semibold text-sm">Integrations</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Only client admins, partner admins for this client’s partner, and platform admins can
              manage API credentials and webhook endpoints.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {secretReveal ? (
        <SecretRevealAlert
          title={secretReveal.kind === "apiKey" ? "Copy the API key now" : "Copy the signing secret now"}
          description={
            secretReveal.kind === "apiKey"
              ? `The full credential for ${secretReveal.label} is only shown once. Save it in your ATS or middleware configuration before leaving this page.`
              : `The signing secret for ${secretReveal.label} is only shown once. Save it in your webhook receiver before leaving this page.`
          }
          secret={secretReveal.value}
          copyLabel={secretReveal.kind === "apiKey" ? "API key" : "signing secret"}
          onDismiss={() => setSecretReveal(null)}
        />
      ) : null}

      <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <KeyRound className="size-4" />
            </div>
            <div>
              <p className="font-semibold text-sm">Internal API credentials</p>
              <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
                Issue machine credentials for the private ATS integrations API. Keys are hashed at rest
                and the full value is only shown once when created.
              </p>
            </div>
          </div>

          <Button onClick={() => setCredentialDialogOpen(true)} disabled={pendingAction}>
            <KeyRound data-icon="inline-start" />
            Create API Key
          </Button>
        </div>

        {settings.credentials.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No API credentials have been created for this client yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Key prefix</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.credentials.map((credential) => (
                <TableRow key={credential.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{credential.label}</p>
                      <p className="text-xs text-muted-foreground">
                        Created {formatTimestamp(credential.createdAt)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{credential.keyPrefix}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {credential.scopes.map((scope) => (
                        <Badge key={scope} variant="outline" className="font-mono text-[11px]">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={credential.status === "active" ? "outline" : "secondary"}>
                      {credential.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatTimestamp(credential.lastUsedAt)}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pendingAction || credential.status !== "active"}
                      onClick={() =>
                        setCredentialToRevoke({
                          id: credential.id,
                          label: credential.label,
                        })
                      }
                    >
                      Revoke
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm p-6 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Webhook className="size-4" />
            </div>
            <div>
              <p className="font-semibold text-sm">Webhook endpoints</p>
              <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
                Receive launch, completion, and report lifecycle events from Trajectas. Secrets are
                encrypted at rest and can be rotated without recreating the endpoint.
              </p>
            </div>
          </div>

          <Button
            onClick={() => {
              resetEndpointForm();
              setEndpointDialogOpen(true);
            }}
            disabled={pendingAction}
          >
            <Webhook data-icon="inline-start" />
            Add Endpoint
          </Button>
        </div>

        {settings.webhookEndpoints.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No webhook endpoints have been configured for this client yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Endpoint</TableHead>
                <TableHead>Subscribed events</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last delivery</TableHead>
                <TableHead>Secret version</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.webhookEndpoints.map((endpoint) => (
                <TableRow key={endpoint.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{endpoint.label}</p>
                      <p className="text-xs text-muted-foreground break-all">{endpoint.url}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {endpoint.subscribedEvents.map((eventType) => (
                        <Badge key={eventType} variant="outline" className="font-mono text-[11px]">
                          {eventType}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={endpoint.status === "active" ? "outline" : "secondary"}>
                      {endpoint.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatTimestamp(endpoint.lastDeliveryAt)}</TableCell>
                  <TableCell>v{endpoint.signingSecretKeyVersion}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingAction}
                        onClick={() => {
                          setEndpointForm({
                            endpointId: endpoint.id,
                            label: endpoint.label,
                            url: endpoint.url,
                            subscribedEvents: endpoint.subscribedEvents,
                            status: endpoint.status,
                          });
                          setEndpointDialogOpen(true);
                        }}
                      >
                        <Pencil data-icon="inline-start" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingAction}
                        onClick={() => handleRotateSecret(endpoint.id, endpoint.label)}
                      >
                        <RotateCcw data-icon="inline-start" />
                        Rotate Secret
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <CredentialDialog
        open={credentialDialogOpen}
        onOpenChange={(open) => {
          setCredentialDialogOpen(open);
          if (!open) resetCredentialForm();
        }}
        value={credentialForm}
        onChange={setCredentialForm}
        onSubmit={handleCreateCredential}
        pending={pendingAction}
      />

      <WebhookEndpointDialog
        open={endpointDialogOpen}
        mode={editingEndpoint ? "edit" : "create"}
        value={endpointForm}
        onOpenChange={(open) => {
          setEndpointDialogOpen(open);
          if (!open) resetEndpointForm();
        }}
        onChange={setEndpointForm}
        onSubmit={handleSaveEndpoint}
        pending={pendingAction}
      />

      <ConfirmDialog
        open={Boolean(credentialToRevoke)}
        onOpenChange={(open) => {
          if (!open) setCredentialToRevoke(null);
        }}
        title="Revoke integration credential?"
        description={
          credentialToRevoke
            ? `This will permanently revoke ${credentialToRevoke.label}. Any ATS or middleware using that API key will stop working until a replacement key is issued.`
            : ""
        }
        confirmLabel="Revoke Credential"
        variant="destructive"
        onConfirm={handleRevokeCredential}
        loading={pendingAction}
      />
    </div>
  );
}
