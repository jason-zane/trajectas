"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Trash2 } from "lucide-react"
import { DemographicsFieldsEditor } from "./demographics-fields-editor"
import { DEFAULT_PAGE_CONTENT } from "@/lib/experience/defaults"
import type {
  ExperiencePageType,
  PageContentMap,
  FlowConfig,
  DemographicsConfig,
  CustomPageContent,
} from "@/lib/experience/types"

interface PageContentEditorProps {
  pageId: string
  pageContent: Partial<PageContentMap>
  flowConfig: Partial<FlowConfig>
  demographicsConfig: DemographicsConfig
  customPageContent: Record<string, CustomPageContent>
  onUpdatePageField: (page: ExperiencePageType, field: string, value: unknown) => void
  onUpdateFlowEnabled: (page: keyof FlowConfig, enabled: boolean) => void
  onUpdateFlowConfig: (update: Partial<FlowConfig>) => void
  onUpdateDemographics: (config: DemographicsConfig) => void
  onUpdateCustomPage: (id: string, content: CustomPageContent) => void
  onDeleteCustomPage: (id: string) => void
  privacyUrl: string
  termsUrl: string
  onUpdatePrivacyUrl: (url: string) => void
  onUpdateTermsUrl: (url: string) => void
}

const TOGGLEABLE_PAGES: string[] = ["consent", "demographics", "review", "report"]

const PAGE_DESCRIPTIONS: Record<string, string> = {
  consent: "Requires participants to consent before proceeding",
  demographics: "Collects demographic data for norm grouping",
  review: "Shows participants a summary before submission",
  report: "Displays a report page after completion",
}

const BUILT_IN_PAGES = new Set([
  "join", "welcome", "consent", "demographics",
  "section_intro", "runner", "review", "complete", "report", "expired",
])

export function PageContentEditor({
  pageId,
  pageContent,
  flowConfig,
  demographicsConfig,
  customPageContent,
  onUpdatePageField,
  onUpdateFlowEnabled,
  onUpdateFlowConfig,
  onUpdateDemographics,
  onUpdateCustomPage,
  onDeleteCustomPage,
  privacyUrl,
  termsUrl,
  onUpdatePrivacyUrl,
  onUpdateTermsUrl,
}: PageContentEditorProps) {
  // Global settings view
  if (pageId === "__settings__") {
    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-sm font-semibold">Global Settings</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Settings that apply across the entire participant experience.
          </p>
        </div>

        <Separator />

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">Legal Links</p>
            <p className="text-xs text-muted-foreground">
              Shown as small links in the footer of all participant-facing pages.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Privacy Policy URL</Label>
            <Input
              type="url"
              value={privacyUrl}
              onChange={(e) => onUpdatePrivacyUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Terms of Service URL</Label>
            <Input
              type="url"
              value={termsUrl}
              onChange={(e) => onUpdateTermsUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
      </div>
    )
  }

  const isCustom = !BUILT_IN_PAGES.has(pageId)

  if (isCustom) {
    return (
      <CustomPageEditor
        pageId={pageId}
        content={customPageContent[pageId] ?? { heading: "", body: "", buttonLabel: "Continue" }}
        customLabel={flowConfig.customPages?.find((cp) => cp.id === pageId)?.label ?? pageId}
        onUpdate={(content) => onUpdateCustomPage(pageId, content)}
        onDelete={() => onDeleteCustomPage(pageId)}
      />
    )
  }

  const page = pageId as ExperiencePageType
  const content = pageContent[page] ?? (DEFAULT_PAGE_CONTENT as PageContentMap)[page]
  if (!content) return null

  const entries = Object.entries(content).filter(
    ([key, value]) => key !== "reportMode" && typeof value !== "boolean"
  )

  return (
    <div className="space-y-5">
      {/* Enable/disable toggle */}
      {TOGGLEABLE_PAGES.includes(page) && (
        <div className="flex items-center justify-between rounded-lg border border-border p-4">
          <div>
            <p className="text-sm font-medium">Enable this page</p>
            {PAGE_DESCRIPTIONS[page] && (
              <p className="text-xs text-muted-foreground">
                {PAGE_DESCRIPTIONS[page]}
              </p>
            )}
          </div>
          <Switch
            checked={
              (flowConfig[page as keyof FlowConfig] as { enabled: boolean })
                ?.enabled ?? false
            }
            onCheckedChange={(v) =>
              onUpdateFlowEnabled(page as keyof FlowConfig, v)
            }
          />
        </div>
      )}

      {/* Content fields */}
      {entries.map(([key, value]) => {
        if (Array.isArray(value)) {
          return (
            <div key={key} className="space-y-2">
              <Label className="capitalize">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </Label>
              {(value as string[]).map((item, idx) => (
                <Input
                  key={idx}
                  value={item}
                  onChange={(e) => {
                    const arr = [...(value as string[])]
                    arr[idx] = e.target.value
                    onUpdatePageField(page, key, arr)
                  }}
                />
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onUpdatePageField(page, key, [...(value as string[]), ""])
                }}
              >
                + Add item
              </Button>
            </div>
          )
        }

        if (
          key === "body" ||
          key === "incompleteWarning" ||
          key === "consentCheckboxLabel"
        ) {
          return (
            <div key={key} className="space-y-1.5">
              <Label className="capitalize">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </Label>
              <Textarea
                rows={key === "body" ? 6 : 3}
                value={(value as string) ?? ""}
                onChange={(e) => onUpdatePageField(page, key, e.target.value)}
              />
            </div>
          )
        }

        if (typeof value === "string") {
          return (
            <div key={key} className="space-y-1.5">
              <Label className="capitalize">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </Label>
              <Input
                value={value}
                onChange={(e) => onUpdatePageField(page, key, e.target.value)}
              />
              {(value.includes("{{") || key === "eyebrow" || key === "heading") && (
                <p className="text-xs text-muted-foreground">
                  Variables: {"{{participantName}}"}, {"{{campaignTitle}}"},{" "}
                  {"{{campaignDescription}}"}, {"{{assessmentCount}}"},{" "}
                  {"{{organizationName}}"}
                  {page === "section_intro" && (
                    <>, {"{{sectionTitle}}"}, {"{{sectionNumber}}"}</>
                  )}
                </p>
              )}
            </div>
          )
        }

        return null
      })}

      {/* Report mode selector */}
      {page === "report" && (
        <>
          <div className="space-y-1.5">
            <Label>Report Mode</Label>
            <div className="flex gap-2">
              {(["holding", "view_results"] as const).map((mode) => (
                <Button
                  key={mode}
                  size="sm"
                  variant={
                    (flowConfig.report as { reportMode?: string })?.reportMode === mode
                      ? "default"
                      : "outline"
                  }
                  onClick={() =>
                    onUpdateFlowConfig({
                      ...flowConfig,
                      report: { ...flowConfig.report!, reportMode: mode },
                    })
                  }
                >
                  {mode === "holding" ? "Holding Page" : "View Results"}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              &quot;Holding Page&quot; shows a message that the report is being
              prepared. &quot;View Results&quot; lets participants see their scores.
            </p>
          </div>
          <p className="text-xs text-muted-foreground rounded-md border border-border bg-muted/50 p-3">
            When both Report and Complete are enabled, the one ordered first in the sidebar
            shows immediately after submission. The other is accessible via a Continue button.
          </p>
        </>
      )}

      {/* Redirect URL fields for Complete and Report */}
      {(page === "complete" || page === "report") && (
        <>
          <Separator />
          <div className="space-y-4 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">Post-completion Redirect</p>
              <p className="text-xs text-muted-foreground">
                Redirect participants to an external URL (e.g. survey, portal, scheduling link) after a 5-second countdown.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Redirect URL</Label>
              <Input
                type="url"
                value={(content as { redirectUrl?: string }).redirectUrl ?? ""}
                onChange={(e) => onUpdatePageField(page, "redirectUrl", e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Redirect Label</Label>
              <Input
                value={(content as { redirectLabel?: string }).redirectLabel ?? ""}
                onChange={(e) => onUpdatePageField(page, "redirectLabel", e.target.value)}
                placeholder="You will be redirected shortly..."
              />
              <p className="text-xs text-muted-foreground">
                Shown to the participant during the countdown. Leave blank for the default message.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Demographics: inline field configurator */}
      {page === "demographics" && (
        <>
          <Separator />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Field Configuration</h3>
            <DemographicsFieldsEditor
              config={demographicsConfig}
              onChange={onUpdateDemographics}
            />
          </div>
        </>
      )}

      {/* Join: marketing consent configuration */}
      {page === "join" && (
        <>
          <Separator />
          <div className="space-y-4 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Marketing Consent</p>
                <p className="text-xs text-muted-foreground">
                  Show an opt-in checkbox on the join page
                </p>
              </div>
              <Switch
                checked={(content as { marketingConsentEnabled?: boolean }).marketingConsentEnabled ?? false}
                onCheckedChange={(v) => onUpdatePageField(page, "marketingConsentEnabled", v)}
              />
            </div>

            {(content as { marketingConsentEnabled?: boolean }).marketingConsentEnabled && (
              <div className="space-y-4 pl-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Required</p>
                    <p className="text-xs text-muted-foreground">
                      Participants must check the box to proceed
                    </p>
                  </div>
                  <Switch
                    checked={(content as { marketingConsentRequired?: boolean }).marketingConsentRequired ?? false}
                    onCheckedChange={(v) => onUpdatePageField(page, "marketingConsentRequired", v)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Consent Label</Label>
                  <Textarea
                    rows={2}
                    value={(content as { marketingConsentLabel?: string }).marketingConsentLabel ?? ""}
                    onChange={(e) => onUpdatePageField(page, "marketingConsentLabel", e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** Editor for custom pages. */
function CustomPageEditor({
  pageId,
  content,
  customLabel,
  onUpdate,
  onDelete,
}: {
  pageId: string
  content: CustomPageContent
  customLabel: string
  onUpdate: (content: CustomPageContent) => void
  onDelete: () => void
}) {
  function update(field: keyof CustomPageContent, value: string) {
    onUpdate({ ...content, [field]: value })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{customLabel}</h3>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={onDelete}
        >
          <Trash2 className="size-3.5 mr-1.5" />
          Delete Page
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label>Eyebrow</Label>
        <Input
          value={content.eyebrow ?? ""}
          onChange={(e) => update("eyebrow", e.target.value)}
          placeholder="Optional small text above heading"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Heading</Label>
        <Input
          value={content.heading}
          onChange={(e) => update("heading", e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Body</Label>
        <Textarea
          rows={6}
          value={content.body}
          onChange={(e) => update("body", e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Button Label</Label>
        <Input
          value={content.buttonLabel}
          onChange={(e) => update("buttonLabel", e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Footer Text</Label>
        <Input
          value={content.footerText ?? ""}
          onChange={(e) => update("footerText", e.target.value)}
          placeholder="Optional footer text"
        />
      </div>
    </div>
  )
}
