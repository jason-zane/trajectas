/** Product wording is separate from the frozen scientific form and score labels. */
export const PERSONALITY_PROFILE_TITLE = 'Trajectas Personality Profile'
export const PERSONALITY_PROFILE_SOURCE = 'IPIP-NEO-120 (Johnson, 2014)'
export const PERSONALITY_PROFILE_SOURCE_ID = '891763cf-96e3-5ed1-ac86-23bc6cd48d79'
export const PERSONALITY_PROFILE_SECTION_ID = '66da538c-6850-5513-a97d-09cdd56ac7c7'
export const PERSONALITY_PROFILE_CATALOGUE_VERSION = 'trajectas-personality-profile-catalogue-v1'
export const PERSONALITY_PROFILE_PROMPT = 'How accurately does each statement describe you as you generally are?'

export function isPersonalityProfileItem(item: { sourceId?: string }): boolean {
  return item.sourceId === PERSONALITY_PROFILE_SOURCE_ID
}
