"use client"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionPanel,
} from "@/components/ui/accordion"

const PIPELINE_SECTIONS = [
  {
    title: "Pre-flight Check",
    explanation:
      "Checks your construct definitions are distinct enough for high-quality item generation.",
    technical:
      "Computes pairwise cosine similarity between construct definition embeddings and runs an LLM discrimination test to verify constructs are separable.",
  },
  {
    title: "Item Generation",
    explanation:
      "AI writes candidate assessment items grounded in your construct definitions.",
    technical:
      "Batched LLM prompting with temperature variation, followed by semantic deduplication against existing items.",
  },
  {
    title: "Semantic Embedding",
    explanation:
      "Converts each item into a mathematical fingerprint so items can be compared for similarity.",
    technical:
      "Each item stem is embedded using text-embedding-3-small, producing a 1536-dimensional vector.",
  },
  {
    title: "Network Analysis (EGA)",
    explanation:
      "Discovers how items naturally cluster by meaning — items that group together measure the same facet of a construct.",
    technical:
      "Builds a TMFG (Triangulated Maximally Filtered Graph) network from the correlation matrix, then applies Walktrap community detection.",
  },
  {
    title: "Redundancy Removal (UVA)",
    explanation:
      "Flags items that overlap too much with their neighbours, keeping only the most unique items.",
    technical:
      "Iteratively removes items whose weighted topological overlap (wTO) exceeds 0.20 until all remaining items are sufficiently unique.",
  },
  {
    title: "Stability Check (bootEGA)",
    explanation:
      "Tests whether items consistently belong to the same cluster across many simulated samples.",
    technical:
      "Runs 100 bootstrap iterations of EGA. Items that shift clusters in more than 25% of resamples (stability < 0.75) are flagged as unstable.",
  },
] as const

export function PipelineExplainerSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>How the Pipeline Works</SheetTitle>
          <SheetDescription>
            Each generation run passes through six stages. Here&apos;s what happens at each step.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          <Accordion>
            {PIPELINE_SECTIONS.map((section, i) => (
              <AccordionItem key={i} value={String(i)}>
                <AccordionTrigger>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">{section.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionPanel>
                  <div className="pl-9 pr-2 pb-2 space-y-2">
                    <p className="text-sm text-foreground leading-relaxed">
                      {section.explanation}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {section.technical}
                    </p>
                  </div>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </SheetContent>
    </Sheet>
  )
}
