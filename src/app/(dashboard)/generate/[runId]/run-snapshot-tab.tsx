"use client"

import React from "react"
import Link from "next/link"
import { ExternalLink, Wand2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { GenerationRun } from "@/types/database"

/**
 * Run snapshot — the "rerun this exact configuration" view.
 *
 * Reproducibility surface: every steering input, the resolved playbook,
 * the models, the prompts, and the network parameters used. This is the
 * tab you read when you want to know what made an item set what it is.
 */
export function RunSnapshotTab({
  run,
  responseFormatLabel,
  promptLabels,
}: {
  run: GenerationRun
  responseFormatLabel?: string
  promptLabels?: Partial<Record<string, string>>
}) {
  const c = run.config
  const ai = run.aiSnapshot
  const playbook = c.playbookSnapshot

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Steering */}
      <Section
        title="Steering"
        subtitle="The fields fed into the generation and critique prompts."
      >
        <KvList>
          <Kv label="Measurement mode">
            {c.measurementMode ? (
              <Badge variant="secondary" className="capitalize">
                {c.measurementMode}
              </Badge>
            ) : (
              <Muted>Default (behavioural)</Muted>
            )}
          </Kv>
          {c.measurementMode === "open" && c.measurementModeDescription && (
            <Kv label="Mode description">
              <Prose text={c.measurementModeDescription} />
            </Kv>
          )}
          <Kv label="Audience">
            {c.audience?.level ? (
              <span>
                <Badge variant="outline" className="capitalize">
                  {c.audience.level}
                </Badge>
                {c.audience.description && (
                  <span className="ml-2 text-muted-foreground text-sm">
                    — {c.audience.description}
                  </span>
                )}
              </span>
            ) : c.audience?.description ? (
              <span className="text-sm">{c.audience.description}</span>
            ) : (
              <Muted>Not set</Muted>
            )}
          </Kv>
          <Kv label="Use context">
            {c.useContext ? (
              <Badge variant="outline" className="capitalize">
                {c.useContext}
              </Badge>
            ) : (
              <Muted>Not set</Muted>
            )}
          </Kv>
          {c.useContext === "open" && c.useContextDescription && (
            <Kv label="Use context description">
              <Prose text={c.useContextDescription} />
            </Kv>
          )}
          <Kv label="Rating scale">
            {responseFormatLabel ? (
              <span className="text-sm">{responseFormatLabel}</span>
            ) : c.responseFormatId ? (
              <code className="text-xs">{c.responseFormatId}</code>
            ) : (
              <Muted>Not set</Muted>
            )}
          </Kv>
        </KvList>
      </Section>

      {/* Playbook */}
      <Section
        title="Playbook"
        subtitle="The rubric and exemplars injected into the prompts at run time."
      >
        {!playbook ? (
          <Muted>No playbook was attached to this run.</Muted>
        ) : (
          <div className="space-y-4">
            <KvList>
              <Kv label="Source preset">
                {playbook.sourcePresetId ? (
                  <Link
                    href={`/generate/presets/${playbook.sourcePresetId}`}
                    className="inline-flex items-center gap-1 text-sm hover:underline"
                  >
                    <Wand2 className="size-3" />
                    {playbook.sourcePresetName ?? "playbook"}
                    <ExternalLink className="size-3 text-muted-foreground" />
                  </Link>
                ) : playbook.sourcePresetName ? (
                  <span className="text-sm">
                    <Wand2 className="inline size-3 mr-1" />
                    {playbook.sourcePresetName}
                    <span className="text-muted-foreground"> (deleted)</span>
                  </span>
                ) : (
                  <Muted>Ad-hoc (not from a saved preset)</Muted>
                )}
                {playbook.modifiedFromPreset && (
                  <Badge variant="outline" className="ml-2 text-[10px] uppercase">
                    edited
                  </Badge>
                )}
              </Kv>
              {playbook.critiqueStrictness && (
                <Kv label="Critique strictness">
                  <Badge variant="outline" className="capitalize">
                    {playbook.critiqueStrictness}
                  </Badge>
                </Kv>
              )}
              {playbook.sdTolerance && (
                <Kv label="SD tolerance">
                  <Badge variant="outline" className="capitalize">
                    {playbook.sdTolerance}
                  </Badge>
                </Kv>
              )}
              {playbook.difficultyMix && (
                <Kv label="Difficulty mix">
                  <span className="text-sm tabular-nums">
                    {[
                      typeof playbook.difficultyMix.easy === "number" &&
                        `${Math.round(playbook.difficultyMix.easy * 100)}% easy`,
                      typeof playbook.difficultyMix.moderate === "number" &&
                        `${Math.round(playbook.difficultyMix.moderate * 100)}% mod`,
                      typeof playbook.difficultyMix.hard === "number" &&
                        `${Math.round(playbook.difficultyMix.hard * 100)}% hard`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </Kv>
              )}
            </KvList>

            {playbook.critiqueEmphasis && (
              <div className="space-y-1">
                <p className="text-overline text-gold">Critique emphasis</p>
                <Prose text={playbook.critiqueEmphasis} />
              </div>
            )}

            {playbook.rubric && (
              <div className="space-y-1">
                <p className="text-overline text-gold">Writing rubric</p>
                <pre className="whitespace-pre-wrap font-mono text-xs bg-cream/40 border border-border/60 rounded-md p-3 max-h-80 overflow-y-auto">
                  {playbook.rubric}
                </pre>
              </div>
            )}

            {playbook.exemplars && playbook.exemplars.length > 0 && (
              <div className="space-y-2">
                <p className="text-overline text-gold">Exemplars</p>
                <ul className="space-y-2">
                  {playbook.exemplars.map((ex, i) => (
                    <li
                      key={i}
                      className={
                        "rounded-md border p-3 text-sm space-y-1 " +
                        (ex.verdict === "good"
                          ? "border-primary/30 bg-primary/[0.03]"
                          : "border-destructive/30 bg-destructive/[0.03]")
                      }
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={ex.verdict === "good" ? "default" : "destructive"}
                          className="text-[10px] uppercase tracking-wide"
                        >
                          {ex.verdict === "good" ? "Good" : "Avoid"}
                        </Badge>
                      </div>
                      <p className="text-sm">&ldquo;{ex.stem}&rdquo;</p>
                      <p className="text-xs text-muted-foreground italic">
                        {ex.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* Models & prompts */}
      <Section
        title="Models &amp; prompts"
        subtitle="What ran the generation, critique, and embedding stages."
      >
        <KvList>
          {ai?.models?.item_generation && (
            <Kv label="Generation model">
              <code className="text-xs font-mono">{ai.models.item_generation}</code>
            </Kv>
          )}
          {ai?.models?.item_critique && (
            <Kv label="Critique model">
              <code className="text-xs font-mono">{ai.models.item_critique}</code>
            </Kv>
          )}
          {ai?.models?.embedding && (
            <Kv label="Embedding model">
              <code className="text-xs font-mono">{ai.models.embedding}</code>
            </Kv>
          )}
          <Kv label="Temperature">
            <span className="tabular-nums">{c.temperature.toFixed(2)}</span>
          </Kv>
          {ai?.prompts &&
            Object.entries(ai.prompts).map(([purpose, info]) =>
              info ? (
                <Kv key={purpose} label={`Prompt — ${promptLabels?.[purpose] ?? purpose}`}>
                  <span className="text-xs font-mono">
                    {info.id.slice(0, 8)} · v{info.version}
                  </span>
                </Kv>
              ) : null,
            )}
        </KvList>
      </Section>

      {/* Pipeline parameters */}
      <Section
        title="Pipeline parameters"
        subtitle="The science-core configuration this run used."
      >
        <KvList>
          {ai?.embeddingType && (
            <Kv label="Embedding view">
              <Badge variant="outline" className="uppercase">
                {ai.embeddingType}
              </Badge>
            </Kv>
          )}
          {ai?.networkEstimator && (
            <Kv label="Network estimator">
              <Badge variant="outline" className="uppercase">
                {ai.networkEstimator}
              </Badge>
            </Kv>
          )}
          {ai?.walktrapStep !== undefined && (
            <Kv label="Walktrap step">
              <span className="tabular-nums">{ai.walktrapStep}</span>
            </Kv>
          )}
          {ai?.uvaSweeps !== undefined && (
            <Kv label="UVA sweeps">
              <span className="tabular-nums">{ai.uvaSweeps}</span>
            </Kv>
          )}
          {ai?.bootSweeps !== undefined && (
            <Kv label="BootEGA sweeps">
              <span className="tabular-nums">{ai.bootSweeps}</span>
            </Kv>
          )}
        </KvList>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {c.enableItemCritique !== false && (
            <Badge variant="outline">Critique</Badge>
          )}
          {c.enableLeakageGuard !== false && (
            <Badge variant="outline">Leakage guard</Badge>
          )}
          {c.enableDifficultyTargeting && (
            <Badge variant="outline">Difficulty targeting</Badge>
          )}
          {c.enableSyntheticValidation && (
            <Badge variant="outline">Synthetic validation</Badge>
          )}
        </div>
      </Section>

      {/* Token usage */}
      {run.tokenUsage && (
        <Section title="Token usage">
          <KvList>
            {typeof run.tokenUsage.inputTokens === "number" && (
              <Kv label="Input tokens">
                <span className="tabular-nums">
                  {run.tokenUsage.inputTokens.toLocaleString()}
                </span>
              </Kv>
            )}
            {typeof run.tokenUsage.outputTokens === "number" && (
              <Kv label="Output tokens">
                <span className="tabular-nums">
                  {run.tokenUsage.outputTokens.toLocaleString()}
                </span>
              </Kv>
            )}
          </KvList>
        </Section>
      )}
    </div>
  )
}

// =============================================================================
// Building blocks
// =============================================================================

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  )
}

function KvList({ children }: { children: React.ReactNode }) {
  return <dl className="divide-y divide-border/60">{children}</dl>
}

function Kv({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 py-2 first:pt-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-sm text-muted-foreground">{children}</span>
}

function Prose({ text }: { text: string }) {
  return <p className="text-sm whitespace-pre-wrap">{text}</p>
}
