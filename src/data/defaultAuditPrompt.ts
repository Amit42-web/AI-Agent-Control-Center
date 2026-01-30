export const defaultAuditPrompt = `Conduct a comprehensive, holistic audit of agent performance across the following dimensions.

You MUST categorize each scenario into one of these PRIMARY dimensions (A-F), or identify it as a NOVEL issue (G):

## A. Conversation Control & Flow Management
- Agent losing control of conversation flow (customer dictates direction)
- Inability to redirect off-topic conversations smoothly
- Failing to set proper expectations, boundaries, or next steps
- Not summarizing or confirming understanding at key moments
- Missing opportunities to guide customer toward resolution
- Poor problem-solving structure or escalation timing

## B. Temporal Dynamics & Turn-Taking
- Interrupting customer mid-sentence or at inappropriate moments
- Long awkward pauses that create discomfort or confusion
- Speaking over customer or failing to wait for complete thoughts
- Poor timing in asking questions (too soon, too late, too many)
- Rushed responses without giving customer space to express fully
- Pacing issues (too slow, too fast, inconsistent rhythm)

## C. Context Tracking & Intent Alignment
- Losing track of customer's original goal or request
- Forgetting context or information from earlier in conversation
- Asking for information already provided (shows not listening)
- Switching topics without resolving current issue
- Missing implicit customer needs, emotions, or requests
- Failing to connect dots between related customer statements

## D. Language Quality & Human-Likeness
- Robotic, overly scripted responses that feel unnatural
- Lack of conversational warmth, personality, or empathy
- Over-formal or under-formal language for the context
- Missing natural conversational fillers and acknowledgments
- Tone mismatch with customer's emotional state
- Poor word choice, clarity, or communication effectiveness

## E. Knowledge & Accuracy
- Providing incorrect information or solutions
- Demonstrating gaps in product/service knowledge
- Missing relevant information that would help customer
- Failing to leverage knowledge base or reference materials appropriately
- Making assumptions instead of confirming facts

## F. Process & Policy Adherence
- Not following required procedures or compliance requirements
- Skipping verification steps or security protocols
- Failing to document interactions properly
- Missing required disclosures or confirmations
- Balancing script adherence with natural conversation

## G. NOVEL & EMERGING ISSUES (Adaptive Discovery)
**IMPORTANT**: If you identify a pattern or issue that does NOT fit clearly into dimensions A-F above, categorize it here as a NOVEL issue.

Examples of potential novel issues:
- Bias, discrimination, or cultural insensitivity
- Privacy violations or data handling concerns
- AI-specific problems (hallucinations, contradictions)
- Emerging customer pain points not covered in training
- New competitive threats or market changes reflected in calls
- Unusual technical issues or system limitations
- Patterns that suggest needed updates to A-F dimensions

When categorizing as NOVEL:
- Be specific about what makes this different from A-F
- Describe the pattern clearly so humans can evaluate it
- Suggest which existing dimension it's CLOSEST to (if any)

## Analysis Instructions
- **Primary Goal**: Identify specific, actionable moments where agent could improve
- **Pattern Focus**: Look for recurring issues across the conversation, not just one-off mistakes
- **Customer Lens**: Always consider impact on customer experience, trust, and satisfaction
- **Balanced View**: Note both weaknesses AND strengths where agent excelled
- **Constructive Tone**: Be specific and actionable, not just critical
- **Subtle Issues**: Catch the "technically correct but unhelpful" responses that humans often miss
- **Novel Detection**: Stay alert for issue types that don't fit existing dimensions
- **Avoid Duplicates**: If you identify multiple instances of the SAME underlying issue (e.g., "skipped bike verification" vs "missed mandatory bike check"), consolidate them into ONE scenario with consistent wording. Use precise, standardized titles to prevent duplicate categorization.

Quality over quantity - each scenario should be meaningful, clearly categorized, and actionable. Use consistent terminology in titles to avoid creating duplicate issues.`;
