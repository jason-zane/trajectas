import type { Surface, WorkspaceSurface } from "@/lib/surfaces";
import type { UserRole } from "@/types/database";

export type TenantType = "partner" | "client";
export type MembershipRole = "admin" | "member";

export interface PartnerMembershipRecord {
  id: string;
  partnerId: string;
  role: MembershipRole;
  isDefault: boolean;
  createdAt: string;
}

export interface ClientMembershipRecord {
  id: string;
  clientId: string;
  role: MembershipRole;
  isDefault: boolean;
  createdAt: string;
}

export interface ActiveContext {
  surface: WorkspaceSurface;
  tenantType?: TenantType;
  tenantId?: string;
  membershipId?: string;
  supportSessionId?: string;
}

export interface PreviewContext {
  surface: Extract<WorkspaceSurface, "partner" | "client">;
  tenantType?: TenantType;
  tenantId?: string;
  membershipId?: string;
}

export interface ResolvedActor {
  id: string;
  email: string;
  role: UserRole;
  displayName?: string | null;
  isActive: boolean;
  partnerMemberships: PartnerMembershipRecord[];
  clientMemberships: ClientMembershipRecord[];
  activeContext: ActiveContext | null;
}

export interface SupportSessionInput {
  actorProfileId: string;
  targetSurface: Extract<Surface, "partner" | "client">;
  targetTenantId: string;
  reason: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface SupportSessionRecord {
  id: string;
  actorProfileId: string;
  targetSurface: Extract<Surface, "partner" | "client">;
  targetTenantId: string;
  reason: string;
  sessionKey: string;
  createdAt: string;
  expiresAt: string;
  endedAt?: string | null;
  metadata: Record<string, unknown>;
}

export interface AuditEventInput {
  actorProfileId?: string | null;
  eventType: string;
  targetTable?: string | null;
  targetId?: string | null;
  partnerId?: string | null;
  clientId?: string | null;
  supportSessionId?: string | null;
  metadata?: Record<string, unknown>;
}
