'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'
import { createInstrumentBuild } from '@/app/actions/instrument'
import type { MeasureType } from '@/lib/instrument/types'

interface MeasureTypeOption {
  value: MeasureType
  label: string
  description: string
}

const MEASURE_TYPE_OPTIONS: MeasureTypeOption[] = [
  {
    value: 'trait',
    label: 'Trait',
    description: 'Stable, dispositional characteristics (e.g., openness, conscientiousness)',
  },
  {
    value: 'competency_behavioural',
    label: 'Competency (Behavioural)',
    description: 'Observable, context-dependent behaviors and capabilities',
  },
  {
    value: 'capability',
    label: 'Capability',
    description: 'Integrated combinations of skills, knowledge, and attributes',
  },
  {
    value: 'sjt',
    label: 'Situational Judgment Test',
    description: 'Judgment and decision-making in workplace scenarios',
  },
  {
    value: 'forced_choice',
    label: 'Forced Choice',
    description: 'Paired comparison items for preference and motivation assessment',
  },
  {
    value: 'preference',
    label: 'Preference',
    description: 'Motivations, interests, and work environment preferences',
  },
  {
    value: 'climate',
    label: 'Climate',
    description: 'Organizational or team culture and psychological safety perceptions',
  },
  {
    value: 'validity_scale',
    label: 'Validity Scale',
    description: 'Response style detection and impression management',
  },
]

const AUDIENCE_LABELS: Record<string, string> = {
  entry: 'Entry',
  mid: 'Mid-level',
  senior: 'Senior',
  executive: 'Executive',
  mixed: 'Mixed',
  open: 'Open',
}

const USE_CONTEXT_LABELS: Record<string, string> = {
  selection: 'Selection',
  development: 'Development',
  research: 'Research',
  open: 'Open',
}

export function CreateInstrumentForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState('')
  const [measureType, setMeasureType] = useState<MeasureType | ''>('')
  const [brief, setBrief] = useState('')
  const [targetConstructCount, setTargetConstructCount] = useState('')
  const [targetItemsPerConstruct, setTargetItemsPerConstruct] = useState('')
  const [audienceLevel, setAudienceLevel] = useState<string>('')
  const [useContext, setUseContext] = useState<string>('')

  const selectedTypeOption = MEASURE_TYPE_OPTIONS.find((opt) => opt.value === measureType)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast.error('Instrument name is required')
      return
    }

    if (!measureType) {
      toast.error('Measure type is required')
      return
    }

    startTransition(async () => {
      try {
        const result = await createInstrumentBuild({
          name: name.trim(),
          measureType,
          brief: brief.trim() || undefined,
          targetConstructCount: targetConstructCount ? parseInt(targetConstructCount, 10) : undefined,
          targetItemsPerConstruct: targetItemsPerConstruct
            ? parseInt(targetItemsPerConstruct, 10)
            : undefined,
          audience: audienceLevel
            ? {
                level: audienceLevel,
              }
            : undefined,
          useContext: useContext || undefined,
        })

        toast.success('Instrument created')
        router.replace(`/instruments/${result.id}`)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to create instrument'
        )
      }
    })
  }

  return (
    <div className='space-y-8 max-w-3xl'>
      <PageHeader
        eyebrow='Instruments'
        title='Create Instrument'
        description='Define a new assessment instrument by selecting a measure type and configuring its structure.'
      />

      <form onSubmit={handleSubmit} className='space-y-6'>
        {/* Name */}
        <Card className='p-6 space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='name' className='text-sm font-semibold text-muted-foreground uppercase tracking-wide'>
              Instrument Name
            </Label>
            <Input
              id='name'
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder='e.g., Leadership Capacity Index'
              disabled={isPending}
            />
            <p className='text-xs text-muted-foreground'>
              A clear, descriptive name that identifies this instrument uniquely.
            </p>
          </div>
        </Card>

        {/* Measure Type Selection */}
        <Card className='p-6 space-y-4 border-2 border-primary/20'>
          <div className='space-y-2 mb-4'>
            <Label htmlFor='measureType' className='text-sm font-semibold text-muted-foreground uppercase tracking-wide'>
              Measure Type
            </Label>
            <p className='text-xs text-muted-foreground'>
              This is the most consequential choice. It determines the format and interpretation of items.
            </p>
          </div>

          <Select value={measureType} onValueChange={(val) => setMeasureType(val as MeasureType)}>
            <SelectTrigger id='measureType' disabled={isPending}>
              <SelectValue>
                  {selectedTypeOption ? selectedTypeOption.label : 'Select a measure type'}
                </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {MEASURE_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedTypeOption && (
            <div className='mt-4 p-3 rounded-md bg-cream dark:bg-slate-900/50 border border-border'>
              <p className='text-sm text-foreground'>{selectedTypeOption.description}</p>
            </div>
          )}
        </Card>

        {/* Brief */}
        <Card className='p-6 space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='brief' className='text-sm font-semibold text-muted-foreground uppercase tracking-wide'>
              Brief Description
            </Label>
            <Textarea
              id='brief'
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder='A concise summary of what this instrument measures and its intended use.'
              rows={3}
              disabled={isPending}
            />
            <p className='text-xs text-muted-foreground'>
              Optional. Used in documentation and design notes.
            </p>
          </div>
        </Card>

        {/* Structure Configuration */}
        <Card className='p-6 space-y-4'>
          <h3 className='text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4'>
            Blueprint Configuration
          </h3>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='constructs' className='text-sm font-medium'>
                Target Constructs
              </Label>
              <Input
                id='constructs'
                type='number'
                min='1'
                max='20'
                value={targetConstructCount}
                onChange={(e) => setTargetConstructCount(e.target.value)}
                placeholder='e.g., 5'
                disabled={isPending}
              />
              <p className='text-xs text-muted-foreground'>
                Number of distinct constructs to measure.
              </p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='itemsPerConstruct' className='text-sm font-medium'>
                Items per Construct
              </Label>
              <Input
                id='itemsPerConstruct'
                type='number'
                min='1'
                max='50'
                value={targetItemsPerConstruct}
                onChange={(e) => setTargetItemsPerConstruct(e.target.value)}
                placeholder='e.g., 8'
                disabled={isPending}
              />
              <p className='text-xs text-muted-foreground'>
                Average items per construct across facets and intensities.
              </p>
            </div>
          </div>
        </Card>

        {/* Optional Context */}
        <Card className='p-6 space-y-4'>
          <h3 className='text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4'>
            Context (Optional)
          </h3>

          <div className='grid grid-cols-2 gap-4'>
            <div className='space-y-2'>
              <Label htmlFor='audience' className='text-sm font-medium'>
                Audience Level
              </Label>
              <Select
                value={audienceLevel}
                onValueChange={(value) => setAudienceLevel(value ?? '')}
              >
                <SelectTrigger id='audience' disabled={isPending}>
                  <SelectValue>
                    {AUDIENCE_LABELS[audienceLevel] ?? 'Select level'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='entry'>Entry</SelectItem>
                  <SelectItem value='mid'>Mid-level</SelectItem>
                  <SelectItem value='senior'>Senior</SelectItem>
                  <SelectItem value='executive'>Executive</SelectItem>
                  <SelectItem value='mixed'>Mixed</SelectItem>
                  <SelectItem value='open'>Open</SelectItem>
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>
                The career or organizational level of respondents.
              </p>
            </div>

            <div className='space-y-2'>
              <Label htmlFor='useContext' className='text-sm font-medium'>
                Use Context
              </Label>
              <Select
                value={useContext}
                onValueChange={(value) => setUseContext(value ?? '')}
              >
                <SelectTrigger id='useContext' disabled={isPending}>
                  <SelectValue>
                    {USE_CONTEXT_LABELS[useContext] ?? 'Select context'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='development'>Development</SelectItem>
                  <SelectItem value='selection'>Selection</SelectItem>
                  <SelectItem value='research'>Research</SelectItem>
                  <SelectItem value='open'>Open</SelectItem>
                </SelectContent>
              </Select>
              <p className='text-xs text-muted-foreground'>
                Primary application context for this instrument.
              </p>
            </div>
          </div>
        </Card>

        {/* Actions */}
        <div className='flex items-center gap-3'>
          <Button
            type='submit'
            disabled={isPending || !name.trim() || !measureType}
            className='flex-1'
          >
            {isPending ? 'Creating…' : 'Create Instrument'}
          </Button>
        </div>
      </form>
    </div>
  )
}
