import { OVERALL_ID, type CanvasEntity, type CanvasPoint, type CanvasSeries } from '@/lib/canvas/types'
import type { PersonContext, StudioDataset } from './model'

// Fictional review data. Never imported by the authenticated studio route.
const roster: Array<[string, string, PersonContext['population'], number[]]> = [
  ['Priya Sharma', 'Senior product manager', 'Employee', [57, 64, 62, 77]],
  ['Amara Okafor', 'Head of operations', 'Employee', [73, 75, 79, 82]],
  ['James Mitchell', 'Engineering lead', 'Employee', [63, 71, 68, 74]],
  ['Sofia Chen', 'People & culture lead', 'Employee', [69, 66, 72, 71]],
  ['Oliver Wilson', 'Regional director', 'Employee', [62, 64, 65, 70]],
  ['Elena Martínez', 'Customer experience lead', 'Employee', [58, 63, 68, 75]],
  ['Noah Williams', 'Product leadership applicant', 'Candidate', [76]],
  ['Aisha Rahman', 'Product leadership applicant', 'Candidate', [81]],
  ['Daniel Park', 'Graduate applicant', 'Candidate', [67]],
  ['Freya Jensen', 'Graduate applicant', 'Candidate', [73]],
]
const dimensions = ['Thinking', 'Relating', 'Leading', 'Delivering', 'Self-management']
const factors = [
  ['Critical thinking', 'Perspective taking', 'Learning agility'],
  ['Empathy', 'Collaboration', 'Building trust'],
  ['Direction setting', 'Influence', 'Developing others'],
  ['Accountability', 'Decisiveness', 'Execution'],
  ['Adaptability', 'Emotional regulation', 'Self-awareness'],
]

export function createStudioDemo(): StudioDataset {
  const context: Record<string, PersonContext> = {}
  const entities: CanvasEntity[] = dimensions.flatMap((name, index) => [
    { id: `dimension-${index}`, name, level: 'dimension' as const, parentId: null, displayOrder: index },
    ...factors[index].map((factor, f) => ({ id: `factor-${index}-${f}`, name: factor, level: 'factor' as const, parentId: `dimension-${index}`, displayOrder: f })),
  ])
  entities.push(...['Collaboration preference', 'Structure preference', 'Exploration preference'].map((name, i) => ({ id: `style-${i}`, name, level: 'dimension' as const, parentId: null, displayOrder: i })))
  const series: CanvasSeries[] = []
  const dates = ['2025-09-17', '2025-12-04', '2026-03-19', '2026-08-20']
  const people = roster.map(([displayName, role, population, values], index) => {
    const personKey = `demo-person-${index + 1}`
    context[personKey] = { role, population }
    const employee = population === 'Employee'
    const sessions: CanvasPoint[] = values.map((value, attempt) => ({
      sessionId: `${personKey}-leadership-${attempt}`,
      completedAt: `${employee ? dates[attempt] : `2026-08-${18 + index}`}T10:00:00.000Z`,
      assessmentId: 'leadership-index', assessmentName: 'Leadership Index',
      campaignId: employee ? (attempt < 2 ? 'development-2025' : 'development-2026') : index < 8 ? 'leadership-hiring' : 'graduate-hiring',
      campaignTitle: employee ? (attempt < 2 ? 'Leadership development · 2025' : 'Leadership development · 2026') : index < 8 ? 'Leadership hiring · August' : 'Graduate programme · August',
      attemptNumber: attempt + 1, value, ciLower: null, ciUpper: null,
    }))
    series.push({ personKey, entityId: OVERALL_ID, points: sessions })
    dimensions.forEach((_, dimension) => {
      const offset = [[-2, 8, 4, -5, -5], [4, 2, 6, -5, -7], [9, -6, -2, 5, -6], [1, 7, -5, -6, 3]][index % 4][dimension]
      const points = sessions.map((point, attempt) => ({ ...point, value: Math.max(15, Math.min(96, point.value + offset + (dimension === 1 && index === 0 ? attempt * 2 - 3 : 0))) }))
      series.push({ personKey, entityId: `dimension-${dimension}`, points })
      factors[dimension].forEach((_, factor) => {
        // A missing final factor deliberately exercises incomplete-result handling.
        const factorPoints = points.filter((_, attempt) => !(index === 3 && dimension === 4 && factor === 2 && attempt === 3))
          .map((point) => {
            const value = point.value + (factor - 1) * 4
            return { ...point, value, ciLower: Math.max(0, value - 4.5), ciUpper: Math.min(100, value + 4.5) }
          })
        series.push({ personKey, entityId: `factor-${dimension}-${factor}`, points: factorPoints })
      })
    })
    if (index !== 2 && index !== 8) {
      const stylePoints = (employee ? [0, 3] : [0]).map((_, attempt) => ({
        ...sessions[employee ? attempt * 3 : 0], sessionId: `${personKey}-styles-${attempt}`,
        assessmentId: 'workplace-styles', assessmentName: 'Workplace styles', value: 52 + index * 3 + attempt * 4,
        attemptNumber: attempt + 1,
      }))
      // No overall score: preferences are not a performance total.
      for (let dimension = 0; dimension < 3; dimension++) series.push({ personKey, entityId: `style-${dimension}`, points: stylePoints.map((point) => ({ ...point, value: point.value + (dimension - 1) * 8 })) })
    }
    return { personKey, entryCpId: personKey, displayName, email: `${displayName.toLowerCase().split(' ')[0]}@example.test`, completedSessionCount: sessions.length, firstCompletedAt: sessions[0].completedAt, lastCompletedAt: sessions.at(-1)!.completedAt }
  })
  return { result: { people, entities, series, clientId: 'demo-client' }, context, workspaceName: 'Northstar Group', demo: true }
}
