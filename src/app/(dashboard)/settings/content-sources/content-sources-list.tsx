'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Tag, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/page-header'
import {
  createContentSource,
  deleteContentSource,
  updateContentSource,
} from '@/app/actions/content-sources'
import type { ContentSource } from '@/types/database'

export function ContentSourcesList({ sources }: { sources: ContentSource[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [adding, setAdding] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftSlug, setDraftSlug] = useState('')
  const [draftNotes, setDraftNotes] = useState('')

  function refresh() {
    router.refresh()
  }

  function slugify(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  async function handleAdd() {
    if (!draftName.trim()) {
      toast.error('Name is required.')
      return
    }
    const slug = draftSlug.trim() || slugify(draftName)
    const fd = new FormData()
    fd.set('name', draftName.trim())
    fd.set('slug', slug)
    if (draftNotes.trim()) fd.set('notes', draftNotes.trim())

    startTransition(async () => {
      const result = await createContentSource(fd)
      if (result?.error) {
        const msg =
          'object' === typeof result.error && '_form' in result.error
            ? (result.error as Record<string, string[]>)._form?.[0]
            : 'Could not create source.'
        toast.error(msg ?? 'Could not create source.')
        return
      }
      toast.success(`Added "${draftName}".`)
      setDraftName('')
      setDraftSlug('')
      setDraftNotes('')
      setAdding(false)
      refresh()
    })
  }

  async function handleSave(source: ContentSource, name: string, slug: string, notes: string) {
    const fd = new FormData()
    fd.set('name', name)
    fd.set('slug', slug)
    if (notes) fd.set('notes', notes)
    startTransition(async () => {
      const result = await updateContentSource(source.id, fd)
      if (result?.error) {
        toast.error('Could not save changes.')
        return
      }
      toast.success('Saved.')
      refresh()
    })
  }

  async function handleDelete(source: ContentSource) {
    if (!confirm(`Delete "${source.name}"? Tagged content keeps its rows but loses the source label.`)) {
      return
    }
    startTransition(async () => {
      const result = await deleteContentSource(source.id)
      if (result?.error) {
        toast.error('Could not delete source.')
        return
      }
      toast.success('Deleted.')
      refresh()
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content sources"
        description="Provenance labels for library content. Tag a dimension, factor, construct, item, or assessment with where it came from. Independent of the clients list."
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="size-4 text-muted-foreground" />
              Sources
            </CardTitle>
            <CardDescription>{sources.length} source{sources.length === 1 ? '' : 's'} configured.</CardDescription>
          </div>
          {!adding && (
            <Button size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-4" />
              Add source
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {adding && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="new-source-name">Name</Label>
                  <Input
                    id="new-source-name"
                    value={draftName}
                    onChange={(e) => {
                      setDraftName(e.target.value)
                      if (!draftSlug) setDraftSlug(slugify(e.target.value))
                    }}
                    placeholder="Executive Performance Partners"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="new-source-slug">Slug</Label>
                  <Input
                    id="new-source-slug"
                    value={draftSlug}
                    onChange={(e) => setDraftSlug(e.target.value)}
                    placeholder="executive-performance-partners"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-source-notes">Notes (optional)</Label>
                <Textarea
                  id="new-source-notes"
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                  placeholder="Where this came from, contact, licence terms, etc."
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleAdd} disabled={isPending}>
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAdding(false)} disabled={isPending}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {sources.length === 0 && !adding && (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No sources yet. Add one to start tagging library content.
            </p>
          )}

          <div className="space-y-2">
            {sources.map((source) => (
              <SourceRow
                key={source.id}
                source={source}
                onSave={handleSave}
                onDelete={handleDelete}
                disabled={isPending}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SourceRow({
  source,
  onSave,
  onDelete,
  disabled,
}: {
  source: ContentSource
  onSave: (s: ContentSource, name: string, slug: string, notes: string) => void
  onDelete: (s: ContentSource) => void
  disabled: boolean
}) {
  const [name, setName] = useState(source.name)
  const [slug, setSlug] = useState(source.slug)
  const [notes, setNotes] = useState(source.notes ?? '')
  const dirty = name !== source.name || slug !== source.slug || (notes ?? '') !== (source.notes ?? '')

  return (
    <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[2fr_1.4fr_3fr_auto]">
      <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
      <Input value={slug} onChange={(e) => setSlug(e.target.value)} aria-label="Slug" />
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={1}
        placeholder="Notes"
        className="min-h-[40px]"
      />
      <div className="flex items-center gap-1">
        {dirty && (
          <Button size="sm" onClick={() => onSave(source, name, slug, notes)} disabled={disabled}>
            Save
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onDelete(source)}
          disabled={disabled}
          aria-label="Delete source"
        >
          <Trash2 className="size-4 text-destructive" />
        </Button>
      </div>
    </div>
  )
}
