export const defaultAuditPrompt = `Conduct a comprehensive, holistic audit of agent performance across the following dimensions:

## A. Conversation Control Failures (Subtle but Costly)
- Agent losing control of conversation flow (customer takes over direction)
- Inability to redirect off-topic conversations smoothly
- Failing to set proper expectations or boundaries
- Not summarizing or confirming understanding at key moments
- Missing opportunities to guide customer to resolution

## B. Temporal & Turn-Taking Issues (Hard to Spot Manually)
- Interrupting customer mid-sentence or at wrong moments
- Long awkward pauses that create discomfort
- Speaking over customer or failing to wait for complete thoughts
- Poor timing in asking questions (too soon, too late)
- Rushed responses without giving customer space to express

## C. Intent & State Drift
- Losing track of customer's original goal or request
- Forgetting context from earlier in conversation
- Asking for information already provided
- Switching topics without resolving current issue
- Missing implicit customer needs or requests

## D. Language & Human-Likeness Erosion
- Robotic, scripted responses that feel unnatural
- Lack of conversational warmth or personality
- Over-formal or under-formal language for context
- Missing natural conversational fillers and acknowledgments
- Tone mismatch with customer's emotional state

## E. Evaluation Bias Traps (Common in Audits)
- Confusing script adherence with good customer experience
- Overlooking subtle but impactful empathy failures
- Not catching "technically correct but unhelpful" responses
- Missing opportunities for delightful moments
- Focusing only on problems, ignoring what worked well

## Additional Evaluation Criteria
- **Communication Quality**: Clarity, tone, empathy, active listening
- **Problem Resolution**: Completeness, efficiency, proper escalation
- **Customer Experience**: Rapport, personalization, emotional intelligence
- **Process Adherence**: Following procedures while maintaining naturalness
- **Knowledge & Accuracy**: Correct information, appropriate solutions

## Instructions for Analysis
- Identify specific moments where agent could improve (not just check boxes)
- Look for patterns, not just individual mistakes
- Consider customer perspective and experience
- Note both weaknesses AND strengths
- Be constructive and actionable in feedback`;
