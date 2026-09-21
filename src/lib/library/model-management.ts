export const modelChannels = {
  matching: { label: 'Role matching', column: 'is_match_eligible', description: 'Available to the role matching engine.' },
  assessment: { label: 'Assessment building', column: 'is_assessment_eligible', description: 'Available for new assessment selections. Existing assessments stay intact.' },
  public: { label: 'Public library', column: 'is_public_visible', description: 'Visible on the public capability model page.' },
} as const
export type ModelChannel = keyof typeof modelChannels
export type ManagedCapability = {
  id: string; slug: string; name: string; category: string; definition: string;
  readiness: string; active: boolean; matching: boolean; assessment: boolean; public: boolean;
}
export function availabilityIssue(row: ManagedCapability, channel: ModelChannel): string | null {
  if (!row.active) return 'Activate this capability before enabling a channel.'
  if (channel === 'public') return row.category === 'Uncategorised' || !row.definition.trim()
    ? 'Add a category and definition before publishing.' : null
  return row.readiness === 'draft' ? 'Complete assessment readiness before enabling this channel.' : null
}
