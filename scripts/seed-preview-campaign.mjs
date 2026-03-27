/**
 * Seed a preview campaign with a test candidate for visual testing.
 *
 * Creates: assessment → section → section_items → campaign → campaign_assessment → candidate
 *
 * Usage: node scripts/seed-preview-campaign.mjs
 *
 * Reads .env.local for Supabase credentials.
 * Outputs the candidate access token for use in the runner.
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { randomBytes } from 'crypto'

// Load .env.local
const envPath = resolve(process.cwd(), '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
const env = {}
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) env[match[1].trim()] = match[2].trim()
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Likert items (5-point scale, from seed data)
const LIKERT_ITEM_IDS = [
  'a6000000-0000-0000-0000-000000000001', // complex problem solving
  'a6000000-0000-0000-0000-000000000002', // perspective-taking
  'a6000000-0000-0000-0000-000000000005', // group settings
]

const LIKERT_FORMAT_ID = 'a5000000-0000-0000-0000-000000000001' // 5-point Likert

async function main() {
  // 1. Find or create a preview assessment
  let assessmentId

  const { data: existingAssessment } = await db
    .from('assessments')
    .select('id')
    .eq('slug', 'preview-assessment')
    .is('deleted_at', null)
    .single()

  if (existingAssessment) {
    assessmentId = existingAssessment.id
    console.log(`Using existing assessment: ${assessmentId}`)
  } else {
    const { data: newAssessment, error: assessErr } = await db
      .from('assessments')
      .insert({
        name: 'Preview Assessment',
        slug: 'preview-assessment',
        description: 'A preview assessment for visual testing of the candidate runner.',
        status: 'active',
        scoring_method: 'ctt',
        item_selection_strategy: 'fixed',
        format_mode: 'traditional',
      })
      .select('id')
      .single()

    if (assessErr) {
      console.error('Failed to create assessment:', assessErr.message)
      process.exit(1)
    }
    assessmentId = newAssessment.id
    console.log(`Created assessment: ${assessmentId}`)
  }

  // 2. Find or create a section with items
  const { data: existingSection } = await db
    .from('assessment_sections')
    .select('id, assessment_section_items(count)')
    .eq('assessment_id', assessmentId)
    .order('display_order', { ascending: true })
    .limit(1)
    .single()

  let sectionId
  if (existingSection && existingSection.assessment_section_items?.[0]?.count > 0) {
    sectionId = existingSection.id
    console.log(`Using existing section with items: ${sectionId}`)
  } else {
    // Create section
    if (existingSection) {
      sectionId = existingSection.id
    } else {
      const { data: newSection, error: secErr } = await db
        .from('assessment_sections')
        .insert({
          assessment_id: assessmentId,
          response_format_id: LIKERT_FORMAT_ID,
          title: 'Core Competencies',
          instructions: 'Read each statement carefully and select the response that best describes you. There are no right or wrong answers — we are interested in your natural tendencies and preferences.',
          display_order: 0,
          item_ordering: 'fixed',
          allow_back_nav: true,
        })
        .select('id')
        .single()

      if (secErr) {
        console.error('Failed to create section:', secErr.message)
        process.exit(1)
      }
      sectionId = newSection.id
      console.log(`Created section: ${sectionId}`)
    }

    // Link items to section
    const itemInserts = LIKERT_ITEM_IDS.map((itemId, i) => ({
      section_id: sectionId,
      item_id: itemId,
      display_order: i,
    }))

    const { error: itemErr } = await db
      .from('assessment_section_items')
      .upsert(itemInserts, { onConflict: 'section_id,item_id' })

    if (itemErr) {
      console.error('Failed to link items:', itemErr.message)
      process.exit(1)
    }
    console.log(`Linked ${LIKERT_ITEM_IDS.length} items to section`)
  }

  // 3. Check for existing preview campaign or create one
  const { data: existingCampaign } = await db
    .from('campaigns')
    .select('id')
    .eq('title', 'Preview Campaign')
    .is('deleted_at', null)
    .single()

  let campaignId
  if (existingCampaign) {
    campaignId = existingCampaign.id
    console.log(`Using existing campaign: ${campaignId}`)
  } else {
    const { data: campaign, error: campErr } = await db
      .from('campaigns')
      .insert({
        title: 'Preview Campaign',
        slug: 'preview-campaign',
        description: 'Auto-generated for visual preview testing',
        status: 'active',
        allow_resume: true,
        show_progress: true,
        randomize_assessment_order: false,
      })
      .select('id')
      .single()

    if (campErr) {
      console.error('Failed to create campaign:', campErr.message)
      process.exit(1)
    }
    campaignId = campaign.id
    console.log(`Created campaign: ${campaignId}`)
  }

  // 4. Link assessment to campaign (if not already linked)
  const { data: existingLink } = await db
    .from('campaign_assessments')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('assessment_id', assessmentId)
    .single()

  if (!existingLink) {
    const { error: linkErr } = await db
      .from('campaign_assessments')
      .insert({
        campaign_id: campaignId,
        assessment_id: assessmentId,
        display_order: 0,
        is_required: true,
      })

    if (linkErr) {
      console.error('Failed to link assessment to campaign:', linkErr.message)
      process.exit(1)
    }
    console.log('Linked assessment to campaign')
  } else {
    console.log('Assessment already linked to campaign')
  }

  // 5. Create test candidate (or reuse + reset)
  const { data: existingCandidate } = await db
    .from('campaign_candidates')
    .select('id, access_token')
    .eq('campaign_id', campaignId)
    .eq('email', 'preview@test.com')
    .single()

  let accessToken
  if (existingCandidate) {
    accessToken = existingCandidate.access_token

    // Clean up existing responses first (FK constraint)
    const { data: sessions } = await db
      .from('candidate_sessions')
      .select('id')
      .eq('campaign_candidate_id', existingCandidate.id)

    if (sessions?.length) {
      const sessionIds = sessions.map((s) => s.id)
      await db
        .from('candidate_responses')
        .delete()
        .in('session_id', sessionIds)
    }

    // Clean up existing sessions
    await db
      .from('candidate_sessions')
      .delete()
      .eq('campaign_candidate_id', existingCandidate.id)

    // Reset status to invited
    await db
      .from('campaign_candidates')
      .update({ status: 'invited', started_at: null, completed_at: null })
      .eq('id', existingCandidate.id)

    console.log('Reset existing candidate for fresh preview')
  } else {
    accessToken = randomBytes(32).toString('hex')
    const { error: candErr } = await db
      .from('campaign_candidates')
      .insert({
        campaign_id: campaignId,
        email: 'preview@test.com',
        first_name: 'Preview',
        last_name: 'Candidate',
        access_token: accessToken,
        status: 'invited',
      })

    if (candErr) {
      console.error('Failed to create candidate:', candErr.message)
      process.exit(1)
    }
    console.log('Created test candidate: preview@test.com')
  }

  console.log('\n=== PREVIEW READY ===')
  console.log(`URL: http://localhost:3002/assess/${accessToken}`)
  console.log(`Token: ${accessToken}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
