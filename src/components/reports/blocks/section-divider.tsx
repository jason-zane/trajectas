interface SectionDividerData {
  title: string
  subtitle?: string
}

export function SectionDividerBlock({ data }: { data: Record<string, unknown> }) {
  const d = data as unknown as SectionDividerData
  return (
    <div className="py-8 border-b border-border">
      <h2 className="text-2xl font-semibold">{d.title}</h2>
      {d.subtitle && <p className="text-muted-foreground mt-1">{d.subtitle}</p>}
    </div>
  )
}
