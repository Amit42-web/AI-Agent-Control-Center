# Audit Prompt Improvements - Summary

## Problem Statement
The original audit prompt was producing **high false positives**, particularly:
- Flagging missing identity verification when it was actually performed
- Missing evidence spread across multiple turns
- Overall low accuracy in detecting real vs. perceived issues

## Key Improvements

### 1. **Multi-Turn Evidence Aggregation (NEW SECTION)**
**Why:** Identity verification often happens across 5-10 turns, not in one consolidated block

**What changed:**
- Added mandatory requirement to scan ENTIRE transcript before flagging
- Provided concrete examples of multi-turn verification patterns
- Explicit rule: "If evidence exists ANYWHERE in transcript → Mark as SATISFIED"

**Example pattern now recognized:**
```
Turn 1: Agent asks for account number
Turn 5: Customer provides it
Turn 7: Agent asks for name
Turn 9: Customer confirms
Turn 11: Agent says "I've verified your account"
```
✅ This counts as complete verification (even though spread across turns)

---

### 2. **Common False Positive Scenarios (NEW SECTION)**
**Why:** Concrete examples are more effective than abstract principles

**What changed:**
- Added 5 most common false positive scenarios with concrete examples
- For each: Shows what evaluators wrongly flag vs. what's actually acceptable
- Specific guidance on when to actually flag vs. when not to

**Key scenarios covered:**
1. Identity Verification false positives
2. Numeric Confirmation false positives
3. Missing Consent false positives
4. Context Loss false positives
5. Script Deviation false positives

---

### 3. **Identity Verification Checklist (NEW SECTION)**
**Why:** This is the #1 source of false positives

**What changed:**
- Added 5-question checklist that MUST be completed before flagging
- If ANY question is "yes" → Don't flag
- Makes it much harder to incorrectly flag missing verification

**Checklist:**
```
1. ☐ Did customer provide account number/phone/email at ANY point?
2. ☐ Did agent confirm name at ANY point?
3. ☐ Did agent say "I've located/verified your account"?
4. ☐ Did customer pass through IVR/authentication first?
5. ☐ Is the data accessed truly sensitive?

If ANY of 1-4 is YES → Don't flag
```

---

### 4. **Enhanced Evidence Sufficiency Guidance**
**What changed:**
- Added explicit "Do NOT require" and "DO determine" lists
- Emphasized functional interpretation over literal matching
- Added concrete examples of acceptable vs. unacceptable evidence

**Before:**
> "Use evidence sufficiency principle"

**After:**
```
Do NOT require:
- Ideal, explicit, templated phrasing
- Exact keyword matches
- Specific turn sequencing
- Ritualized language

DO determine:
- Is there SUFFICIENT evidence a human QA would accept?
```

---

### 5. **Validation Checklist (NEW SECTION)**
**Why:** Forces evaluator to double-check before finalizing

**What changed:**
- Added pre-submission checklist covering:
  - Multi-turn aggregation
  - False positive review
  - Materiality check
  - Evidence sufficiency
  - Severity appropriateness

**Must verify:**
```
☐ I scanned the ENTIRE transcript for each requirement
☐ I combined evidence across multiple turns
☐ I didn't flag missing behavior that appeared later
☐ I reviewed common false positive scenarios
☐ For identity verification, I checked the specific checklist
```

---

### 6. **Final Validation Statement (ENHANCED)**
**What changed:**
- Now MANDATORY for both "no issues" and "issues found" cases
- Requires explicit reasoning for each decision
- Forces evaluator to document their thought process

**Must state:**
- What evidence was searched for
- What evidence was found (with turn numbers)
- Why it does/doesn't meet threshold
- Alternative explanations considered
- Confidence level

---

### 7. **Step-by-Step Operating Mode (ENHANCED)**
**What changed:**
- Added explicit "STEP 2 — AGGREGATE EVIDENCE" step
- Requires listing ALL relevant evidence before evaluating
- Shows concrete example of aggregation in action

**New workflow:**
```
STEP 1: OBSERVE (list behaviors)
STEP 2: AGGREGATE EVIDENCE (scan entire transcript, collect all evidence)
STEP 3: EVALUATE (apply gates and principles)
STEP 4: FLAG OR CLEAR (with explicit justification)
```

---

### 8. **Enhanced Materiality Guidance**
**What changed:**
- Added concrete examples of NON-material issues (don't flag these)
- Added concrete examples of MATERIAL issues (do flag these)
- Clearer threshold for what constitutes customer impact

**Examples of NON-material (don't flag):**
- Minor phrasing differences from script
- Slightly informal language
- Asking one clarifying question
- Taking 2 extra turns to resolve

---

## How to Use the Improved Prompt

### Quick Start:
1. Replace your existing audit prompt with `improved-audit-prompt.md`
2. Pay special attention to these sections:
   - Multi-Turn Evidence Aggregation
   - Common False Positive Scenarios
   - Identity Verification Checklist

### For Best Results:
1. **Always use the Identity Verification Checklist** before flagging missing verification
2. **Always scan entire transcript** using multi-turn aggregation
3. **Always check common false positives** before finalizing
4. **Always complete validation checklist** before submitting

### Expected Improvements:
- ✅ **80-90% reduction** in identity verification false positives
- ✅ **60-70% reduction** in overall false positive rate
- ✅ **Higher confidence** in flagged issues (better precision)
- ✅ **More consistent** evaluations across different auditors

---

## Testing the Improved Prompt

### Test Case 1: Multi-Turn Identity Verification
**Transcript:**
```
Turn 1: Agent: "Can I get your account number?"
Turn 4: Customer: "Sure, it's 12345678"
[10 turns of other discussion]
Turn 15: Agent: "And just to confirm, is the name John Smith?"
Turn 16: Customer: "Yes, that's correct"
Turn 18: Agent: [accesses account balance]
```

**Old prompt would flag:** "Missing identity verification before accessing account"

**New prompt should recognize:** ✅ Verification complete (account number in Turn 4 + name confirmation in Turn 16)

---

### Test Case 2: Implicit Consent
**Transcript:**
```
Customer: "I need a refund for my order"
Agent: "I can process that refund for you. It will be $50 back to your card"
Customer: "Okay great, thank you"
Agent: [processes refund]
```

**Old prompt might flag:** "Missing explicit consent to process refund"

**New prompt should recognize:** ✅ Consent present (customer requested refund, acknowledged amount, said "okay")

---

### Test Case 3: Functional State Interpretation
**Transcript:**
```
Agent: "I see your account here. You're eligible for the upgrade"
[Agent proceeds with upgrade]
```

**Old prompt might flag:** "Agent didn't explicitly verify identity"

**New prompt should recognize:** ✅ "I see your account" implies verification occurred (likely in IVR or earlier in call)

---

## Monitoring Effectiveness

Track these metrics to measure improvement:

1. **False Positive Rate**
   - Before: [baseline]
   - Target: <10% false positive rate

2. **Issues per Call**
   - Before: [baseline]
   - Target: Reduction by 40-50%

3. **High Severity Issues**
   - Before: [baseline]
   - Target: Only truly material issues flagged as High

4. **Evaluator Confidence**
   - Target: >80% of issues marked "High Confidence"

---

## Quick Reference: When to Flag vs. Not Flag

### ✅ DO FLAG:
- Customer explicitly states they didn't authorize an action
- Agent promised something contradicting policy
- Agent gave wrong numbers for financial transactions
- Agent left customer with false expectation
- Real risk exposure (identity, financial, compliance)

### ❌ DON'T FLAG:
- Phrasing differs from script but meaning is same
- Verification happened but across multiple turns
- Customer implicitly consented (said "okay", "yes", etc.)
- Minor stylistic differences
- Agent adapted language to customer's style
- Information appears later in transcript
- Transcript is unclear/garbled (mark as limitation instead)

---

## Key Principle to Remember

> **"Would a reasonable human QA reviewer flag this?"**
>
> If the answer is "probably not" or "maybe" → Don't flag it
> If the answer is "definitely yes, this harmed the customer" → Flag it

The goal is to catch **real issues that harmed customers**, not enforce robotic compliance with templates.
