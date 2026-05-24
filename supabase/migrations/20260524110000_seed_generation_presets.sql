-- =============================================================================
-- Seed initial playbook presets for the AI item generator.
--
-- These are starter playbooks shipped with the refactor; admins can edit
-- them in the preset editor.
--
-- Spec: docs/superpowers/specs/2026-05-24-ai-item-generator-refactor-design.md
-- =============================================================================

INSERT INTO generation_presets (
  id,
  name,
  description,
  measurement_mode,
  audience,
  use_context,
  response_format_id,
  response_format_rationale,
  rubric,
  exemplars,
  critique_emphasis,
  sd_tolerance,
  difficulty_mix,
  critique_strictness,
  pipeline_defaults,
  recommended_target_per_construct
) VALUES

-- =============================================================================
-- 1. Behavioural — Selection (Likert)
-- =============================================================================
(
  '00000000-1111-0000-0000-000000000001',
  'Behavioural — Selection (Likert)',
  'Behavioural self-report items for high-stakes selection. Strict critique, low SD tolerance, observable specificity emphasised.',
  'behavioural',
  '{"level": "mid"}'::jsonb,
  'selection',
  'a5000000-0000-0000-0000-000000000001',  -- 5-point Likert
  'Agreement scale is the lingua franca of behavioural self-report. Strong defaults exist for analysis and respondents understand it instantly.',
  $rubric$
**Style rules**
- Present-tense, first-person declaratives. "I do X", "I tend to Y".
- No questions, no commands, no scenarios.
- Under 18 words per stem.
- Concrete behaviours over abstract qualities. "I write up notes within an hour of a meeting ending" not "I am organised."
- Vary sentence openings within a batch — avoid every stem starting with "I am".

**Counter-faking specificity**
- Anchor to a time window, a count, or a setting where natural to do so. "Most days I…", "When discussing a deadline with my manager…"
- Avoid stems whose obviously-desirable answer is the high-scoring answer ("I work hard" — everyone says yes).
- Prefer stems where someone who genuinely does the behaviour can endorse without exaggerating, and someone who does not can disagree without feeling judged.

**What to avoid**
- Vague trait claims ("I am ambitious", "I am organised")
- Double-barrelled stems ("I plan carefully and execute decisively")
- Frequency hedges that belong to a frequency scale ("I sometimes…", "I often…")
- Negation pile-ups ("I don't fail to notice when…")
  $rubric$,
  '[
    {
      "stem": "I write up notes within an hour of a meeting ending.",
      "verdict": "good",
      "reason": "Concrete behaviour, time-bounded, lets a genuine doer endorse without exaggerating."
    },
    {
      "stem": "When a deadline slips, I tell my manager before they ask.",
      "verdict": "good",
      "reason": "Specific setting, distinguishes proactive communicators from reactive ones."
    },
    {
      "stem": "I check my work for errors before sending it out.",
      "verdict": "good",
      "reason": "Observable behaviour, allows partial endorsement at moderate trait levels."
    },
    {
      "stem": "I am hardworking and reliable.",
      "verdict": "bad",
      "reason": "Abstract self-rating, no behavioural anchor, double-barrelled — and everyone wants to say yes."
    },
    {
      "stem": "I sometimes find it difficult not to put off tasks I do not enjoy.",
      "verdict": "bad",
      "reason": "Frequency hedge belongs to a frequency scale, and the double negative blunts the meaning."
    }
  ]'::jsonb,
  'Weight SD risk heavily — flag items whose desirable answer is the high-scoring answer. Demand behavioural specificity over breadth.',
  'low',
  '{"easy": 0.2, "moderate": 0.5, "hard": 0.3}'::jsonb,
  'strict',
  '{"enableItemCritique": true, "enableLeakageGuard": true, "enableDifficultyTargeting": true, "enableSyntheticValidation": false}'::jsonb,
  60
),

-- =============================================================================
-- 2. Behavioural — Development (Likert)
-- =============================================================================
(
  '00000000-1111-0000-0000-000000000002',
  'Behavioural — Development (Likert)',
  'Behavioural self-report items for formative development. Standard critique, growth-friendly framing, moderate SD tolerance.',
  'behavioural',
  '{"level": "mixed"}'::jsonb,
  'development',
  'a5000000-0000-0000-0000-000000000001',  -- 5-point Likert
  'Agreement scale is familiar to respondents and yields clean rolled-up reports for feedback conversations.',
  $rubric$
**Style rules**
- Present-tense, first-person declaratives. "I do X", "I tend to Y".
- Under 20 words per stem.
- Concrete enough that the respondent can recognise the behaviour, abstract enough that low scorers can still feel growth is possible.
- Frame so the respondent can imagine working on this without shame.

**Development-friendly framing**
- Permit honest self-assessment of current state. "I currently…" and "These days…" openings are fine where natural.
- Avoid stems that read as accusations or judgement. "I struggle to…" is OK if balanced with positively-keyed items.
- Reverse-key roughly a third of items to break agreement bias.

**What to avoid**
- Stems that read as PIPs ("I fail to…", "I cannot…") with no positive sibling
- Vague trait claims with no behavioural anchor
- Items whose disagreement signals the respondent is a problem (every item should be answerable honestly without self-condemnation)
  $rubric$,
  '[
    {
      "stem": "When I get critical feedback, I follow up with the person to understand more.",
      "verdict": "good",
      "reason": "Behavioural, growth-relevant, distinguishes feedback-seekers from feedback-tolerators."
    },
    {
      "stem": "I currently find it hard to keep going when a project stalls.",
      "verdict": "good",
      "reason": "Honest, present-state framing; reverse-keyed item that does not shame the low scorer."
    },
    {
      "stem": "I notice when team energy drops in a long discussion.",
      "verdict": "good",
      "reason": "Observable awareness behaviour, not a trait claim."
    },
    {
      "stem": "I am a great team player.",
      "verdict": "bad",
      "reason": "Abstract, social-desirability heavy, gives the respondent nothing actionable to work on."
    }
  ]'::jsonb,
  'Apply normal critique. Flag items that read as accusations or that the respondent could not answer honestly without self-condemnation.',
  'moderate',
  '{"easy": 0.3, "moderate": 0.5, "hard": 0.2}'::jsonb,
  'standard',
  '{"enableItemCritique": true, "enableLeakageGuard": true, "enableDifficultyTargeting": false, "enableSyntheticValidation": false}'::jsonb,
  60
),

-- =============================================================================
-- 3. Frequency-based 360 (development)
-- =============================================================================
(
  '00000000-1111-0000-0000-000000000003',
  'Frequency-based 360 (development)',
  'Other-rater behavioural items for 360-degree feedback. Frequency scale, observable behaviour the rater can have witnessed.',
  'behavioural',
  '{"level": "mixed", "description": "items will be answered by colleagues, managers, and direct reports of the target person"}'::jsonb,
  'development',
  'a5000000-0000-0000-0000-000000000007',  -- Scale 0-100 (treat as frequency)
  'Frequency scales fit 360 because raters have varying observation windows; frequency phrasing makes that variance visible rather than hidden.',
  $rubric$
**Style rules**
- Third-person, present-tense, frequency-phrasable behaviour. "[They] do X."
- Each stem must be something a colleague could plausibly have witnessed in normal working interactions.
- Under 22 words.
- No interpretation of motive or interior state — the rater can only observe behaviour, not intent.

**Frequency-anchorable phrasing**
- Write stems that complete naturally with "always / often / sometimes / rarely / never".
- Avoid trait claims ("they are reliable") — translate to behaviour ("they deliver work they promised by the date they promised").
- Avoid stems that only one type of rater (e.g. only a direct report) could answer.

**What to avoid**
- Interior-state claims ("they think strategically")
- Vague evaluations ("they do good work")
- Stems requiring privileged information ("they handle their personal finances carefully")
  $rubric$,
  '[
    {
      "stem": "They give clear, specific feedback after reviewing someone''s work.",
      "verdict": "good",
      "reason": "Observable behaviour, frequency-phrasable, plausibly witnessed by peers and direct reports."
    },
    {
      "stem": "They notice and acknowledge when a teammate is overloaded.",
      "verdict": "good",
      "reason": "Behavioural, witnessable, distinguishes attentive colleagues from heads-down ones."
    },
    {
      "stem": "They think strategically about the business.",
      "verdict": "bad",
      "reason": "Interior-state claim — the rater cannot observe thinking, only the behaviour that follows from it."
    }
  ]'::jsonb,
  'Flag any item that asks the rater to judge motive or interior state. Insist on frequency-phrasable observable behaviour.',
  'moderate',
  '{"easy": 0.25, "moderate": 0.55, "hard": 0.20}'::jsonb,
  'standard',
  '{"enableItemCritique": true, "enableLeakageGuard": true, "enableDifficultyTargeting": false, "enableSyntheticValidation": false}'::jsonb,
  50
),

-- =============================================================================
-- 4. Capability — Situational Judgement
-- =============================================================================
(
  '00000000-1111-0000-0000-000000000004',
  'Capability — Situational Judgement',
  'Scenario-based judgement items for capability assessment. SJT response format, selection-grade rigour, mid-level audience by default.',
  'situational',
  '{"level": "mid"}'::jsonb,
  'selection',
  'a5000000-0000-0000-0000-000000000005',  -- SJT 4-Option
  'SJT items pair scenario stems with discrete response options ranked by effectiveness — the format is the assessment.',
  $rubric$
**Style rules — scenario stems**
- 2–4 sentences. First sentence sets the situation; subsequent sentences supply the wrinkle that makes the right answer non-obvious.
- Present-tense, you-perspective. "You are…", "You notice…"
- Work-realistic and culturally portable. Avoid US-only references, jargon, and acronyms.
- Stop short of asking the question — the rubric/options imply "what would you do" or "how effective is this response".

**Scenario design**
- The scenario must contain enough information for a defensible best answer, but not so much that the answer is obvious.
- Avoid scenarios where the right answer is "ask your manager" — write situations where the respondent must act.
- Avoid trick scenarios with hidden information; the right answer should be defensible from the facts given.
- The construct must be the *primary* axis of variation across response options; other constructs should be held constant where possible.

**What to avoid**
- Scenarios so generic any reasonable person would do the right thing (no discrimination)
- Multi-construct scenarios where the "correct" answer mixes multiple competencies
- Scenarios that depend on culture-specific norms (tipping, hierarchy distance, etc.)
  $rubric$,
  '[
    {
      "stem": "You are leading a project that is one week from launch. A teammate, who is the only person who understands a critical part of the system, calls in sick and is unreachable. The next standup is in three hours. What would you do?",
      "verdict": "good",
      "reason": "Specific, time-bounded, forces a real trade-off between waiting for the SME and acting without them."
    },
    {
      "stem": "Your manager has given you feedback that conflicts with feedback you received from your peer last month. The two pieces of advice point in opposite directions on a decision you need to make this week.",
      "verdict": "good",
      "reason": "Realistic conflict, no obvious right answer, multiple defensible responses — good basis for option ranking."
    },
    {
      "stem": "You are at work and a colleague is being unprofessional. How would you respond?",
      "verdict": "bad",
      "reason": "Vague (what does unprofessional mean?), too open, no constraint that forces the construct to be the primary axis of variation."
    }
  ]'::jsonb,
  'Demand specificity in the scenario, non-obvious answers, and a single primary construct axis. Flag culturally-narrow examples.',
  'moderate',
  '{"easy": 0.2, "moderate": 0.5, "hard": 0.3}'::jsonb,
  'strict',
  '{"enableItemCritique": true, "enableLeakageGuard": true, "enableDifficultyTargeting": false, "enableSyntheticValidation": false}'::jsonb,
  30
)

ON CONFLICT (id) DO NOTHING;
