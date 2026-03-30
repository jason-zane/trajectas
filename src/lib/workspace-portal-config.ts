export interface WorkspacePortalSection {
  title: string;
  description: string;
  highlights: string[];
  nextSteps?: string[];
}

export interface WorkspacePortalPageConfig {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    href: string;
  };
  secondaryAction?: {
    label: string;
    href: string;
  };
  sections: WorkspacePortalSection[];
}

export function resolveWorkspacePortalPageConfig(
  pages: Record<string, WorkspacePortalPageConfig>,
  pageKey: string
) {
  if (pages[pageKey]) {
    return pages[pageKey];
  }

  const baseKey = pageKey.split("/").filter(Boolean)[0] ?? "";
  return pages[baseKey] ?? null;
}

export const partnerPortalPages: Record<string, WorkspacePortalPageConfig> = {
  "": {
    eyebrow: "Partner Portal",
    title: "Operate clients across campaigns, assessments, and reporting.",
    description:
      "This surface is now distinct from platform admin. It is for partner-scoped client operations, not platform primitive authoring.",
    primaryAction: { label: "View clients", href: "/organizations" },
    secondaryAction: { label: "Review campaigns", href: "/campaigns" },
    sections: [
      {
        title: "Client operations",
        description:
          "Partner users can manage assigned clients and run campaign operations without crossing into platform settings.",
        highlights: [
          "Client and campaign visibility will remain partner-scoped.",
          "Published assessments can be assembled into client-ready programs.",
          "Participant information will remain limited to assigned client scope.",
        ],
      },
      {
        title: "What stays in platform admin",
        description:
          "AI controls, psychometrics, matching internals, candidate experience primitives, and assessment primitives stay upstream in admin.",
        highlights: [
          "No direct AI model or prompt controls.",
          "No direct item, factor, construct, or response-format authoring.",
          "No platform-wide settings or unrestricted client management.",
        ],
      },
    ],
  },
  organizations: {
    eyebrow: "Partner Portal",
    title: "Assigned clients",
    description:
      "This view is reserved for partner-managed client accounts and their scoped metadata.",
    primaryAction: { label: "Review campaigns", href: "/campaigns" },
    sections: [
      {
        title: "Client portfolio",
        description:
          "Partners will manage only the clients explicitly assigned to their partner context.",
        highlights: [
          "Client creation and deep account controls still begin in admin.",
          "Partner-level operators will get a scaled-down client management view.",
          "Support access remains auditable from platform admin.",
        ],
      },
    ],
  },
  assessments: {
    eyebrow: "Partner Portal",
    title: "Partner assessments",
    description:
      "Partners can assemble client-facing assessments from admin-published building blocks.",
    primaryAction: { label: "View results", href: "/results" },
    sections: [
      {
        title: "Assembly only",
        description:
          "Assessment authoring at this layer means composition, not primitive creation.",
        highlights: [
          "Published blocks can be selected and combined for client use.",
          "Platform-owned primitives remain locked to admin.",
          "Psychometric controls remain centralized.",
        ],
      },
    ],
  },
  campaigns: {
    eyebrow: "Partner Portal",
    title: "Partner campaigns",
    description:
      "Campaign operations belong here once clients and memberships are wired through the service layer.",
    primaryAction: { label: "View assigned clients", href: "/organizations" },
    secondaryAction: { label: "Open results", href: "/results" },
    sections: [
      {
        title: "Operational scope",
        description:
          "Campaign launching, monitoring, participant progress, and report readiness will be partner-scoped.",
        highlights: [
          "Campaign ownership stays client-scoped in the data model.",
          "Partner access is granted through memberships, not path assumptions.",
          "Exports will be governed separately from view permissions.",
        ],
      },
    ],
  },
  diagnostics: {
    eyebrow: "Partner Portal",
    title: "Diagnostic sessions",
    description:
      "Partners can run approved diagnostics for assigned clients without owning the diagnostic engine itself.",
    sections: [
      {
        title: "Template instantiation",
        description:
          "Diagnostics here will come from admin-defined templates and rules.",
        highlights: [
          "No diagnostic primitive editing at the partner layer.",
          "Session launch and respondent operations can happen here later.",
          "Diagnostic engine setup remains admin-only.",
        ],
      },
    ],
  },
  results: {
    eyebrow: "Partner Portal",
    title: "Results and reporting",
    description:
      "This area will hold partner-visible campaign and participant outcomes within assigned client scope.",
    primaryAction: { label: "Open diagnostics", href: "/diagnostics" },
    sections: [
      {
        title: "Reporting controls",
        description:
          "Viewing reports and exporting reports are separate capabilities in the target model.",
        highlights: [
          "Web reports and export reports are separate output contracts.",
          "Export events will be audited.",
          "Partner access will stay bounded to assigned client scope.",
        ],
      },
    ],
  },
  matching: {
    eyebrow: "Partner Portal",
    title: "Matching results",
    description:
      "Partners can consume matching outputs, but matching engine configuration remains in admin.",
    sections: [
      {
        title: "Consumer layer",
        description:
          "This surface is for interpreting published matching outputs rather than controlling the engine itself.",
        highlights: [
          "Matching internals remain platform-owned.",
          "Partner decisions consume approved engine behavior only.",
          "Any future tuning must still pass through admin controls.",
        ],
      },
    ],
  },
};

export const clientPortalPages: Record<string, WorkspacePortalPageConfig> = {
  "": {
    eyebrow: "Client Portal",
    title: "Run campaigns and review outcomes within a single client boundary.",
    description:
      "This surface is now distinct from admin and partner. It is for client-scoped campaign operation and reporting.",
    primaryAction: { label: "View campaigns", href: "/campaigns" },
    secondaryAction: { label: "Open results", href: "/results" },
    sections: [
      {
        title: "Client operations",
        description:
          "Client users can operate campaigns, monitor participants, and consume reports without accessing platform internals.",
        highlights: [
          "Only client-scoped data should be visible here.",
          "Campaigns, participants, and reports are the core jobs-to-be-done.",
          "Branding and limited client settings can live here later.",
        ],
      },
      {
        title: "What stays upstream",
        description:
          "Assessment primitives, AI controls, psychometrics, and matching internals remain in admin.",
        highlights: [
          "No direct primitive authoring at the client layer.",
          "No platform-level settings or cross-client access.",
          "No unrestricted exports without explicit policy.",
        ],
      },
    ],
  },
  campaigns: {
    eyebrow: "Client Portal",
    title: "Client campaigns",
    description:
      "This is the future home for campaign creation, monitoring, invitations, and participant progress within one client boundary.",
    primaryAction: { label: "Open results", href: "/results" },
    sections: [
      {
        title: "Scoped operations",
        description:
          "Everything in this surface stays inside the active client context.",
        highlights: [
          "Client memberships determine what campaigns are visible.",
          "Participant access stays token-first and separate from portal sessions.",
          "Invitation and report workflows will be audited.",
        ],
      },
    ],
  },
  diagnostics: {
    eyebrow: "Client Portal",
    title: "Diagnostic sessions",
    description:
      "Clients will launch approved diagnostics here using admin-defined templates and rules.",
    primaryAction: { label: "Open diagnostic results", href: "/diagnostic-results" },
    sections: [
      {
        title: "Approved templates only",
        description:
          "Diagnostic authoring stays in admin. Client users operate approved diagnostic sessions only.",
        highlights: [
          "No diagnostic engine configuration at this layer.",
          "Session operations and respondent management can live here.",
          "Template governance remains central.",
        ],
      },
    ],
  },
  assessments: {
    eyebrow: "Client Portal",
    title: "Client assessments",
    description:
      "Clients can operate assessments within their own boundary using published platform-approved building blocks.",
    primaryAction: { label: "Open campaigns", href: "/campaigns" },
    secondaryAction: { label: "View results", href: "/results" },
    sections: [
      {
        title: "Client-scoped usage",
        description:
          "This layer is for using and assembling approved assessments, not editing assessment primitives.",
        highlights: [
          "Assessment primitives remain admin-owned.",
          "Client teams can work with assessments already deployed inside their campaigns.",
          "Reporting and campaign operations stay inside the active client boundary.",
        ],
      },
    ],
  },
  "diagnostic-results": {
    eyebrow: "Client Portal",
    title: "Diagnostic reporting",
    description:
      "This area will present diagnostic outcomes and exports within client policy boundaries.",
    sections: [
      {
        title: "Report delivery",
        description:
          "Diagnostic reporting will share the same split between interactive web reports and governed export outputs.",
        highlights: [
          "View and export permissions are separate decisions.",
          "Export delivery is auditable.",
          "Client scope remains tenant-bound.",
        ],
      },
    ],
  },
  results: {
    eyebrow: "Client Portal",
    title: "Assessment results",
    description:
      "Client users will review participant outcomes and generated reports here once campaign data is fully scoped through memberships.",
    primaryAction: { label: "View campaigns", href: "/campaigns" },
    sections: [
      {
        title: "Result consumption",
        description:
          "This surface is for reviewing outcomes, not controlling the scoring engine or report template internals.",
        highlights: [
          "Assessment and diagnostic results stay client-scoped.",
          "PDF/export handling remains distinct from web rendering.",
          "Support access into this surface is logged through support sessions.",
        ],
      },
    ],
  },
};
