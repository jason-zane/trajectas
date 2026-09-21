# Public experience redesign — decisions and research

User brief: a substantial homepage and Role Builder redesign; first generated concept's feel; modern, precise, product-led; simple and considered; designed for open access while keeping the current invite gate; animation that reports actual work.

## Research applied

- Nielsen Norman Group, [AI Design Tools Are Marginally Better](https://www.nngroup.com/articles/ai-design-tools-update-2/), 9 May 2025: generated prototypes still need contextual judgement and a coherent design system. Used as evidence to treat the mock as art direction and implement consistent real controls, states and verified copy. This dated evaluation is not a claim about every current AI tool.
- NN/g, [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/): expose primary choices first, reveal secondary detail when useful. Applied to capability rationale, role interpretation and alternatives.
- GOV.UK, [Question pages](https://design-system.service.gov.uk/patterns/question-pages/): focus a step on its task, provide clear headings and retain entered answers. Applied to email verification, role entry and capability review.

“Anti-AI design” is not a formal usability standard. Here it means decisions grounded in this product: role-specific evidence, one main action at each step, restrained hierarchy, real brand assets, truthful waiting states, consistent controls and complete failure paths. No automatic benefit is assumed from merely removing gradients or choosing a particular typeface.

## What changed in the process

1. Homepage explains role-to-capability matching with an illustrative interactive example. Preview restrictions are stated next to the action.
2. Verification remains first: upload extraction and AI already require a verified email. A concise benefit summary explains the exchange before the form.
3. The role step now asks only for role title and description. Upload has size/type feedback and lets the visitor review extracted text. Length selection is deferred until it has context.
4. Actual extraction and matching drive waiting states. Extracted responsibilities appear immediately after extraction succeeds. Elapsed time describes time spent, not a promised completion estimate.
5. The matcher recommendation sets the starting number of capabilities, bounded to 4–8 and available picks. No duplicate overview AI call: ranking summary and individual rationales already supply the explanation. This also avoids a stale overview after selection changes.
6. Review uses stable checkbox rows and inline disclosure; it removes nested buttons, floating detail dialogs and decorative pin/unpin terminology. Counts and duration update from canonical constants.
7. Creation immediately offers the assessment link. Email delivery success/failure is reported accurately. “Build another” was removed because the backend allows only one live assessment per email.
8. Recovery checks the signed visitor cookie and email-scoped records before retrying uncertain creation. No caller-supplied email authorizes a lookup. Local tab drafts are optional, scoped and not trusted for authorization.
9. Off mode now has an honest unavailable screen, rather than a form that only fails on submit.

## Production boundaries

The existing Architect extraction, ranking, item selection, authorization, caps, campaign creation, runner and report generation remain the underlying service. No database migration, production mutation, gate change or deployment is included.

Visual and interaction checks use a local demo with the actual UI components and explicitly simulated responses. Live OTP delivery, AI/provider latency, existing database migration state, assessment creation and report emailing need a staging acceptance run before release. The existing non-transactional create pipeline and expired-live-build lifecycle are outside this UI change; recovery now makes their state visible but does not redefine it.
