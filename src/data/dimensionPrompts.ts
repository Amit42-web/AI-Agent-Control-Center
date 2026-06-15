export interface DimensionPromptDefault {
  id: string;
  label: string;
  color: string; // tailwind color name for badge
  tags: string[]; // topic chips shown on collapsed card
  defaultPrompt: string;
}

export const DEFAULT_DIMENSION_PROMPTS: DimensionPromptDefault[] = [
  {
    id: 'A',
    label: 'Conversation Control & Flow',
    color: 'blue',
    tags: ['Circular loops', 'Dead ends', 'Topic drops', 'Lost objective', 'Premature closure'],
    defaultPrompt: `Evaluate whether the agent maintains direction and purpose of the call from opening to close.

FLAG if the agent:
- Loses the main call objective mid-conversation and does not recover
- Creates a dead end: asks a question, receives a clear answer, then fails to use that answer to advance the conversation
- Enters a circular loop: repeats the same question or statement two or more times without acknowledging the previous answer
- Drops a topic the customer explicitly raised without resolution or acknowledged deferral
- Declares resolution before the customer has confirmed their issue is addressed
- Fails to close a topic before opening a new one, leaving multiple threads unresolved

DO NOT FLAG if:
- Customer-initiated digression is handled gracefully and agent returns to the goal
- Brief detour occurs but the outcome is still reached
- Topic deferral is acknowledged and accepted by the customer

TRANSCRIPT LIMITATION applies if: Call is cut, merged turns obscure conversational sequence, or topic boundaries cannot be reliably traced.

SEVERITY: High = agent loses primary objective entirely, customer left unresolved | Medium = loop or dead end causes visible confusion | Low = minor flow interruption, agent recovers`,
  },
  {
    id: 'B',
    label: 'Temporal Dynamics & Turn-Taking',
    color: 'cyan',
    tags: ['Interruptions', 'Rushed disclosures', 'Pacing issues', 'Long monologues', 'Silence handling'],
    defaultPrompt: `Evaluate whether the agent respects conversational rhythm — pacing, timing, and the give-and-take of turns.

FLAG if the agent:
- Interrupts the customer before a clearly incomplete utterance is finished (use timestamps — agent turn starting within 1–2 seconds of customer turn starting indicates potential overlap)
- Rushes through a material disclosure — pricing, T&C, commitment, or risk information delivered at a pace that leaves no processing space before the customer is expected to respond
- Proceeds to the next step without customer acknowledgment when the step requires one
- Fills silence with confusing filler that creates false impressions or introduces new information before the customer has confirmed they want that action
- Delivers a monologue exceeding 4–5 continuous turns on complex topics without checking customer understanding

DO NOT FLAG if:
- Agent responds quickly to a clearly complete customer utterance
- Brief filler ("just a moment", "let me check") serves a functional purpose
- Customer sets a fast pace and agent matches it without quality degradation
- Timestamps are missing or unreliable — apply Transcript Limitation instead

TRANSCRIPT LIMITATION applies if: Timestamps are absent, ASR has merged turns, or turn boundary cannot be reliably determined. Do NOT infer interruption from text alone.

SEVERITY: High = rushed material disclosure or missed acknowledgment on a commitment step | Medium = interruption or filler causes customer confusion | Low = minor pacing issue with no downstream impact`,
  },
  {
    id: 'C',
    label: 'Context Tracking & Intent Alignment',
    color: 'green',
    tags: ['Re-asking info', 'Wrong intent', 'Missed signals', 'Sub-intent drops', 'Context contradiction'],
    defaultPrompt: `Evaluate whether the agent retains and correctly applies information established earlier in the call, and addresses what the customer actually means — not just what they literally said.

FLAG if the agent:
- Re-asks for information the customer already provided without a legitimate verification reason
- Addresses the wrong intent: customer states X, agent responds as if customer stated Y
- Misses an implicit intent signal: customer expresses a concern or secondary need alongside their primary request — agent resolves the primary but ignores the signal
- Drops a sub-intent: customer raises two issues or questions; agent resolves the first and closes without acknowledging the second
- Contradicts established context: states something inconsistent with what was confirmed earlier in the same call
- Fails to connect prior information to current decision (e.g., customer mentioned a constraint at turn 2; agent ignores it at turn 15)

DO NOT FLAG if:
- Agent re-confirms information specifically for verification or compliance (this is Process/F, not context failure)
- Customer changes their own stated intent mid-call and agent adjusts accordingly
- Clarification questions are asked because the original customer statement was genuinely ambiguous

TRANSCRIPT LIMITATION applies if: Turns are merged or compressed so that it cannot be determined whether the agent had access to prior context at the time of the response.

SEVERITY: High = agent acts on wrong intent or drops a customer constraint, leading to an unintended commitment | Medium = re-ask or context miss causes rework or visible frustration | Low = minor context gap, recovered without customer impact`,
  },
  {
    id: 'D',
    label: 'Language Quality & Human-Likeness',
    color: 'purple',
    tags: ['Robotic phrasing', 'Code-switching', 'Scripted repetition', 'Register mismatch', 'Jargon without clarity'],
    defaultPrompt: `Evaluate whether the agent's language sounds natural, appropriate, and clear — or robotic, scripted, or confusing in a way that degrades the customer experience.

This dimension applies to Hinglish (Hindi + English) calls. The agent is expected to match the customer's dominant language register. Code-switching is normal and acceptable — the issue is whether it creates confusion or distance.

FLAG if the agent:
- Uses generic scripted empathy phrases without any reference to the customer's specific situation (e.g., "I understand your concern" said to every customer regardless of what was expressed)
- Produces grammatically broken output that makes the intended meaning unclear
- Fails to follow the customer's language lead: customer speaks primarily in Hindi, agent responds predominantly in English — or vice versa — in a way that creates a communication gap
- Over-formalizes a conversational moment or under-formalizes a disclosure or commitment step
- Repeats the exact same scripted phrase verbatim two or more times in the same call without variation
- Uses domain jargon without simplification when the customer has signaled they don't understand, and does not rephrase when the customer signals confusion

DO NOT FLAG if:
- Agent uses formal register in compliance disclosures, T&C, or risk statements (appropriate register)
- Occasional code-switching that follows the customer's own pattern
- Hindi or regional language phrasing is technically imperfect but meaning is fully clear
- ASR artifacts create apparent language errors — apply Transcript Limitation

TRANSCRIPT LIMITATION applies if: Language errors appear to stem from ASR misrecognition, not from agent generation.

SEVERITY: High = language failure creates a materially false understanding or causes customer to misinterpret a commitment | Medium = language choice causes real confusion or requires customer to ask for clarification | Low = minor phrasing issue, meaning ultimately clear, no impact on outcome`,
  },
  {
    id: 'E',
    label: 'Knowledge & Accuracy',
    color: 'orange',
    tags: ['False claims', 'Removed qualifiers', 'Unsupported info', 'Hardened commitments', 'Source contradiction'],
    defaultPrompt: `Evaluate whether the agent states things that are factually correct and appropriately scoped relative to approved sources (KB and/or Script).

FLAG if the agent:
- Makes a factual claim not supported by KB or Script — introduces information with no approved source backing
- Strengthens a claim beyond the source: approved source says "typically within 3–5 business days" — agent says "you'll receive it in 3 days"
- Removes a material qualifier: source says "subject to approval" or "as per current policy" — agent omits this, creating false certainty
- Contradicts the source directly: agent states X, KB/Script states the opposite or a meaningfully different version
- States something as definitive when the source presents it as conditional, approximate, or process-dependent

DO NOT FLAG if:
- Agent paraphrases or simplifies language while preserving the intent and accuracy of the source
- Agent omits background information not relevant to the customer's specific question
- Statement is Script-backed even if not present in KB (Script authority applies)
- KB or Script was not provided — accuracy cannot be evaluated without a source; note this and set Confidence Level: Low

TRANSCRIPT LIMITATION applies if: The relevant portion of KB or Script is absent from inputs, making it impossible to verify whether the agent's statement was sourced or unsourced.

SEVERITY: High = incorrect commitment on pricing, eligibility, dates, or compliance-relevant terms; false certainty on an outcome the agent cannot guarantee | Medium = inaccuracy sets a wrong expectation but is non-critical | Low = minor detail error, no change to customer expectation or decision`,
  },
  {
    id: 'F',
    label: 'Process & Policy Adherence',
    color: 'pink',
    tags: ['Skipped steps', 'Consent gates', 'Wrong sequence', 'Unauthorized actions', 'Policy misapplication'],
    defaultPrompt: `Evaluate whether the agent executes required procedural steps in the right sequence — judging whether the RISK CONTROL FUNCTION of each step was fulfilled, not whether exact scripted language was used.

If the 8-Pillar Framework is not provided in inputs, limit evaluation to process steps explicitly defined in the KB or Script only.

FLAG if the agent:
- Skips a mandatory step that has a clear risk control function — most critically: accessing, sharing, or acting on account information before identity verification is complete
- Executes steps out of required sequence where sequence exists specifically to manage risk
- Proceeds past a consent or confirmation gate without obtaining it — moves forward on a commitment or action that policy requires the customer to explicitly acknowledge first
- Takes an action outside their authorized scope — makes a commitment, offers a resolution, or performs an operation the agent role is not permitted to execute
- Applies a policy incorrectly — policy exists, agent references it, but applies the wrong condition or threshold

DO NOT FLAG if:
- Agent omits a step the customer explicitly waived and the underlying risk was still addressed (Evidence Sufficiency Principle applies)
- Agent uses different wording or sequence for non-risk-critical, non-mandatory steps
- Step is a best-practice recommendation but not policy-mandated
- Call ends before the step would have naturally been reached

TRANSCRIPT LIMITATION applies if: Call is cut before the relevant step would have occurred, or merged turns make it impossible to determine whether a step was completed or bypassed.

SEVERITY: High = security/identity gate bypassed before account access; unauthorized commitment; prohibited action; policy misapplied creating compliance or financial risk | Medium = required step skipped but risk impact is indirect or partially recovered | Low = technically non-compliant deviation, no material risk, no customer impact`,
  },
  {
    id: 'G',
    label: 'Novel & Emerging Issues',
    color: 'yellow',
    tags: ['AI hallucinations', 'Bias / insensitivity', 'Privacy concerns', 'Emerging patterns', 'Uncategorized'],
    defaultPrompt: `Use this dimension ONLY for behavior that does not clearly fit dimensions A–F, is not explicitly covered by KB, Script, or the 8-Pillar framework, but a senior human QA would still consider noteworthy.

WHEN TO USE:
- Behavior that is genuinely new or unprecedented in your evaluation framework
- Patterns that suggest a needed update to dimensions A–F
- AI-specific problems: hallucinations, contradictions, memory breakdown
- Bias, cultural insensitivity, or data handling concerns
- Emerging customer pain points not covered in existing dimensions

REQUIREMENTS when classifying as Novel:
- Be specific about what makes this different from A–F
- State which existing dimension it is CLOSEST to
- Do NOT over-assign severity — novel issues have uncertain impact
- Avoid Prompt fixes unless recurrence is proven across multiple calls
- Must be evidence-based — no speculation

DO NOT USE G to avoid making a harder classification decision. Only use G when A–F genuinely do not apply.`,
  },
];
