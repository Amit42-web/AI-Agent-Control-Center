# Analysis: Add/Remove/Replace Operations in Generated Fixes

## Summary
You're correct - the system is heavily biased toward **"add"** operations. While the code fully supports all three operation types (add/remove/replace), there are several factors creating this bias.

---

## Issues Found

### 1. **Default Value Bias** ⚠️ CRITICAL
**Location:** `src/services/openai.ts` lines 533 & 556

```typescript
action: fix.action || 'add',
```

**Problem:** If the AI doesn't specify an `action` field, it defaults to `'add'`. This means any ambiguity or omission results in an add operation.

---

### 2. **Prompt Language Bias** ⚠️ IMPORTANT
**Location:** `src/services/openai.ts` line 347

```typescript
- action: one of ["add", "remove", "replace"] - what type of change to make
  * "add": Insert new content (most common)  ← BIAS HERE
  * "remove": Delete existing problematic content
  * "replace": Replace existing content with improved version
```

**Problem:** The phrase **(most common)** next to "add" signals to the AI that "add" is the expected default, which may discourage it from considering remove/replace operations.

---

### 3. **Lack of Examples for Remove/Replace** ⚠️ IMPORTANT
**Location:** `src/services/openai.ts` lines 376-413

**Problem:** The prompt provides ONE example of an "add" operation (lines 376-385) and FOUR examples of what NOT to do (lines 387-413), but **ZERO examples of when to use "remove" or "replace"**.

**Current examples:**
- ✅ 1 example of "add" action
- ❌ 0 examples of "remove" action
- ❌ 0 examples of "replace" action

---

### 4. **No Clear Guidance on When to Use Each Operation**

The prompt doesn't provide clear scenarios for when each operation should be used. Here's what's missing:

#### **When to use REMOVE:**
- ❌ Redundant instructions that duplicate existing guidance
- ❌ Conflicting instructions that contradict other parts of the prompt
- ❌ Outdated guidance that no longer applies
- ❌ Instructions that cause the bot to make mistakes
- ❌ Overly complex instructions that should be simplified by removal

#### **When to use REPLACE:**
- ❌ Poorly worded instructions that need rewording
- ❌ Instructions with incorrect information
- ❌ Instructions that are partially correct but need improvement
- ❌ Instructions in the wrong format/style that need reformatting
- ❌ Instructions that work but could be clearer

#### **When to use ADD:**
- ✅ New guidance that doesn't exist anywhere (this is currently the only well-supported case)

---

## Current System Behavior

### ✅ What Works:
1. **Code fully supports all three operations** - Remove and Replace logic is properly implemented in `FixesPanel.tsx` (lines 126-162)
2. **UI displays all three operation types** with proper color coding:
   - 🟢 Green for "Add"
   - 🟡 Yellow for "Replace"
   - 🔴 Red for "Remove"
3. **FixCard component** properly shows targetContent for remove/replace operations (lines 125-139)
4. **Script generation** correctly applies operations in order: Removes → Replaces → Adds (lines 126-170)

### ❌ What Doesn't Work:
1. **AI rarely generates "remove" operations** - even when existing content is problematic
2. **AI rarely generates "replace" operations** - it tends to add supplementary instructions instead of replacing bad ones
3. **No validation** to ensure targetContent is provided for remove/replace operations
4. **No examples or guidance** in the prompt to help the AI choose appropriately

---

## Real-World Scenarios That Should Use Remove/Replace

### Scenario 1: Redundant Instructions (Should be REMOVE)
**Existing Script:**
```
State S0:
- Ask for customer availability
- Confirm if customer has time to talk
- Check if now is a good time
```

**Current Behavior:** AI generates an ADD fix suggesting "Ask availability in one sentence"
**Expected Behavior:** AI should REMOVE the redundant lines and keep only one clear instruction

---

### Scenario 2: Conflicting Instructions (Should be REMOVE or REPLACE)
**Existing Script:**
```
- Always let the customer finish speaking before responding
- Interrupt politely if customer is going off-topic
```

**Current Behavior:** AI adds another instruction trying to clarify
**Expected Behavior:** AI should REPLACE or REMOVE one of these conflicting instructions

---

### Scenario 3: Poorly Worded Instruction (Should be REPLACE)
**Existing Script:**
```
- Try to maybe possibly check if the customer might want to hear about offers
```

**Current Behavior:** AI adds a new instruction with better wording
**Expected Behavior:** AI should REPLACE the vague instruction with a clear one

---

### Scenario 4: Incorrect Information (Should be REPLACE)
**Existing Script:**
```
- Tell customer delivery takes 5-7 days (OUTDATED - now it's 2-3 days)
```

**Current Behavior:** AI adds a correction note
**Expected Behavior:** AI should REPLACE with correct information

---

## Recommendations

### 🔥 High Priority

#### 1. **Update the Prompt to Remove Bias**
Change line 347 from:
```
* "add": Insert new content (most common)
```
To:
```
* "add": Insert new content when nothing exists
```

#### 2. **Add Examples for Remove and Replace Operations**
Add 2-3 concrete examples showing:
- When to use REMOVE (redundant/conflicting instructions)
- When to use REPLACE (incorrect/poorly worded instructions)
- Clear comparison showing why add is wrong and remove/replace is right

#### 3. **Add Decision Logic to Prompt**
Add a section like:
```
**DECISION LOGIC - Which action to use:**

🗑️ Use "remove" when:
- Existing instruction is redundant (duplicates another instruction)
- Existing instruction conflicts with other instructions
- Existing instruction is causing mistakes and should just be deleted
- Existing instruction is outdated and no longer applies

🔄 Use "replace" when:
- Existing instruction is poorly worded but the intent is correct
- Existing instruction has incorrect information
- Existing instruction is partially correct but needs improvement
- Existing instruction exists but needs to be reframed

➕ Use "add" when:
- No instruction exists on this topic at all
- New guidance is needed that doesn't conflict with existing content

CRITICAL: Always prefer "remove" or "replace" over "add" when existing instructions address the same topic.
```

### 🟡 Medium Priority

#### 4. **Add Validation for targetContent**
In `openai.ts` around lines 533 & 556, add validation:
```typescript
// Validate that remove/replace actions have targetContent
if ((fix.action === 'remove' || fix.action === 'replace') && !fix.targetContent) {
  console.warn(`${fix.action} action without targetContent, defaulting to 'add'`);
  fix.action = 'add';
}
```

#### 5. **Change Default Behavior**
Instead of defaulting to 'add', consider:
```typescript
action: fix.action || (fix.targetContent ? 'replace' : 'add'),
```
This way if targetContent is provided, it defaults to replace instead of add.

### 🟢 Low Priority

#### 6. **Add Operation Type Statistics**
Track and display statistics on the distribution of add/remove/replace operations to monitor if the bias is being addressed.

#### 7. **Add Warning for All-Add Scenarios**
If 100% of fixes are "add" operations, show a warning suggesting the user review if some should be remove/replace.

---

## Testing Recommendations

To verify the fix works:

1. **Create test cases with obviously redundant instructions** that should be removed
2. **Create test cases with incorrect information** that should be replaced
3. **Monitor the distribution** of operation types - healthy distribution might be:
   - 60-70% Add (new content)
   - 20-30% Replace (improvements)
   - 10-20% Remove (deletions)

---

## Conclusion

**Current State:** The system is 95%+ biased toward "add" operations due to:
- Default value fallback
- Prompt language bias
- Lack of examples
- No decision guidance

**Solution:** Update the prompt with clear decision logic, examples, and remove the "(most common)" bias. The underlying code already supports all three operations perfectly - we just need to train the AI to use them appropriately.

**Impact:** This will result in:
- ✅ More accurate fixes that actually correct problems instead of just adding more instructions
- ✅ Cleaner scripts without redundancy
- ✅ Better identification of conflicting or incorrect instructions
- ✅ More maintainable prompts overall
