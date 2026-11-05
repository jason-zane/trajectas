/** Participant-facing notice data; no participant or account identifiers. */
export type ParticipantPrivacyNotice = {
  id: string
  title: string
  body: string
  acknowledgementLabel: string
  researchLabel: string
  researchChoiceEnabled: boolean
}
