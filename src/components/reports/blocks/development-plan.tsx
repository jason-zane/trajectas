interface DevelopmentItem {
  entityId: string
  entityName: string
  pompScore: number
  suggestion: string | null
  aiSuggestion?: string
}

interface DevelopmentData {
  items: DevelopmentItem[]
  config: { maxItems: number }
}

export function DevelopmentPlanBlock({ data }: { data: Record<string, unknown> }) {
  const d = data as unknown as DevelopmentData
  if (!d.items?.length) return null

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Development Plan</h3>
      {d.items.map((item, i) => {
        const displaySuggestion = item.aiSuggestion ?? item.suggestion
        return (
          <div key={item.entityId} className="flex gap-4">
            <div className="flex-none w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
              {i + 1}
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">{item.entityName}</p>
              {displaySuggestion && (
                <div>
                  <p className="text-sm text-muted-foreground">{displaySuggestion}</p>
                  {item.aiSuggestion && (
                    <span className="inline-flex items-center text-[10px] text-muted-foreground/60 mt-0.5">
                      AI-generated
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
