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
    title: "Welcome to your partner workspace",
    description: "Manage clients, campaigns, and participant outcomes.",
    primaryAction: { label: "View clients", href: "/clients" },
    secondaryAction: { label: "Review campaigns", href: "/campaigns" },
    sections: [
      {
        title: "Client operations",
        description: "Manage assigned clients and run campaign operations.",
        highlights: [
          "View and manage your assigned client portfolio.",
          "Deploy assessments into client-ready campaigns.",
          "Track participant progress and outcomes.",
        ],
      },
    ],
  },
  clients: {
    eyebrow: "Clients",
    title: "Client portfolio",
    description: "Manage your assigned client accounts.",
    primaryAction: { label: "Review campaigns", href: "/campaigns" },
    sections: [
      {
        title: "Client portfolio",
        description: "View and manage clients assigned to your partner account.",
        highlights: [
          "Track client status, industry, and size.",
          "View campaign and diagnostic activity per client.",
          "Access client-scoped reporting.",
        ],
      },
    ],
  },
  assessments: {
    eyebrow: "Assessments",
    title: "Assessments",
    description: "Assessments deployed across your client campaigns.",
    primaryAction: { label: "View participants", href: "/participants" },
    sections: [
      {
        title: "Assessment library",
        description: "Browse assessments available for your client campaigns.",
        highlights: [
          "View assessment status and deployment counts.",
          "See which clients and campaigns use each assessment.",
          "Track participant completion rates.",
        ],
      },
    ],
  },
  campaigns: {
    eyebrow: "Campaigns",
    title: "Campaigns",
    description: "Assessment campaigns across your client portfolio.",
    primaryAction: { label: "View clients", href: "/clients" },
    secondaryAction: { label: "View participants", href: "/participants" },
    sections: [
      {
        title: "Campaign management",
        description: "Monitor and manage assessment campaigns for your clients.",
        highlights: [
          "Track campaign status and participant progress.",
          "View assessment lineups per campaign.",
          "Access participant reports and exports.",
        ],
      },
    ],
  },
  participants: {
    eyebrow: "Participants",
    title: "Participants",
    description: "All participants across your campaigns.",
    primaryAction: { label: "View campaigns", href: "/campaigns" },
    sections: [
      {
        title: "Participant tracking",
        description: "Monitor participant progress across all campaigns.",
        highlights: [
          "View participant status and completion progress.",
          "Access individual participant reports.",
          "Export participant data.",
        ],
      },
    ],
  },
  diagnostics: {
    eyebrow: "Diagnostics",
    title: "Diagnostic sessions",
    description: "Run diagnostic sessions for your assigned clients.",
    sections: [
      {
        title: "Diagnostic sessions",
        description: "View and manage diagnostic sessions.",
        highlights: [
          "Track session status and respondent progress.",
          "View results for completed sessions.",
        ],
      },
    ],
  },
  results: {
    eyebrow: "Results",
    title: "Results and reporting",
    description: "Campaign and participant outcomes across your client portfolio.",
    primaryAction: { label: "View campaigns", href: "/campaigns" },
    sections: [
      {
        title: "Reporting",
        description: "Access campaign results and participant reports.",
        highlights: [
          "View completed campaign outcomes.",
          "Launch participant reports.",
          "Export reports for offline use.",
        ],
      },
    ],
  },
  matching: {
    eyebrow: "Matching",
    title: "Matching results",
    description: "AI matching recommendations for your clients.",
    sections: [
      {
        title: "Matching outputs",
        description: "Review published matching recommendations.",
        highlights: [
          "View matching run status and results.",
          "See top factor recommendations per session.",
        ],
      },
    ],
  },
};

export const clientPortalPages: Record<string, WorkspacePortalPageConfig> = {
  "": {
    eyebrow: "Client Portal",
    title: "Welcome to your client workspace",
    description: "Run campaigns, track participants, and review outcomes.",
    primaryAction: { label: "View campaigns", href: "/campaigns" },
    secondaryAction: { label: "View participants", href: "/participants" },
    sections: [
      {
        title: "Client operations",
        description: "Operate campaigns, monitor participants, and access reports.",
        highlights: [
          "Launch and monitor assessment campaigns.",
          "Track participant progress and completion.",
          "Access reports and outcomes.",
        ],
      },
    ],
  },
  assessments: {
    eyebrow: "Assessments",
    title: "Assessment library",
    description: "Review the assessments available to launch in your campaigns.",
    primaryAction: { label: "View campaigns", href: "/campaigns" },
    secondaryAction: { label: "Create campaign", href: "/campaigns/create" },
    sections: [
      {
        title: "Assigned assessments",
        description: "Browse the assessments your organisation can deploy.",
        highlights: [
          "Review assessment structure before launch.",
          "See quota availability and usage.",
          "Jump straight into a new campaign with a chosen assessment.",
        ],
      },
    ],
  },
  results: {
    eyebrow: "Results",
    title: "Results and reporting",
    description: "Campaign and participant outcomes for your organisation.",
    primaryAction: { label: "View campaigns", href: "/campaigns" },
    secondaryAction: { label: "View diagnostics", href: "/diagnostics" },
    sections: [
      {
        title: "Reporting",
        description: "Access campaign results and participant reports.",
        highlights: [
          "View completed campaign outcomes.",
          "Launch participant reports.",
          "Export reports for offline use.",
        ],
      },
    ],
  },
};
