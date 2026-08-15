'use client'

import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProgressStep } from '@/lib/instrument/progress'

interface ProgressRailProps {
  buildId: string
  steps: ProgressStep[]
  nextStep?: ProgressStep
}

const STATE_STYLES = {
  complete: {
    icon: CheckCircle2,
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-900',
    iconColor: 'text-green-600 dark:text-green-400',
    textColor: 'text-foreground',
    badge: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
  },
  needs_attention: {
    icon: AlertCircle,
    bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    borderColor: 'border-amber-200 dark:border-amber-900',
    iconColor: 'text-amber-600 dark:text-amber-400',
    textColor: 'text-foreground',
    badge: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300',
  },
  in_progress: {
    icon: Clock,
    bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    borderColor: 'border-blue-200 dark:border-blue-900',
    iconColor: 'text-blue-600 dark:text-blue-400',
    textColor: 'text-foreground',
    badge: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  },
  not_started: {
    icon: ChevronRight,
    bgColor: 'bg-muted',
    borderColor: 'border-muted-foreground/20',
    iconColor: 'text-muted-foreground/50',
    textColor: 'text-muted-foreground',
    badge: 'bg-muted text-muted-foreground',
  },
}

const STATE_LABELS = {
  complete: 'Complete',
  needs_attention: 'Needs Review',
  in_progress: 'In Progress',
  not_started: 'Not Started',
}

export function ProgressRail({ buildId, steps, nextStep }: ProgressRailProps) {
  const router = useRouter()

  const getRoute = (stepKey: string): string => {
    const baseUrl = `/instruments/${buildId}`
    switch (stepKey) {
      case 'brief':
        return `${baseUrl}/settings` // Would be settings page if it exists
      case 'structure':
        return `${baseUrl}/structure`
      case 'blueprint':
        return `${baseUrl}/blueprints`
      case 'items':
        return `${baseUrl}/blueprints` // Items are accessed through blueprint detail
      case 'evidence':
        return `${baseUrl}/evidence`
      case 'publish':
        return `${baseUrl}/publish`
      default:
        return baseUrl
    }
  }

  return (
    <div className="w-full">
      {/* Progress indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Build Progress
          </h3>
          <div className="text-xs text-muted-foreground">
            {steps.filter((s) => s.state === 'complete').length} of {steps.length} complete
          </div>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-300"
            style={{
              width: `${(steps.filter((s) => s.state === 'complete').length / steps.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Steps grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {steps.map((step) => {
          const styles = STATE_STYLES[step.state]
          const Icon = styles.icon
          const isActive = step.key === nextStep?.key

          return (
            <button
              key={step.key}
              onClick={() => router.push(getRoute(step.key))}
              className={cn(
                'relative p-4 rounded-lg border-2 text-left transition-all hover:shadow-md active:scale-95',
                styles.bgColor,
                styles.borderColor,
                isActive && 'ring-2 ring-offset-2 ring-primary dark:ring-offset-background',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', styles.iconColor)} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-foreground">
                      {step.label}
                    </div>
                    {step.description && (
                      <div className={cn(
                        'text-xs mt-1 leading-relaxed',
                        step.state === 'not_started' ? 'text-muted-foreground/60' : 'text-muted-foreground',
                      )}>
                        {step.description}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Status badge */}
              <div className="mt-3">
                <span
                  className={cn(
                    'inline-block px-2 py-1 rounded text-xs font-medium',
                    styles.badge,
                  )}
                >
                  {STATE_LABELS[step.state]}
                </span>
              </div>

              {/* Active indicator */}
              {isActive && (
                <div className="absolute -top-2 -right-2 w-4 h-4 bg-primary rounded-full animate-pulse" />
              )}
            </button>
          )
        })}
      </div>

      {/* Next action hint */}
      {nextStep && (
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg">
          <div className="flex items-start gap-3">
            <ChevronRight className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                Next: {nextStep.label}
              </div>
              {nextStep.description && (
                <div className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                  {nextStep.description}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
