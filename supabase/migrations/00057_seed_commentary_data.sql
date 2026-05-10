-- =============================================================================
-- Migration 00057: Seed strength_commentary and development_suggestion
-- =============================================================================
-- Populates strength and development commentary for all existing factors
-- and constructs. This content is used by the Strengths Highlights and
-- Development Plan report blocks.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Factors — strength_commentary
-- ---------------------------------------------------------------------------

UPDATE factors SET strength_commentary =
  'You demonstrate a strong ability to see the bigger picture and connect disparate pieces of information into coherent, forward-looking strategies. This is a significant asset — people with this strength tend to anticipate challenges before they arise and position their teams for long-term success rather than short-term fixes.'
WHERE slug = 'strategic-thinking';
UPDATE factors SET strength_commentary =
  'You show a natural ability to work through complex problems methodically and arrive at effective solutions. This strength means you are likely the person others turn to when things get stuck — your approach brings clarity to confusion and helps teams move forward with confidence.'
WHERE slug = 'problem-solving';
UPDATE factors SET strength_commentary =
  'You bring a sharp, evidence-based lens to decisions and are able to cut through noise to identify what really matters. This is a valuable strength in environments where information overload is common — your ability to evaluate quality of evidence helps protect against poor decisions.'
WHERE slug = 'critical-analysis';
UPDATE factors SET strength_commentary =
  'You create space for others to feel genuinely heard, which builds trust and surfaces information that might otherwise stay hidden. This strength is foundational to effective teamwork — when people feel listened to, they contribute more openly and collaborate more willingly.'
WHERE slug = 'active-listening';
UPDATE factors SET strength_commentary =
  'You have a well-developed ability to understand and connect with others'' perspectives and emotions. This strength enables you to build strong, authentic working relationships and navigate sensitive situations with care — qualities that are increasingly valued in complex team environments.'
WHERE slug = 'empathy';
UPDATE factors SET strength_commentary =
  'You show a strong capacity to guide others through transitions and help them adapt to new ways of working. This is a critical leadership strength — organisations that manage change well consistently outperform those that don''t, and your ability to bring people along is a key part of that.'
WHERE slug = 'change-management';
UPDATE factors SET strength_commentary =
  'You maintain your effectiveness and composure even when facing setbacks or uncertainty. This is a powerful strength — resilient individuals not only recover faster from difficulties but often emerge stronger, and their steadiness has a stabilising effect on those around them.'
WHERE slug = 'resilience';
UPDATE factors SET strength_commentary =
  'You demonstrate a genuine sensitivity to diverse perspectives and cultural contexts. This strength is increasingly essential in global and diverse workplaces — your ability to navigate cultural differences helps build inclusive environments where all team members can contribute their best work.'
WHERE slug = 'cultural-awareness';
-- ---------------------------------------------------------------------------
-- Factors — development_suggestion
-- ---------------------------------------------------------------------------

UPDATE factors SET development_suggestion =
  'Consider building your strategic thinking by regularly setting aside time to step back from day-to-day tasks and reflect on longer-term patterns. Practice connecting current decisions to future outcomes — ask yourself "what does this mean six months from now?" before committing to a course of action.'
WHERE slug = 'strategic-thinking';
UPDATE factors SET development_suggestion =
  'To strengthen your problem-solving approach, try deliberately slowing down when you encounter a challenge. Before jumping to solutions, spend time clearly defining the problem and exploring its root causes. Techniques like the "five whys" or mapping out the problem visually can help you get beneath surface-level symptoms.'
WHERE slug = 'problem-solving';
UPDATE factors SET development_suggestion =
  'Developing your critical analysis skills starts with becoming more intentional about questioning assumptions — both your own and others''. When presented with data or arguments, practise asking: "What evidence supports this? What might be missing? What alternative explanations exist?" Building this habit will sharpen your judgement over time.'
WHERE slug = 'critical-analysis';
UPDATE factors SET development_suggestion =
  'Active listening can be developed through conscious practice. In your next few conversations, try focusing entirely on understanding the other person before formulating your response. Resist the urge to interrupt or plan what you''ll say next — instead, paraphrase what you''ve heard to confirm understanding before moving on.'
WHERE slug = 'active-listening';
UPDATE factors SET development_suggestion =
  'Building empathy is often about creating more opportunities to understand perspectives different from your own. Start by asking more open-ended questions in conversations and genuinely exploring the answers. When you disagree with someone, try to articulate their position in a way they would recognise before presenting your own view.'
WHERE slug = 'empathy';
UPDATE factors SET development_suggestion =
  'Strengthening your change management capability begins with recognising that people process change at different speeds. Focus on communicating the "why" behind changes clearly and repeatedly, and create structured opportunities for people to voice concerns. Small wins early in a transition build momentum and confidence.'
WHERE slug = 'change-management';
UPDATE factors SET development_suggestion =
  'Building resilience is a gradual process. Start by developing awareness of your stress responses — notice what triggers frustration or withdrawal, and experiment with strategies that help you reset (such as brief pauses, reframing the situation, or seeking perspective from a trusted colleague). Over time, these small practices build a stronger foundation for handling pressure.'
WHERE slug = 'resilience';
UPDATE factors SET development_suggestion =
  'Growing your cultural awareness starts with genuine curiosity. Seek out conversations with colleagues from different backgrounds and ask about their experiences and perspectives. When working across cultures, avoid assuming that your default communication style or expectations are universal — instead, ask what works best and adapt accordingly.'
WHERE slug = 'cultural-awareness';
-- ---------------------------------------------------------------------------
-- Constructs — strength_commentary
-- ---------------------------------------------------------------------------

UPDATE constructs SET strength_commentary =
  'You show strong analytical reasoning — the ability to break down complex information into its component parts and see how they connect. This is a foundational cognitive strength that supports good decision-making across virtually every professional context.'
WHERE slug = 'analytical-reasoning';
UPDATE constructs SET strength_commentary =
  'You communicate ideas with clarity and fluency, both in writing and speech. This is a significant strength — people who articulate their thinking well are better able to influence, persuade, and align others around shared goals.'
WHERE slug = 'verbal-fluency';
UPDATE constructs SET strength_commentary =
  'You demonstrate a strong capacity to adjust your approach when circumstances change. This flexibility is increasingly valuable in fast-moving environments — your willingness to adapt means you''re less likely to get stuck and more likely to find effective paths forward when plans shift.'
WHERE slug = 'adaptability';
UPDATE constructs SET strength_commentary =
  'You bring a high degree of thoroughness and precision to your work. This attention to detail helps ensure quality and accuracy, reducing errors and building trust with those who rely on your outputs.'
WHERE slug = 'attention-to-detail';
UPDATE constructs SET strength_commentary =
  'You show a strong ability to maintain composure and performance under pressure. This is a valuable trait — your capacity to stay focused when things get difficult has a positive ripple effect on team morale and enables sound decision-making in high-stakes moments.'
WHERE slug = 'stress-tolerance';
-- ---------------------------------------------------------------------------
-- Constructs — development_suggestion
-- ---------------------------------------------------------------------------

UPDATE constructs SET development_suggestion =
  'To develop your analytical reasoning, practise working through problems in a more structured way. When you encounter new information, try mapping out the key variables and their relationships before drawing conclusions. Puzzles, case studies, and data interpretation exercises can also help build this cognitive muscle.'
WHERE slug = 'analytical-reasoning';
UPDATE constructs SET development_suggestion =
  'Strengthening verbal fluency comes with practice and feedback. Try preparing key points before important conversations, and afterwards reflect on how clearly your message landed. Reading widely also helps — exposure to strong writing builds your vocabulary and sense of structure over time.'
WHERE slug = 'verbal-fluency';
UPDATE constructs SET development_suggestion =
  'Building adaptability starts with getting more comfortable with ambiguity. When plans change, practise pausing before reacting and asking "what opportunities does this create?" Deliberately putting yourself in unfamiliar situations — new projects, cross-functional teams, different approaches — gradually builds your change comfort.'
WHERE slug = 'adaptability';
UPDATE constructs SET development_suggestion =
  'Developing attention to detail is about building better systems and habits rather than just trying harder. Consider using checklists for recurring tasks, building in review steps before submitting important work, and reducing distractions during tasks that require precision. Small structural changes often have a bigger impact than willpower alone.'
WHERE slug = 'attention-to-detail';
UPDATE constructs SET development_suggestion =
  'Building stress tolerance is a long-term investment. Start by developing greater awareness of your early stress signals — the physical and emotional cues that tell you pressure is building. Then experiment with techniques that help you regulate in the moment: controlled breathing, brief movement breaks, or stepping back to reframe the situation in perspective.'
WHERE slug = 'stress-tolerance';
-- ---------------------------------------------------------------------------
-- Dimensions — strength_commentary & development_suggestion
-- ---------------------------------------------------------------------------

UPDATE dimensions SET strength_commentary =
  'Your cognitive abilities are a clear strength. You process information effectively, think critically, and apply sound reasoning to complex situations. This cognitive foundation supports strong performance across a wide range of professional challenges.'
WHERE slug = 'cognitive-ability';
UPDATE dimensions SET strength_commentary =
  'Your interpersonal skills stand out as a real strength. You connect well with others, communicate effectively, and create the kind of relational trust that enables productive collaboration. These skills are the foundation of high-performing teams.'
WHERE slug = 'interpersonal-skills';
UPDATE dimensions SET strength_commentary =
  'You demonstrate strong leadership capabilities. Your ability to guide others, manage change, and make sound decisions under pressure positions you well to take on increasing responsibility and influence within your organisation.'
WHERE slug = 'leadership';
UPDATE dimensions SET strength_commentary =
  'Your emotional intelligence is a notable strength. You show self-awareness, empathy, and the ability to manage your responses under pressure — qualities that enable you to navigate complex interpersonal dynamics and maintain effectiveness in challenging situations.'
WHERE slug = 'emotional-intelligence';
UPDATE dimensions SET development_suggestion =
  'Strengthening your cognitive abilities involves building better thinking habits. Practise approaching problems more systematically, seek out diverse sources of information before forming conclusions, and make time for reflection on the quality of your decisions — not just the outcomes.'
WHERE slug = 'cognitive-ability';
UPDATE dimensions SET development_suggestion =
  'Developing your interpersonal skills starts with being more intentional in your interactions. Focus on listening more deeply, asking better questions, and seeking to understand others'' perspectives before sharing your own. Small, consistent improvements in how you engage with others can have a significant cumulative impact.'
WHERE slug = 'interpersonal-skills';
UPDATE dimensions SET development_suggestion =
  'Growing as a leader often means becoming more comfortable with ambiguity and more deliberate about bringing others along. Focus on communicating your thinking clearly, creating space for input from your team, and building the trust that enables people to follow your lead through uncertainty.'
WHERE slug = 'leadership';
UPDATE dimensions SET development_suggestion =
  'Building emotional intelligence is a gradual process that starts with self-awareness. Pay attention to your emotional responses throughout the day — what triggers them, how they affect your behaviour, and how they impact those around you. With greater awareness comes greater choice in how you respond.'
WHERE slug = 'emotional-intelligence';
