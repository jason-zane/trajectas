'use client'

/**
 * create-blueprint-form.tsx — adds one construct (blueprint) to a build.
 *
 * A blueprint may target an existing library construct or define a brand-new
 * one that does not exist in the library yet, which is what "design an
 * instrument from nothing" requires.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/components/page-header'
import { createBlueprintAction } from '@/app/actions/instrument'

interface CreateBlueprintFormProps {
  buildId: string
}

export function CreateBlueprintForm({ buildId }: CreateBlueprintFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState('')
  const [definition, setDefinition] = useState('')
  const [exclusions, setExclusions] = useState('')
  const [targetAlpha, setTargetAlpha] = useState('0.80')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Construct name is required')
      return
    }
    if (!definition.trim()) {
      toast.error('A definition is required — it is what the blueprint and items are generated from')
      return
    }

    startTransition(async () => {
      try {
        const parsedAlpha = Number.parseFloat(targetAlpha)
        const blueprint = await createBlueprintAction(buildId, {
          draftConstructName: name.trim(),
          draftConstructDefinition: definition.trim(),
          exclusions: exclusions
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          targetAlpha: Number.isFinite(parsedAlpha) ? parsedAlpha : undefined,
        })

        toast.success('Construct added')
        router.replace(`/instruments/${buildId}/blueprints/${blueprint.id}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to add construct')
      }
    })
  }

  return (
    <div className='space-y-8 max-w-3xl'>
      <PageHeader
        eyebrow='Blueprint'
        title='Add a construct'
        description='Define what this construct measures — and what it does not. Both feed the blueprint and every item generated from it.'
      />

      <form onSubmit={handleSubmit} className='space-y-6'>
        <Card className='p-6 space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='name' className='text-sm font-semibold uppercase tracking-wide text-muted-foreground'>
              Construct name
            </Label>
            <Input
              id='name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g. Adaptability'
              disabled={isPending}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='definition' className='text-sm font-semibold uppercase tracking-wide text-muted-foreground'>
              Definition
            </Label>
            <Textarea
              id='definition'
              value={definition}
              onChange={(e) => setDefinition(e.target.value)}
              placeholder='One or two sentences describing the behaviour this construct covers.'
              rows={3}
              disabled={isPending}
            />
            <p className='text-xs text-muted-foreground'>
              The facet grid and every item are generated from this, so specificity here pays off downstream.
            </p>
          </div>
        </Card>

        <Card className='p-6 space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='exclusions' className='text-sm font-semibold uppercase tracking-wide text-muted-foreground'>
              Exclusions — what this construct is NOT
            </Label>
            <Textarea
              id='exclusions'
              value={exclusions}
              onChange={(e) => setExclusions(e.target.value)}
              placeholder='e.g. recovery from setbacks (Resilience), speed of commitment (Decisiveness)'
              rows={2}
              disabled={isPending}
            />
            <p className='text-xs text-muted-foreground'>
              Comma-separated. Naming the adjacent territory is what stops generated items drifting into a
              neighbouring construct.
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='targetAlpha' className='text-sm font-medium'>
              Target α
            </Label>
            <Input
              id='targetAlpha'
              type='number'
              step='0.01'
              min='0.5'
              max='0.95'
              value={targetAlpha}
              onChange={(e) => setTargetAlpha(e.target.value)}
              disabled={isPending}
            />
            <p className='text-xs text-muted-foreground'>
              A design target for the reliability forecast, not a measurement.
            </p>
          </div>
        </Card>

        <div className='flex items-center gap-3'>
          <Button type='submit' disabled={isPending}>
            {isPending ? 'Adding…' : 'Add construct'}
          </Button>
          <Button
            type='button'
            variant='ghost'
            onClick={() => router.push(`/instruments/${buildId}`)}
            disabled={isPending}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
