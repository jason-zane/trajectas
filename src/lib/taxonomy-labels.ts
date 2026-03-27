/**
 * Maps internal DB table names to UI display names.
 *
 * DB tables keep existing names (dimensions, competencies, traits, items)
 * to avoid migration churn. The UI uses neutral psychometric language:
 *   Dimension / Factor / Construct / Item
 */
export const taxonomyLabels = {
  dimension: {
    singular: 'Dimension',
    plural: 'Dimensions',
    route: '/dimensions',
    dbTable: 'dimensions',
  },
  competency: {
    singular: 'Factor',
    plural: 'Factors',
    route: '/factors',
    dbTable: 'factors',
  },
  trait: {
    singular: 'Construct',
    plural: 'Constructs',
    route: '/constructs',
    dbTable: 'constructs',
  },
  item: {
    singular: 'Item',
    plural: 'Items',
    route: '/items',
    dbTable: 'items',
  },
} as const

export type TaxonomyLevel = keyof typeof taxonomyLabels
