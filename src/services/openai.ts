import { Transcript, DetectedIssue, CheckConfig, IssueType, Severity, Fix, Scenario, EnhancedFix, FixType, AggregatedIssue, AggregatedScenario, RootCauseType, DimensionPrompt } from '@/types';
import { FIXED_SYSTEM_PROMPT } from '@/data/systemPrompt';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Sanitize text to prevent JSON parsing issues
 * Removes control characters and normalizes whitespace
 */
function sanitizeText(text: string): string {
  return text
    // Remove control characters except newline and tab
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize unicode quotes to ASCII
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    // Remove zero-width characters
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
}

export async function callOpenAI(
  apiKey: string,
  model: string,
  messages: OpenAIMessage[]
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || `OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Get embeddings for text using OpenAI's embedding model
 * Used for semantic similarity calculations
 */
export async function getEmbedding(
  apiKey: string,
  text: string,
  model: string = 'text-embedding-3-small'
): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    throw new Error(error.error?.message || `OpenAI Embeddings API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data[0]?.embedding || [];
}

/**
 * Calculate cosine similarity between two embedding vectors
 * Returns a value between -1 and 1 (typically 0-1 for normalized embeddings)
 */
export function cosineSimilarity(embedding1: number[], embedding2: number[]): number {
  if (embedding1.length !== embedding2.length || embedding1.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

export async function analyzeTranscript(
  apiKey: string,
  model: string,
  transcript: Transcript,
  checks: CheckConfig[],
  referenceScript: string | null,
  knowledgeBase: string | null = null
): Promise<DetectedIssue[]> {
  const enabledChecks = checks.filter((c) => c.enabled);

  if (enabledChecks.length === 0) {
    console.log('No enabled checks, skipping analysis');
    return [];
  }

  // Validate transcript has lines
  if (!transcript.lines || transcript.lines.length === 0) {
    console.warn('Transcript has no lines:', transcript.id);
    return [];
  }

  // Build transcript text with sanitization
  const transcriptText = transcript.lines
    .map((line, idx) => `[${idx + 1}] ${line.speaker.toUpperCase()}: ${sanitizeText(line.text)}`)
    .join('\n');

  console.log(`Analyzing transcript ${transcript.id} with ${transcript.lines.length} lines`);

  // Build checks description with their IDs
  const checksDescription = enabledChecks
    .map((check) => `- ${check.name} (ID: ${check.id}): ${check.instructions}`)
    .join('\n');

  // Build valid issue types list (predefined + custom check IDs)
  const validIssueTypes = [
    'flow_deviation',
    'repetition_loop',
    'language_mismatch',
    'mid_call_restart',
    'quality_issue',
    ...enabledChecks.filter(c => c.custom).map(c => c.id)
  ];

  const systemPrompt = `You are an expert AI voice bot quality analyst. Your task is to analyze call transcripts and detect issues based on specific checks.

Analyze the following transcript and identify issues based on these enabled checks:
${checksDescription}

${referenceScript ? `Reference Script/Flow:\n${referenceScript}\n` : ''}
${knowledgeBase ? `Knowledge Base:\n${knowledgeBase}\n` : ''}

For each issue found, provide a JSON object with:
- type: Use the check ID for the issue type. Valid types are: [${validIssueTypes.join(', ')}]
  * For standard checks, use: flow_deviation (for flow_compliance check), repetition_loop (for repetition check), language_mismatch (for language_alignment check), mid_call_restart (for restart_reset check), or quality_issue (for general_quality check)
  * For custom checks, use the exact check ID provided above
- severity: one of [low, medium, high, critical]
- confidence: number between 0-100
- evidenceSnippet: the exact text from the transcript that demonstrates the issue
- lineNumbers: array of line numbers where the issue occurs
- explanation: detailed explanation of why this is an issue

## ROOT CAUSE ANALYSIS (RCA) - REQUIRED FIELDS:
- whatHappened: Detailed description of what the agent did or didn't do (be specific and observant)
- impact: Clear explanation of how this affected the customer experience, trust, satisfaction, or call outcome
- rootCauseType: The PRIMARY root cause. You MUST classify into EXACTLY ONE of these 5 categories:
  1️⃣ "knowledge" - Information/context doesn't exist anywhere (missing in prompt, KB, or tools)
  2️⃣ "instruction" - Info exists but agent wasn't instructed HOW or WHEN to use it
  3️⃣ "execution" - Both info AND instructions exist, but agent FAILED to follow them
  4️⃣ "conversation" - Technically correct but poor UX/awkward conversation design
  5️⃣ "model" - Fundamental model capability limitation (use rarely, <5% of cases)

  CLASSIFICATION RULES:
  - Choose ONLY ONE primary category per issue
  - If multiple seem applicable, select the EARLIEST root cause: Knowledge > Instruction > Execution > Conversation > Model
  - NEVER label as Knowledge Gap if the information exists but was unused
  - NEVER label as Model Limitation unless all other categories are ruled out

- instructionReference (REQUIRED for rootCauseType="execution", optional otherwise): {
    source: "script" | "kb" | "policy" | "guideline",
    documentName: optional string (e.g., "Sales Call Script v2.1"),
    section: string (e.g., "Section 2.3: Pricing Objections", "Lines 15-20"),
    expectedBehavior: string (what the instruction says the agent should do),
    actualBehavior: string (what the agent actually did instead),
    confidence: optional number 0-100 (how confident you are about this specific instruction reference)
  }
  NOTE: When classifying as "execution", you MUST identify which specific script/KB/policy instruction was not followed.

Return ONLY a JSON array of issues. If no issues are found, return an empty array [].`;

  const userPrompt = `Transcript to analyze:\n${transcriptText}`;

  try {
    const response = await callOpenAI(apiKey, model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    // Try to extract JSON array
    let jsonStr = response.trim();

    // If wrapped in markdown code blocks, remove them
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    // Find the first [ and last ]
    const startIdx = jsonStr.indexOf('[');
    const endIdx = jsonStr.lastIndexOf(']');

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      console.error('No valid JSON array found in response:', response);
      return [];
    }

    jsonStr = jsonStr.substring(startIdx, endIdx + 1);

    let issues;
    try {
      issues = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Attempted to parse:', jsonStr);

      // Try one more time with cleanup
      try {
        const cleaned = jsonStr
          .replace(/,(\s*[}\]])/g, '$1')
          .replace(/\n/g, ' ')
          .replace(/\r/g, '');
        issues = JSON.parse(cleaned);
      } catch (secondError) {
        console.error('Failed to parse issues after cleanup:', secondError);
        return [];
      }
    }

    if (!Array.isArray(issues)) {
      console.error('Parsed result is not an array:', issues);
      return [];
    }

    console.log(`Found ${issues.length} issues in transcript ${transcript.id}`);

    // Valid root cause types
    const validRootCauseTypes = ['knowledge', 'instruction', 'execution', 'conversation', 'model'];

    // Convert to DetectedIssue format with IDs
    return issues.map((issue: {
      type: string;
      severity: string;
      confidence: number;
      evidenceSnippet: string;
      lineNumbers: number[];
      explanation: string;
      suggestedFix?: string;
      whatHappened?: string;
      impact?: string;
      rootCauseType?: string;
      instructionReference?: {
        source: 'script' | 'kb' | 'policy' | 'guideline';
        documentName?: string;
        section: string;
        expectedBehavior: string;
        actualBehavior: string;
        confidence?: number;
      };
    }, idx: number) => {
      // Validate and normalize rootCauseType
      let rootCauseType = issue.rootCauseType?.toLowerCase();

      // If rootCauseType is invalid, set to undefined
      if (rootCauseType && !validRootCauseTypes.includes(rootCauseType)) {
        console.warn(`[Issue ${transcript.id}-${idx}] Invalid rootCauseType "${issue.rootCauseType}" - setting to undefined. Valid values are: ${validRootCauseTypes.join(', ')}`);
        rootCauseType = undefined;
      }

      return {
        id: `${transcript.id}-issue-${idx}`,
        callId: transcript.id,
        type: issue.type as IssueType,
        severity: issue.severity as Severity,
        confidence: issue.confidence,
        evidenceSnippet: issue.evidenceSnippet,
        lineNumbers: issue.lineNumbers,
        explanation: issue.explanation,
        suggestedFix: issue.suggestedFix,
        // RCA fields
        whatHappened: issue.whatHappened,
        impact: issue.impact,
        rootCauseType: rootCauseType as RootCauseType | undefined,
        instructionReference: issue.instructionReference,
      };
    });
  } catch (error) {
    console.error('Error analyzing transcript:', error);
    throw error;
  }
}

export async function determineFixPlacements(
  apiKey: string,
  model: string,
  script: string,
  fixes: Fix[]
): Promise<{ fixId: string; lineNumber: number; reasoning: string }[]> {
  if (fixes.length === 0) {
    return [];
  }

  const scriptLines = script.split('\n');
  const numberedScript = scriptLines.map((line, idx) => `${idx + 1}: ${line}`).join('\n');

  const fixesSummary = fixes
    .map((fix, idx) =>
      `Fix ${idx + 1} (ID: ${fix.id}):\n` +
      `Problem: ${fix.problem}\n` +
      `Suggestion: ${fix.suggestion}\n` +
      `Placement Hint: ${fix.placementHint}`
    )
    .join('\n\n---\n\n');

  const systemPrompt = `You are an expert at analyzing scripts and determining optimal placement for improvements.

Given a script with line numbers and a list of fixes, determine the BEST line number where each fix should be inserted.

Consider:
- The semantic meaning and context of each line
- The fix's placement hint (e.g., "after greeting", "before verification")
- The natural flow of the conversation
- Logical grouping of related content

Return ONLY a JSON array with this structure:
[
  {
    "fixId": "the fix ID",
    "lineNumber": the line number (1-indexed) where this fix should be inserted AFTER,
    "reasoning": "brief explanation of why this is the best placement"
  }
]

IMPORTANT:
- Return ONLY valid JSON, no markdown, no extra text
- lineNumber should be where to insert AFTER (e.g., lineNumber: 5 means insert after line 5)
- If a fix should go at the very beginning, use lineNumber: 0
- If a fix should go at the very end, use lineNumber: ${scriptLines.length}`;

  const userPrompt = `Script with line numbers:\n\n${numberedScript}\n\n---\n\nFixes to place:\n\n${fixesSummary}\n\nDetermine the optimal line number for each fix.`;

  try {
    const response = await callOpenAI(apiKey, model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    // Find the first [ and last ]
    const startIdx = jsonStr.indexOf('[');
    const endIdx = jsonStr.lastIndexOf(']');

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      console.error('No valid JSON array found in placement response:', response);
      // Fallback: place all at end
      return fixes.map(fix => ({
        fixId: fix.id,
        lineNumber: scriptLines.length,
        reasoning: 'Fallback: placed at end'
      }));
    }

    jsonStr = jsonStr.substring(startIdx, endIdx + 1);

    let placements;
    try {
      placements = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('JSON parse error for placements:', parseError);
      // Fallback: place all at end
      return fixes.map(fix => ({
        fixId: fix.id,
        lineNumber: scriptLines.length,
        reasoning: 'Fallback: placed at end due to parse error'
      }));
    }

    if (!Array.isArray(placements)) {
      console.error('Placements result is not an array:', placements);
      return fixes.map(fix => ({
        fixId: fix.id,
        lineNumber: scriptLines.length,
        reasoning: 'Fallback: placed at end'
      }));
    }

    return placements;
  } catch (error) {
    console.error('Error determining fix placements:', error);
    // Fallback: place all at end
    return fixes.map(fix => ({
      fixId: fix.id,
      lineNumber: script.split('\n').length,
      reasoning: 'Fallback: placed at end due to error'
    }));
  }
}

export async function generateFixSuggestions(
  apiKey: string,
  model: string,
  issues: DetectedIssue[],
  transcripts: Transcript[],
  referenceScript: string | null,
  knowledgeBase: string | null = null
): Promise<{ scriptFixes: Fix[]; generalFixes: Fix[] }> {
  if (issues.length === 0) {
    return { scriptFixes: [], generalFixes: [] };
  }

  // Group issues by type
  const issuesByType: Record<string, DetectedIssue[]> = {};
  issues.forEach((issue) => {
    if (!issuesByType[issue.type]) {
      issuesByType[issue.type] = [];
    }
    issuesByType[issue.type].push(issue);
  });

  const systemPrompt = `You are an expert AI voice bot prompt engineer. Your task is to generate PROMPT-ONLY fix suggestions for detected issues in voice bot call transcripts.

CRITICAL CONSTRAINTS:
- ONLY suggest changes to bot prompts/instructions
- DO NOT suggest code changes, UI changes, or system architecture changes
- Focus exclusively on what can be added to the bot's system prompt or reference script
- All fixes must be implementable by modifying prompts alone

⚠️ CRITICAL: SCRIPT/ALPHABET PRESERVATION (READ THIS CAREFULLY):
- Analyze the reference script to identify what SCRIPT/ALPHABET it uses
- If the reference script is written in LATIN/ROMAN alphabet (English letters like A-Z), your suggestion MUST also use LATIN/ROMAN alphabet
- If the reference script is written in Devanagari alphabet (Hindi script like अ आ), your suggestion MUST also use Devanagari alphabet
- DO NOT translate between scripts/alphabets
- DO NOT change from Latin to Devanagari or vice versa
- Match the EXACT writing system of the reference script

LANGUAGE AND FORMAT PRESERVATION:
- Preserve the exact formatting style (bullet points, dashes, numbered lists, etc.)
- If script uses "State S0", "State S1" format, continue that pattern
- If script uses English paragraph style, continue that style
- If script mixes English with occasional Hindi terms in Roman script, do the same
- Maintain the same level of formality and tone

For each fix, provide a JSON object with these SEPARATE fields:
- issueType: type of issue this addresses (flow_deviation, repetition_loop, language_mismatch, mid_call_restart, quality_issue)
- problem: brief description of the problem identified
- rootCauseType: ONE of ["knowledge", "instruction", "execution", "conversation", "model"] - classify based on ROOT CAUSE of the underlying issue
  * "knowledge": Information/context doesn't exist anywhere
  * "instruction": Info exists but bot wasn't told how/when to use it
  * "execution": Instructions exist but bot failed to follow them (tag as "execution" even if fix requires instruction changes)
  * "conversation": Technically correct but poor UX/awkward conversation
  * "model": Fundamental model capability limitation (use rarely, <5%)
  ⚠️ CRITICAL: rootCauseType must match the ROOT CAUSE of the issue, NOT the solution type
     Example: If bot failed to follow existing instructions → "execution" (even if fix adds clearer instructions)
     Example: If bot lacks any instruction on topic → "instruction"
- action: one of ["add", "remove", "replace"] - what type of change to make
  * "add": Insert new content (most common)
  * "remove": Delete existing problematic content
  * "replace": Replace existing content with improved version
- lineToAdd: The EXACT single line/instruction to insert into the script — nothing else, no surrounding context
- targetContent: (ONLY for "remove" or "replace") The exact single line from the script to remove/replace — copy it verbatim
- context: 1-2 sentences explaining what this change does and why it helps. This is where examples and reasoning go.
- placementHint: ONLY where to make the change (e.g., "Add to State S1" or "Replace in State S2")
- exampleResponse: (OPTIONAL) What the bot should actually say to customers (this CAN be in native language/Hinglish)
- relatedIssueIds: array of issue IDs this addresses

🎯 FIELD SEPARATION RULES:
- "lineToAdd" = ONLY the new single line/instruction to insert. No examples, no explanation, no surrounding context. ENGLISH only.
- "targetContent" = ONLY the verbatim line from the script being removed/replaced. Nothing else.
- "context" = 1-2 sentences: what this change does and why it helps. Put examples and reasoning here.
- "exampleResponse" = What bot SAYS to the customer (can be Hindi/Hinglish/native language)
- "placementHint" = Where in the script to make the change (location only)

🚨 CRITICAL - lineToAdd RULES:
- Return ONLY the new line being inserted — not the whole section
- If State S1 has 5 existing lines and you add 1 new line, lineToAdd = that 1 new line only
- Do NOT start with "In State X", "Add to...", "Ensure that...", "Make sure..."
- Write the instruction directly: "When customer interrupts, acknowledge and redirect."

🚨 CRITICAL - targetContent RULES (for remove/replace):
- Copy the exact line verbatim from the script — do not paraphrase or include surrounding lines

Example (CORRECT - DO THIS):
Reference script format: "State S0 - Availability & Readiness Check / Confirm customer availability"
Scenario: Bot failed to ask availability as a single uninterrupted sentence (rootCauseType: "execution")
{
  "action": "add",
  "rootCauseType": "execution",
  "lineToAdd": "Ask availability in one complete uninterrupted sentence without mid-sentence pauses.",
  "context": "Bot was breaking the availability question mid-sentence causing customer confusion. This instruction enforces it as a single fluent sentence.",
  "exampleResponse": "Namaste, kya abhi aap baat karna aapke liye theek rahega? Yeh call sirf 2 minute ka hai.",
  "placementHint": "Add under State S0 - Availability & Readiness Check"
}

WRONG Example (DO NOT DO THIS - lineToAdd contains entire section, not just the new line):
{
  "action": "add",
  "lineToAdd": "State S0 - Availability Check\n- Greet customer\n- Ask availability\n- Ask in one sentence\n- Confirm readiness",
  "placementHint": "Add to State S0"
}

WRONG Example 1 (DO NOT DO THIS - meta-description instead of exact text):
{
  "action": "add",
  "suggestion": "Add explicit guidance to politely acknowledge interruptions and redirect...",  ← WRONG - describes what to add, not the actual text
  "placementHint": "Add to State S4"
}

WRONG Example 2 (DO NOT DO THIS - includes location in suggestion):
{
  "action": "add",
  "suggestion": "In State S0 - Availability & Readiness Check, use a clear sentence...",  ← WRONG - has "In State S0"
  "placementHint": "Add to State S0"
}

WRONG Example 3 (DO NOT DO THIS - suggestion in Hindi/Hinglish):
{
  "action": "add",
  "suggestion": "Availability check ko hamesha ek hi poori saaf sentence mein bolo...",  ← WRONG - uses Hinglish
  "placementHint": "Add to State S0"
}

WRONG Example 4 (DO NOT DO THIS - uses Devanagari script):
{
  "action": "add",
  "suggestion": "अगर ग्राहक ने कॉल उठाया हो तो कहें: नमस्ते",  ← WRONG - uses Devanagari script
  "placementHint": "Add to State S0"
}

Categorize fixes:
- scriptFixes: Prompt additions/modifications for reference script (flow-related)
- generalFixes: Prompt additions for system instructions (behavior-related)

IMPORTANT: Return ONLY valid JSON without any markdown, comments, or extra text. Use single quotes inside string values if needed. Ensure all strings are properly escaped.

Return JSON: {"scriptFixes": [...], "generalFixes": [...]}`;

  const issuesSummary = issues
    .map(
      (issue) =>
        `Issue ID: ${issue.id}\nType: ${issue.type}\nSeverity: ${issue.severity}\nExplanation: ${sanitizeText(issue.explanation)}\nEvidence: ${sanitizeText(issue.evidenceSnippet)}`
    )
    .join('\n\n---\n\n');

  const userPrompt = `Issues detected:\n\n${issuesSummary}\n\n${
    referenceScript ? `Current Reference Script (ANALYZE THE SCRIPT/ALPHABET USED):\n${referenceScript}\n\n` : ''
  }${
    knowledgeBase ? `Current Knowledge Base:\n${knowledgeBase}\n\n` : ''
  }Generate PROMPT-ONLY fix suggestions. Each suggestion must be a specific prompt instruction that can be added to the bot's system prompt, reference script, or knowledge base.

⚠️ CRITICAL REMINDERS:
1. LANGUAGE: Write "suggestion" field with EXACT prompt text in ENGLISH (copy-paste ready). Write "exampleResponse" field in the native language the bot speaks to customers.
2. FORMAT: Match the reference script's formatting style (State S0, bullet points, etc.)
3. LOCATION: DO NOT include location/placement info in "suggestion" - that goes in "placementHint"
4. RCA ALIGNMENT: Set rootCauseType based on the ROOT CAUSE of the issue, not the solution type (execution failure fix should be tagged "execution" even if solution adds instructions)
5. lineToAdd = only the new single line to insert, nothing else
6. targetContent = verbatim line from script being removed/replaced, nothing else
7. context = explanation and reasoning (1-2 sentences) — put examples and rationale here, not in lineToAdd

Think: "lineToAdd" = the 1 new line | "context" = why/how | "exampleResponse" = what bot says to customer`;

  try {
    const response = await callOpenAI(apiKey, model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    // Try to extract JSON - look for the outermost braces
    let jsonStr = response.trim();

    // If wrapped in markdown code blocks, remove them
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    // Find the first { and last }
    const startIdx = jsonStr.indexOf('{');
    const endIdx = jsonStr.lastIndexOf('}');

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      console.error('No valid JSON object found in response:', response);
      return { scriptFixes: [], generalFixes: [] };
    }

    jsonStr = jsonStr.substring(startIdx, endIdx + 1);

    let fixesData;
    try {
      fixesData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Attempted to parse (first 500 chars):', jsonStr.substring(0, 500));
      console.error('Last 200 chars:', jsonStr.substring(Math.max(0, jsonStr.length - 200)));

      // Try multiple cleanup strategies
      try {
        // Strategy 1: Fix common issues
        let cleaned = jsonStr
          .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
          .replace(/\n/g, ' ')             // Remove newlines
          .replace(/\r/g, '')              // Remove carriage returns
          .replace(/\t/g, ' ');            // Replace tabs with spaces

        fixesData = JSON.parse(cleaned);
        console.log('Strategy 1 succeeded');
      } catch (secondError) {
        try {
          // Strategy 2: More aggressive - fix escaped quotes
          let cleaned = jsonStr
            .replace(/\\'/g, "'")           // Fix escaped single quotes
            .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
            .replace(/[\n\r\t]/g, ' ')      // Remove all whitespace chars
            .replace(/\s+/g, ' ');          // Collapse multiple spaces

          fixesData = JSON.parse(cleaned);
          console.log('Strategy 2 succeeded');
        } catch (thirdError) {
          try {
            // Strategy 3: Ultra-aggressive cleanup for malformed strings
            let cleaned = jsonStr
              // Fix unescaped quotes in strings (try to escape quotes that aren't already escaped)
              .replace(/([^\\])"([^":,}\]])/g, '$1\\"$2')
              // Remove trailing commas
              .replace(/,(\s*[}\]])/g, '$1')
              // Normalize whitespace
              .replace(/[\n\r\t]/g, ' ')
              .replace(/\s+/g, ' ')
              // Fix double backslashes
              .replace(/\\\\\\/g, '\\')
              // Remove any control characters
              .replace(/[\x00-\x1F\x7F]/g, '');

            fixesData = JSON.parse(cleaned);
            console.log('Strategy 3 succeeded');
          } catch (fourthError) {
            // Strategy 4: Try to parse as lenient JSON by manually fixing common AI mistakes
            try {
              let cleaned = jsonStr
                // Fix missing quotes around property names
                .replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
                // Remove trailing commas
                .replace(/,(\s*[}\]])/g, '$1')
                // Normalize whitespace
                .replace(/[\n\r\t]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

              fixesData = JSON.parse(cleaned);
              console.log('Strategy 4 succeeded');
            } catch (fifthError) {
              // Last resort: log comprehensive error details
              console.error('All 4 parsing strategies failed');
              console.error('Original error:', parseError);
              console.error('Second error:', secondError);
              console.error('Third error:', thirdError);
              console.error('Fourth error:', fourthError);
              console.error('Fifth error:', fifthError);
              console.error('\nFull response that failed to parse:');
              console.error(jsonStr);

              throw new Error(`Failed to parse fix suggestions. The AI response was not in valid JSON format. Please try again.`);
            }
          }
        }
      }
    }

    // Validate structure
    if (!fixesData || typeof fixesData !== 'object') {
      console.error('Parsed data is not an object:', fixesData);
      return { scriptFixes: [], generalFixes: [] };
    }

    // Add IDs to fixes with validation
    const scriptFixes = Array.isArray(fixesData.scriptFixes)
      ? fixesData.scriptFixes.map((fix: any, idx: number) => {
          // Validate and normalize rootCauseType
          const validRootCauses = ['knowledge', 'instruction', 'execution', 'conversation', 'model'];
          const rootCauseType = validRootCauses.includes(fix.rootCauseType)
            ? fix.rootCauseType
            : 'instruction'; // Default to instruction if missing or invalid

          return {
            id: `script-fix-${idx}`,
            issueType: fix.issueType || 'quality_issue',
            problem: fix.problem || 'Issue detected',
            lineToAdd: fix.lineToAdd || '',
            context: fix.context || '',
            suggestion: fix.lineToAdd || fix.suggestion || '',
            placementHint: fix.placementHint || 'Add to system prompt',
            exampleResponse: fix.exampleResponse || '',
            relatedIssueIds: Array.isArray(fix.relatedIssueIds) ? fix.relatedIssueIds : [],
            rootCauseType,
            action: fix.action || 'add',
            targetContent: fix.targetContent || undefined,
          };
        })
      : [];

    const generalFixes = Array.isArray(fixesData.generalFixes)
      ? fixesData.generalFixes.map((fix: any, idx: number) => {
          // Validate and normalize rootCauseType
          const validRootCauses = ['knowledge', 'instruction', 'execution', 'conversation', 'model'];
          const rootCauseType = validRootCauses.includes(fix.rootCauseType)
            ? fix.rootCauseType
            : 'instruction'; // Default to instruction if missing or invalid

          return {
            id: `general-fix-${idx}`,
            issueType: fix.issueType || 'quality_issue',
            problem: fix.problem || 'Issue detected',
            lineToAdd: fix.lineToAdd || '',
            context: fix.context || '',
            suggestion: fix.lineToAdd || fix.suggestion || '',
            placementHint: fix.placementHint || 'Add to system prompt',
            exampleResponse: fix.exampleResponse || '',
            relatedIssueIds: Array.isArray(fix.relatedIssueIds) ? fix.relatedIssueIds : [],
            rootCauseType,
            action: fix.action || 'add',
            targetContent: fix.targetContent || undefined,
          };
        })
      : [];

    return { scriptFixes, generalFixes };
  } catch (error) {
    console.error('Error generating fix suggestions:', error);
    throw error;
  }
}

// Objective flow: Generate one consolidated fix per RCA category
export async function generateConsolidatedFixes(
  apiKey: string,
  model: string,
  issues: any[],
  referenceScript?: string,
  knowledgeBase?: string
): Promise<import('@/types').ConsolidatedFix[]> {
  const systemPrompt = `You are an expert AI voice bot prompt engineer analysing real call failures and writing precise script fixes.

You will receive:
1. A list of detected issues — each with the EXACT transcript evidence showing what went wrong
2. A reference script — your bot's current prompt/conversation flow
3. Optionally a knowledge base

Your job: group issues by root cause, then write ONE consolidated fix per category. Each fix contains the precise line-level changes needed to prevent those failures from recurring.

━━━ UNDERSTANDING THE REFERENCE SCRIPT ━━━
The reference script may use a structured multi-pillar/state format like:
  [Pillar 3 - Conversation Flow]
    State S1 - Availability Check
      Entry Gate: <condition for entering this state>
      Instructions: <what the bot should do>
      Exit Gate: <condition to move to next state>
      Example: <sample dialogue>

When writing fixes:
- Respect this structure. If a state has Entry Gate / Exit Gate / Example sections, place new lines in the correct sub-section.
- placementHint should be specific: e.g. "State S1 - Availability Check > Instructions" or "State S2 - Pitch > Exit Gate"
- If adding an example, match the example format already used in that state
- If adding an Entry/Exit gate condition, match the gate format used in nearby states
- Do NOT rewrite entire states — add or change only what is necessary

━━━ EVIDENCE-DRIVEN FIXES ━━━
Every change must be directly traceable to the evidence provided:
- Read the exact transcript lines in each issue's evidence
- Identify what the bot said vs. what the script/instruction required
- Write the fix to close that exact gap — not a generic instruction
- Bad: "Acknowledge customer concerns promptly"
- Good: "If customer says they are busy, say: 'I understand, this will only take 2 minutes.'"

━━━ RESPONSE FORMAT ━━━
Return a JSON array — one object per RCA category that has issues:
[
  {
    "rootCauseType": "execution",
    "summary": "1-2 sentences: the common failure pattern across all issues in this category, referencing specific evidence",
    "relatedIssueIds": ["id1", "id2"],
    "changes": [
      {
        "action": "add",
        "lineToAdd": "Exact single instruction to insert — specific, not generic",
        "placementHint": "Pillar X > State SY - Name > Sub-section (Instructions/Entry Gate/Exit Gate/Example)",
        "context": "1 sentence: what transcript evidence this addresses and why this line prevents it"
      },
      {
        "action": "replace",
        "targetContent": "Verbatim line copied from the script being replaced",
        "lineToAdd": "The replacement line",
        "placementHint": "Exact location in script",
        "context": "What was wrong with the original line based on the evidence"
      },
      {
        "action": "remove",
        "targetContent": "Verbatim line copied from the script being removed",
        "placementHint": "Exact location in script",
        "context": "Why this line causes the observed failure"
      }
    ]
  }
]

━━━ RULES ━━━
- Only include categories that have actual issues — do not invent categories
- rootCauseType: one of "knowledge" | "instruction" | "execution" | "conversation" | "model"
- lineToAdd = ONLY the new line — not the surrounding context
- targetContent = verbatim copy from the script — do not paraphrase
- placementHint = specific location including sub-section where applicable
- context = reference the actual transcript evidence (e.g. "Bot said X when script requires Y")
- Match the script's exact language, alphabet, and formatting style
- Do NOT repeat the same change across categories
- 🚫 DO NOT add generic or structural improvements that are not backed by specific evidence in the issues list. Every single change must map to at least one issue ID in relatedIssueIds. If you cannot point to a specific transcript failure for a change, do not include it.

⚠️ ALPHABET: Match the reference script's writing system exactly (Latin/Roman or Devanagari — do not mix or translate).

Return ONLY valid JSON — no markdown, no comments.`;

  const issuesSummary = issues
    .map(i => {
      const parts = [
        `Issue ID: ${i.id}`,
        `Type: ${i.type}`,
        `Severity: ${i.severity}`,
        `Root Cause: ${i.rootCauseType || 'unknown'}`,
        `What Happened: ${sanitizeText(i.whatHappened || i.explanation)}`,
        `Transcript Evidence: ${sanitizeText(i.evidenceSnippet)}`,
      ];
      if (i.impact) parts.push(`Impact: ${sanitizeText(i.impact)}`);
      if (i.instructionReference) parts.push(`Instruction Not Followed: ${sanitizeText(typeof i.instructionReference === 'string' ? i.instructionReference : i.instructionReference.text || JSON.stringify(i.instructionReference))}`);
      return parts.join('\n');
    })
    .join('\n\n---\n\n');

  const userPrompt = `Issues detected in real calls:\n\n${issuesSummary}\n\n${
    referenceScript ? `Current Reference Script:\n${referenceScript}\n\n` : ''
  }${
    knowledgeBase ? `Knowledge Base:\n${knowledgeBase}\n\n` : ''
  }Group these issues by root cause. For each category, produce one consolidated fix with all the specific line changes needed — written against the actual transcript evidence above, placed precisely within the reference script structure.`;

  try {
    const response = await callOpenAI(apiKey, model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    let jsonStr = response.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }
    const startIdx = jsonStr.indexOf('[');
    const endIdx = jsonStr.lastIndexOf(']');
    if (startIdx === -1 || endIdx === -1) return [];
    jsonStr = jsonStr.substring(startIdx, endIdx + 1);

    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: any, idx: number) => ({
      id: `consolidated-${item.rootCauseType || idx}`,
      rootCauseType: item.rootCauseType,
      summary: item.summary || '',
      relatedIssueIds: Array.isArray(item.relatedIssueIds) ? item.relatedIssueIds : [],
      changes: Array.isArray(item.changes) ? item.changes.map((c: any) => ({
        action: c.action || 'add',
        lineToAdd: c.lineToAdd || '',
        targetContent: c.targetContent || undefined,
        placementHint: c.placementHint || '',
        context: c.context || '',
      })) : [],
    }));
  } catch (error) {
    console.error('Error generating consolidated fixes:', error);
    throw error;
  }
}

// Open-ended flow: Scenario-based analysis
export async function analyzeTranscriptScenarios(
  apiKey: string,
  model: string,
  transcript: Transcript,
  dimensionPrompts: DimensionPrompt[],
  referenceScript: string | null,
  knowledgeBase: string | null = null
): Promise<Scenario[]> {
  // Validate transcript has lines
  if (!transcript.lines || transcript.lines.length === 0) {
    console.warn('Transcript has no lines:', transcript.id);
    return [];
  }

  // Build transcript text with sanitization
  const transcriptText = transcript.lines
    .map((line, idx) => `[${idx + 1}] ${line.speaker.toUpperCase()}: ${sanitizeText(line.text)}`)
    .join('\n');

  console.log(`Analyzing transcript ${transcript.id} for scenarios with ${transcript.lines.length} lines`);

  const enabledDimensions = dimensionPrompts.filter(d => d.enabled);
  const dimensionSection = enabledDimensions
    .map(d => `## DIMENSION ${d.id} — ${d.label.toUpperCase()}\n\n${d.prompt}`)
    .join('\n\n---\n\n');

  const systemPrompt = `${FIXED_SYSTEM_PROMPT}

---

## DIMENSIONS TO EVALUATE (${enabledDimensions.length} active)

Evaluate ALL dimensions listed below. For each finding, assign exactly ONE dimension using the Tiebreaker in your instructions above.

${dimensionSection}

${referenceScript ? `\n---\n## Reference Script/Flow:\n${referenceScript}\n` : ''}
${knowledgeBase ? `\n---\n## Knowledge Base:\n${knowledgeBase}\n` : ''}`;

  const userPrompt = `Transcript to analyze:\n${transcriptText}`;

  try {
    console.log(`[SCENARIO ANALYSIS] Starting for ${transcript.id}`);
    console.log(`[SCENARIO ANALYSIS] Active dimensions: ${enabledDimensions.length}`);
    console.log(`[SCENARIO ANALYSIS] Transcript lines: ${transcript.lines.length}`);

    const response = await callOpenAI(apiKey, model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    console.log(`[SCENARIO ANALYSIS] Received response (first 500 chars):`, response.substring(0, 500));

    // Try to extract JSON array
    let jsonStr = response.trim();

    // If wrapped in markdown code blocks, remove them
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    // Find the first [ and last ]
    const startIdx = jsonStr.indexOf('[');
    const endIdx = jsonStr.lastIndexOf(']');

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      console.error(`[SCENARIO ANALYSIS] No valid JSON array found for ${transcript.id}`);
      console.error('[SCENARIO ANALYSIS] Full response:', response);
      console.warn('[SCENARIO ANALYSIS] Possible reasons: 1) API key invalid/missing, 2) AI found no issues, 3) Unexpected response format');
      return [];
    }

    jsonStr = jsonStr.substring(startIdx, endIdx + 1);
    console.log(`[SCENARIO ANALYSIS] Extracted JSON length: ${jsonStr.length} chars`);

    let scenarios;
    try {
      scenarios = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error(`[SCENARIO ANALYSIS] JSON parse error for ${transcript.id}:`, parseError);
      console.error('[SCENARIO ANALYSIS] Attempted to parse:', jsonStr.substring(0, 1000));

      // Try one more time with aggressive cleanup
      try {
        let cleaned = jsonStr
          .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
          .replace(/\n/g, '\\n')          // Escape newlines
          .replace(/\r/g, '')             // Remove carriage returns
          .replace(/\t/g, ' ')            // Replace tabs with spaces
          .replace(/\\'/g, "'")           // Fix escaped single quotes
          .replace(/\\\\/g, '\\');        // Fix double backslashes

        scenarios = JSON.parse(cleaned);
        console.log('[SCENARIO ANALYSIS] Successfully parsed after cleanup');
      } catch (secondError) {
        console.error('[SCENARIO ANALYSIS] Failed to parse scenarios after cleanup:', secondError);
        console.error('[SCENARIO ANALYSIS] Cleaned string (first 1000 chars):', jsonStr.substring(0, 1000));

        // Last resort: Try to manually fix common issues with evidence snippets
        try {
          // Sometimes the issue is unescaped quotes in evidence snippets
          // This is a very aggressive fix - try to salvage what we can
          let salvaged = jsonStr
            .replace(/,(\s*[}\]])/g, '$1')
            .replace(/[\n\r\t]/g, ' ')
            .replace(/\s+/g, ' ')
            // Try to fix unescaped quotes in string values
            .replace(/"([^"]*)":\s*"([^"]*)"/g, (match, key, value) => {
              // Escape any internal quotes in the value
              const escapedValue = value.replace(/(?<!\\)"/g, '\\"');
              return `"${key}": "${escapedValue}"`;
            });

          scenarios = JSON.parse(salvaged);
          console.log('[SCENARIO ANALYSIS] Successfully parsed after aggressive salvage');
        } catch (thirdError) {
          console.error('[SCENARIO ANALYSIS] All JSON parsing attempts failed.');
          console.error('[SCENARIO ANALYSIS] Attempting manual field extraction as last resort...');

          // Ultra-aggressive last resort: Manually extract scenario objects using pattern matching
          try {
            const manualScenarios: any[] = [];
            // Split by objects (looking for patterns like "title": "...")
            const objectMatches = jsonStr.match(/\{[^}]*"title"[^}]*\}/g);

            if (objectMatches && objectMatches.length > 0) {
              objectMatches.forEach((objStr) => {
                try {
                  // Try to clean and parse each object individually
                  const cleanObj = objStr
                    .replace(/[\n\r\t]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, '\\');

                  const parsed = JSON.parse(cleanObj);
                  manualScenarios.push(parsed);
                } catch {
                  // If individual object fails, try to extract fields manually
                  const titleMatch = objStr.match(/"title":\s*"([^"]+)"/);
                  const contextMatch = objStr.match(/"context":\s*"([^"]+)"/);
                  const severityMatch = objStr.match(/"severity":\s*"([^"]+)"/);
                  const confidenceMatch = objStr.match(/"confidence":\s*(\d+)/);
                  const lineNumbersMatch = objStr.match(/"lineNumbers":\s*\[([\d,\s]+)\]/);

                  if (titleMatch) {
                    manualScenarios.push({
                      title: titleMatch[1],
                      context: contextMatch ? contextMatch[1] : 'Context extraction failed',
                      whatHappened: 'Details could not be fully extracted due to parsing issues',
                      impact: 'Impact assessment limited',
                      severity: severityMatch ? severityMatch[1] : 'medium',
                      confidence: confidenceMatch ? parseInt(confidenceMatch[1]) : 70,
                      lineNumbers: lineNumbersMatch ? lineNumbersMatch[1].split(',').map(n => parseInt(n.trim())) : []
                    });
                  }
                }
              });
            }

            if (manualScenarios.length > 0) {
              console.log(`[SCENARIO ANALYSIS] Manual extraction succeeded! Found ${manualScenarios.length} scenarios`);
              scenarios = manualScenarios;
            } else {
              console.error('[SCENARIO ANALYSIS] Manual extraction also failed. Returning empty array.');
              return [];
            }
          } catch (manualError) {
            console.error('[SCENARIO ANALYSIS] Even manual extraction failed:', manualError);
            console.error('[SCENARIO ANALYSIS] This likely means the AI response contains severely malformed data.');
            return [];
          }
        }
      }
    }

    if (!Array.isArray(scenarios)) {
      console.error('Parsed result is not an array:', scenarios);
      return [];
    }

    console.log(`Found ${scenarios.length} scenarios in transcript ${transcript.id}`);

    // Valid root cause types
    const validRootCauseTypes = ['knowledge', 'instruction', 'execution', 'conversation', 'model'];

    // Convert to Scenario format with IDs
    return scenarios.map((scenario: {
      title: string;
      dimension?: string;
      rootCauseType?: string;
      context: string;
      whatHappened: string;
      impact: string;
      severity: string;
      confidence: number;
      lineNumbers: number[];
      instructionReference?: {
        source: 'script' | 'kb' | 'policy' | 'guideline';
        documentName?: string;
        section: string;
        expectedBehavior: string;
        actualBehavior: string;
        confidence?: number;
      };
    }, idx: number) => {
      // Validate and normalize rootCauseType
      let rootCauseType = scenario.rootCauseType?.toLowerCase();

      // If rootCauseType is invalid (e.g., "N/A", "unknown", etc.), set to undefined
      if (rootCauseType && !validRootCauseTypes.includes(rootCauseType)) {
        console.warn(`[Scenario ${transcript.id}-${idx}] Invalid rootCauseType "${scenario.rootCauseType}" - setting to undefined. Valid values are: ${validRootCauseTypes.join(', ')}`);
        rootCauseType = undefined;
      }

      return {
        id: `${transcript.id}-scenario-${idx}`,
        callId: transcript.id,
        title: scenario.title,
        dimension: scenario.dimension,
        rootCauseType: rootCauseType as any,
        context: scenario.context,
        whatHappened: scenario.whatHappened,
        impact: scenario.impact,
        severity: scenario.severity as Severity,
        confidence: scenario.confidence,
        lineNumbers: scenario.lineNumbers || [],
        instructionReference: scenario.instructionReference,
      };
    });
  } catch (error) {
    console.error('Error analyzing transcript scenarios:', error);
    throw error;
  }
}

// Open-ended flow: Generate enhanced fix suggestions with implementation details
/**
 * Deduplicate transcript lines using LLM to intelligently remove duplicates
 * while preserving conversation flow and context
 */
export async function deduplicateTranscriptLines(
  apiKey: string,
  model: string,
  lines: { speaker: 'agent' | 'customer'; text: string; timestamp?: string }[]
): Promise<{ speaker: 'agent' | 'customer'; text: string; timestamp?: string }[]> {
  if (!apiKey || apiKey.trim().length === 0) {
    console.warn('No API key provided for deduplication, skipping');
    return lines;
  }

  if (lines.length === 0) {
    return lines;
  }

  // Format lines with indices for reference
  const numberedLines = lines
    .map((line, idx) =>
      `[${idx + 1}] ${line.timestamp ? `${line.timestamp} ` : ''}${line.speaker.toUpperCase()}: ${sanitizeText(line.text)}`
    )
    .join('\n');

  const systemPrompt = `You are an expert transcript quality analyst. Your task is to identify and remove DUPLICATE lines from transcripts while preserving the natural conversation flow.

CRITICAL RULES FOR DEDUPLICATION:
1. Remove EXACT or NEAR-EXACT duplicates of the same speaker's message
2. Preserve ALL unique messages even if they seem similar
3. Keep the FIRST occurrence and remove subsequent duplicates
4. Do NOT remove messages that are similar but contextually different (e.g., repeated greetings in different parts of conversation)
5. Preserve conversation flow - only remove true duplicates that add no value
6. Pay attention to timestamps - duplicate lines often appear close together

WHAT TO REMOVE:
✓ Exact text repetitions by same speaker
✓ Near-identical repetitions with minor variations (typos, extra spaces)
✓ Parsing artifacts where same line appears twice
✓ Stuttering or system glitches causing immediate repeats

WHAT NOT TO REMOVE:
✗ Similar but contextually different messages (e.g., "Thank you" at different points)
✗ Natural conversation patterns (acknowledgments, confirmations)
✗ Follow-up questions that seem similar
✗ Paraphrasing or restating with new information

Return a JSON object with:
{
  "keepIndices": [1, 2, 3, 5, 7, ...],  // Array of line numbers (1-indexed) to KEEP
  "reasoning": "Brief explanation of what was removed and why"
}

IMPORTANT: Return ONLY valid JSON. The keepIndices array should contain line numbers (1-indexed) of lines to preserve.`;

  const userPrompt = `Analyze this transcript and identify which lines to keep (removing only true duplicates):

${numberedLines}

Return the keepIndices array and reasoning.`;

  try {
    const response = await callOpenAI(apiKey, model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    let jsonStr = response.trim();

    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    // Find the first { and last }
    const startIdx = jsonStr.indexOf('{');
    const endIdx = jsonStr.lastIndexOf('}');

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      console.warn('No valid JSON found in deduplication response, returning original lines');
      return lines;
    }

    jsonStr = jsonStr.substring(startIdx, endIdx + 1);

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.warn('Failed to parse deduplication response, returning original lines:', parseError);
      return lines;
    }

    if (!result.keepIndices || !Array.isArray(result.keepIndices)) {
      console.warn('Invalid keepIndices in deduplication response, returning original lines');
      return lines;
    }

    // Convert 1-indexed keepIndices to 0-indexed and filter lines
    const keepSet = new Set(result.keepIndices.map((idx: number) => idx - 1));
    const deduplicatedLines = lines.filter((_, idx) => keepSet.has(idx));

    console.log(`Deduplication: ${lines.length} → ${deduplicatedLines.length} lines (removed ${lines.length - deduplicatedLines.length})`);
    console.log(`Reasoning: ${result.reasoning}`);

    return deduplicatedLines;
  } catch (error) {
    console.error('Error during deduplication:', error);
    // Return original lines if deduplication fails
    return lines;
  }
}

export async function generateEnhancedFixSuggestions(
  apiKey: string,
  model: string,
  scenarios: Scenario[],
  transcripts: Transcript[],
  referenceScript: string | null,
  knowledgeBase: string | null = null
): Promise<EnhancedFix[]> {
  if (scenarios.length === 0) {
    return [];
  }

  const systemPrompt = `You are an expert call center operations consultant. Your task is to generate comprehensive, actionable solutions for identified performance scenarios.

For each scenario, provide a detailed fix with implementation guidance. Think end-to-end:
- WHY did this happen? (root cause TYPE and detailed explanation)
- WHAT type of solution is needed? (script, training, process, system)
- WHERE should it be implemented? (specific location in flow/process)
- WHAT exactly should be implemented? (concrete steps/content)
- HOW should it look in practice? (before/after example)
- HOW to validate it worked? (success criteria and testing)

Fix types explained:
- script: Changes to prompts, reference scripts, or bot instructions
- training: Agent coaching, skills development, or knowledge gaps
- process: Workflow changes, escalation procedures, quality checkpoints
- system: Technical improvements, integrations, automation needs

Root cause types explained:
- knowledge: Information doesn't exist anywhere - bot didn't have the information
- instruction: Info exists but bot not told how/when to use it - needs clearer instructions
- execution: Instructions exist but bot didn't follow them - needs reinforcement
- conversation: Technically correct but experience was poor - awkward or confusing
- model: Task exceeds model capability despite perfect setup (rare, <5%)

For each scenario, provide a JSON object with:
- scenarioId: The ID of the scenario this addresses
- title: Short descriptive title (e.g., "Add Empathy Steps", "Improve Information Gathering")
- fixType: one of [script, training, process, system]
- rootCauseType: one of [knowledge, instruction, execution, conversation, model] - WHY this issue happened
- rootCause: Detailed explanation of why this scenario happened (1-2 sentences)
- suggestedSolution: What to do about it (overview, 2-3 sentences)
- whereToImplement: Specific location in the flow/process/script where this applies
- whatToImplement: Detailed steps or content to add/change (be very specific)
- concreteExample: Before/after example or sample dialogue showing the improvement
- successCriteria: How to measure if this fix worked (observable outcomes)
- howToTest: Specific validation method (e.g., "Review next 10 calls for empathy statements")

**CRITICAL - For INSTRUCTION or KNOWLEDGE fixes, ALSO provide a "promptFix" object:**
{
  "action": "add" | "replace" | "remove",
  "targetSection": "Specific section name (e.g., 'State S0 - Availability Check' or 'System Prompt - Empathy Guidelines')",
  "lineNumber": optional number if you can identify exact line,
  "exactContent": "ONLY the new or changed line(s) — nothing else",
  "beforeText": "For 'replace' action — ONLY the specific existing line(s) being changed, nothing else"
}

**MINIMAL DIFF RULE — THIS IS MANDATORY:**
- exactContent and beforeText must contain ONLY the lines that actually change — not the surrounding context
- WRONG: beforeText = entire S0 section (20 lines), exactContent = same 20 lines with 2 new lines inserted
- RIGHT: action = "add", targetSection = "S0 Rules", exactContent = only the 2 new rule lines
- WRONG: beforeText = full state block, exactContent = full state block with one word changed
- RIGHT: action = "replace", beforeText = the one sentence that changes, exactContent = the corrected sentence
- If you are only ADDING new content to an existing section (no existing line is deleted), use action "add"
- Only use "replace" when an existing line must be changed — and beforeText is ONLY that line

Examples:
- If rootCauseType is "instruction" or "knowledge": Add promptFix with exact system instruction text, conversation flow, or script dialogue to add/replace
- If rootCauseType is "execution/conversation/model": Do NOT include promptFix (not applicable)

Be practical and actionable. Think like you're creating an implementation plan for a team.

Return ONLY a JSON array of enhanced fixes. Return one fix per scenario.`;

  const scenariosSummary = scenarios
    .map(
      (scenario) =>
        `Scenario ID: ${scenario.id}\nTitle: ${scenario.title}\n${scenario.rootCauseType ? `Root Cause Type: ${scenario.rootCauseType}\n` : ''}Context: ${scenario.context}\nWhat Happened: ${scenario.whatHappened}\nImpact: ${scenario.impact}\nSeverity: ${scenario.severity}`
    )
    .join('\n\n---\n\n');

  const userPrompt = `Scenarios identified:\n\n${scenariosSummary}\n\n${
    referenceScript ? `Current Reference Script:\n${referenceScript}\n\n` : ''
  }${
    knowledgeBase ? `Current Knowledge Base:\n${knowledgeBase}\n\n` : ''
  }Generate comprehensive, actionable fix suggestions with full implementation details for each scenario.`;

  try {
    const response = await callOpenAI(apiKey, model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    // Try to extract JSON array
    let jsonStr = response.trim();

    // If wrapped in markdown code blocks, remove them
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    // Find the first [ and last ]
    const startIdx = jsonStr.indexOf('[');
    const endIdx = jsonStr.lastIndexOf(']');

    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
      console.error('No valid JSON array found in response:', response);
      return [];
    }

    jsonStr = jsonStr.substring(startIdx, endIdx + 1);

    let fixes;
    try {
      fixes = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Attempted to parse:', jsonStr);

      // Try one more time with cleanup
      try {
        const cleaned = jsonStr
          .replace(/,(\s*[}\]])/g, '$1')
          .replace(/\n/g, ' ')
          .replace(/\r/g, '');
        fixes = JSON.parse(cleaned);
      } catch (secondError) {
        console.error('Failed to parse enhanced fixes after cleanup:', secondError);
        return [];
      }
    }

    if (!Array.isArray(fixes)) {
      console.error('Parsed result is not an array:', fixes);
      return [];
    }

    console.log(`Generated ${fixes.length} enhanced fixes`);

    // Valid root cause types
    const validRootCauseTypes = ['knowledge', 'instruction', 'execution', 'conversation', 'model'];

    // Convert to EnhancedFix format with IDs
    return fixes.map((fix: {
      scenarioId: string;
      title: string;
      fixType: string;
      rootCauseType?: string;
      rootCause: string;
      suggestedSolution: string;
      whereToImplement: string;
      whatToImplement: string;
      concreteExample: string;
      successCriteria: string;
      howToTest: string;
      promptFix?: any;
    }, idx: number) => {
      // Validate and normalize rootCauseType
      let rootCauseType = fix.rootCauseType?.toLowerCase() || 'model';

      // If rootCauseType is invalid, default to 'model'
      if (!validRootCauseTypes.includes(rootCauseType)) {
        console.warn(`[Fix ${idx}] Invalid rootCauseType "${fix.rootCauseType}" - defaulting to "model". Valid values are: ${validRootCauseTypes.join(', ')}`);
        rootCauseType = 'model';
      }

      return {
        id: `enhanced-fix-${idx}`,
        scenarioId: fix.scenarioId,
        title: fix.title,
        fixType: fix.fixType as FixType,
        rootCauseType: rootCauseType as any,
        rootCause: fix.rootCause,
        suggestedSolution: fix.suggestedSolution,
        whereToImplement: fix.whereToImplement,
        whatToImplement: fix.whatToImplement,
        concreteExample: fix.concreteExample,
        successCriteria: fix.successCriteria,
        howToTest: fix.howToTest,
        promptFix: fix.promptFix,
      };
    });
  } catch (error) {
    console.error('Error generating enhanced fix suggestions:', error);
    throw error;
  }
}

/**
 * Generate comprehensive, category-level fixes grouped by RCA type
 * Instead of individual fixes per scenario, generates ONE fix per RCA category
 * that addresses all related scenarios holistically
 */
export async function generateEnhancedFixesByRCACategory(
  apiKey: string,
  model: string,
  aggregatedScenarios: AggregatedScenario[],
  referenceScript: string | null,
  knowledgeBase: string | null = null
): Promise<EnhancedFix[]> {
  if (aggregatedScenarios.length === 0) {
    return [];
  }

  // Group aggregated scenarios by RCA category
  const scenariosByRCA: Record<string, AggregatedScenario[]> = {};
  aggregatedScenarios.forEach(aggScenario => {
    const rca = aggScenario.rootCauseType || 'unknown';
    if (!scenariosByRCA[rca]) {
      scenariosByRCA[rca] = [];
    }
    scenariosByRCA[rca].push(aggScenario);
  });

  console.log(`[RCA Fix Generation] Grouped scenarios into ${Object.keys(scenariosByRCA).length} RCA categories`);

  // Create promises for all RCA categories to process in parallel
  const fixGenerationPromises = Object.entries(scenariosByRCA)
    .filter(([rcaType]) => rcaType !== 'unknown') // Skip scenarios without RCA type
    .map(async ([rcaType, aggScenarios]) => {
      console.log(`[RCA Fix Generation] Starting generation for ${rcaType} (${aggScenarios.length} scenario groups)`);

      // Prepare summary of scenarios in this RCA category
      const scenariosSummary = aggScenarios.map(agg => ({
        title: agg.title,
        dimension: agg.dimension,
        pattern: agg.pattern,
        severity: agg.severity,
        occurrences: agg.occurrences,
        uniqueCalls: agg.uniqueCalls,
        // Include sample scenarios for context
        samples: agg.scenarios.slice(0, 3).map(s => ({
          whatHappened: s.whatHappened,
          impact: s.impact,
          context: s.context
        }))
      }));

      const systemPrompt = `You are an expert call center operations consultant. Your task is to generate MULTIPLE SPECIFIC PATCHES for issues with the ROOT CAUSE: "${rcaType.toUpperCase()}"

Root cause types explained:
- knowledge: Information doesn't exist anywhere - bot didn't have the information
- instruction: Info exists but bot not told how/when to use it - needs clearer instructions
- execution: Instructions exist but bot didn't follow them - needs reinforcement
- conversation: Technically correct but experience was poor - awkward or confusing
- model: Task exceeds model capability despite perfect setup (rare, <5%)

CRITICAL:
- Analyze which specific pillars/sections need patches to address these issues
- Generate a SEPARATE patch for EACH pillar/location that needs fixing
- DO NOT create one generic fix - create multiple targeted patches
- Example: If issues affect Pillar 1, Pillar 3, and Pillar 5, create 3 separate patches

**STRICT STRUCTURAL CONSTRAINTS:**
- DO NOT create new pillars - work only within the existing prompt structure
- DO NOT suggest adding new major sections or pillars
- ONLY modify, enhance, or add to EXISTING sections/states/pillars
- If new states are needed, add them within existing pillars (e.g., add new state under Pillar 3)
- Focus on fixing issues by enhancing the existing reference prompt content

**LOCATION REQUIREMENTS (for each patch):**
- whereToImplement: Must specify EXACT location within EXISTING structure
  Examples: "Pillar 3, State S2", "Pillar 1, State S0 - Identity Verification", "System Prompt - Line 5"
  NOT acceptable: "New Pillar 9", "Add new section", "Create new pillar"

**CONTENT REQUIREMENTS (for each patch):**
- whatToImplement: Must be EXACT, COPY-PASTE READY content for that specific location
  Examples: Additional instructions for that specific state, enhanced check for that pillar
  NOT acceptable: Generic descriptions, "Create new pillar", "Add new major section"

For the RCA category "${rcaType}", provide a JSON object with a "fixes" array:
{
  "fixes": [
    {
      "title": "Specific patch title (e.g., 'Add Identity Verification to Pillar 3, State S0')",
      "fixType": "script" | "training" | "process" | "system",
      "rootCauseType": "${rcaType}",
      "rootCause": "Why this specific issue happened at this location",
      "suggestedSolution": "What this specific patch does",
      "whereToImplement": "EXACT location - e.g., 'Pillar 3, State S2'",
      "whatToImplement": "EXACT COPY-PASTE READY content for this location",
      "concreteExample": "Before/after for this specific patch",
      "successCriteria": "How to verify this patch works",
      "howToTest": "Testing method for this patch",
      "promptFix": {
        "action": "add" | "replace" | "remove",
        "targetSection": "EXACT section - e.g., 'Pillar 3, State S0'",
        "lineNumber": number (if known),
        "exactContent": "ONLY the new or changed line(s) — not the whole section",
        "beforeText": "For replace ONLY — the specific existing line(s) being changed, nothing else"
      }

MANDATORY MINIMAL DIFF RULE for promptFix:
- exactContent = only lines that are new or changed. Do NOT copy surrounding context.
- beforeText = only the specific lines being deleted or replaced. Do NOT copy the whole state/section.
- If adding new rules/lines to an existing list → use action "add", exactContent = only the new lines
- If changing one instruction → use action "replace", beforeText = that one line, exactContent = corrected line
- NEVER copy an entire section as beforeText just to make a small change inside it
    }
  ]
}

Analyze the reference script and scenarios to identify ALL locations that need patches. Create one patch object per location.

Return ONLY a valid JSON object with a "fixes" array.`;

      const userPrompt = `RCA Category: ${rcaType}

Aggregated Scenarios in this category:
${JSON.stringify(scenariosSummary, null, 2)}

Total Impact:
- ${aggScenarios.length} scenario group(s)
- ${aggScenarios.reduce((sum, agg) => sum + agg.occurrences, 0)} total occurrences
- ${Array.from(new Set(aggScenarios.flatMap(agg => agg.affectedCallIds))).length} unique calls affected

${referenceScript ? `Current Reference Script:\n${referenceScript}\n\n` : ''}
${knowledgeBase ? `Current Knowledge Base:\n${knowledgeBase}\n\n` : ''}

Generate ONE comprehensive fix that addresses this entire RCA category.`;

      try {
        console.log(`[RCA Fix Generation] Calling OpenAI for ${rcaType}...`);
        const response = await callOpenAI(apiKey, model, [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]);
        console.log(`[RCA Fix Generation] Received response for ${rcaType}`);

        let jsonStr = response.trim();
        if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
        }

        const startIdx = jsonStr.indexOf('{');
        const endIdx = jsonStr.lastIndexOf('}');

        if (startIdx === -1 || endIdx === -1) {
          console.error(`[RCA Fix Generation] No valid JSON for ${rcaType}`);
          return [];
        }

        jsonStr = jsonStr.substring(startIdx, endIdx + 1);
        const parsedResponse = JSON.parse(jsonStr);

        // Handle both array format (new) and single object format (backwards compatibility)
        const fixesArray = parsedResponse.fixes || [parsedResponse];

        // Convert to EnhancedFix objects
        const enhancedFixes: EnhancedFix[] = fixesArray.map((fix: any, idx: number) => ({
          id: `rca-fix-${rcaType}-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`,
          scenarioId: aggScenarios.map(agg => agg.id).join(','), // Link to multiple scenarios
          title: fix.title,
          fixType: fix.fixType as FixType,
          rootCauseType: rcaType as RootCauseType,
          rootCause: fix.rootCause,
          suggestedSolution: fix.suggestedSolution,
          whereToImplement: fix.whereToImplement,
          whatToImplement: fix.whatToImplement,
          concreteExample: fix.concreteExample,
          successCriteria: fix.successCriteria,
          howToTest: fix.howToTest,
          promptFix: fix.promptFix,
        }));

        console.log(`[RCA Fix Generation] Generated ${enhancedFixes.length} fix(es) for ${rcaType}`);
        return enhancedFixes;
      } catch (error) {
        console.error(`[RCA Fix Generation] Error generating fixes for ${rcaType}:`, error);
        return [];
      }
    });

  // Wait for all fix generation promises to complete in parallel
  console.log(`[RCA Fix Generation] Processing ${fixGenerationPromises.length} RCA categories in parallel...`);
  console.log(`[RCA Fix Generation] Categories:`, Object.keys(scenariosByRCA).filter(k => k !== 'unknown'));

  const fixResults = await Promise.all(fixGenerationPromises);
  console.log(`[RCA Fix Generation] All promises completed. Got ${fixResults.length} result arrays`);

  // Flatten the array of arrays into a single array of all fixes
  const allFixes: EnhancedFix[] = fixResults.flat();

  console.log(`[RCA Fix Generation] Generated ${allFixes.length} total fixes across all RCA categories`);
  return allFixes;
}

/**
 * Normalize root cause type from various formats to the expected lowercase format
 */
function normalizeRootCauseType(value: string | undefined): RootCauseType | undefined {
  if (!value) return undefined;

  const normalized = value.toLowerCase().trim();

  // Map human-readable labels to internal keys
  const mapping: Record<string, RootCauseType> = {
    'knowledge': 'knowledge',
    'knowledge gap': 'knowledge',
    'instruction': 'instruction',
    'instruction gap': 'instruction',
    'execution': 'execution',
    'execution failure': 'execution',
    'conversation': 'conversation',
    'conversation design': 'conversation',
    'model': 'model',
    'model limitation': 'model',
  };

  return mapping[normalized];
}

/**
 * LLM-based intelligent scenario aggregation
 * Groups semantically similar scenarios and deduplicates across dimensions
 */
export async function aggregateScenariosWithLLM(
  apiKey: string,
  model: string,
  scenarios: Scenario[]
): Promise<AggregatedScenario[]> {
  if (scenarios.length === 0) return [];

  console.log(`[LLM Scenario Aggregation] Processing ${scenarios.length} scenarios`);

  // Prepare scenarios summary for LLM
  const scenariosSummary = scenarios.map((scenario, idx) => ({
    index: idx,
    id: scenario.id,
    callId: scenario.callId,
    title: scenario.title,
    dimension: scenario.dimension,
    rootCauseType: scenario.rootCauseType,
    severity: scenario.severity,
    confidence: scenario.confidence,
    whatHappened: scenario.whatHappened,
    impact: scenario.impact,
    lineNumbers: scenario.lineNumbers
  }));

  const systemPrompt = `You are an expert at deduplicating scenarios. Your goal is AGGRESSIVE MERGING - combine everything that's the same underlying problem.

CRITICAL: These are SYNONYMS - treat them as IDENTICAL:
- "Identity" = "Name" = "Verification" = "Confirmation" = "Authentication" = "Identity Check" = "Identity Verification Process"
- "Greeting" = "Introduction" = "Opening" = "Welcome"
- "Closing" = "Conclusion" = "Ending" = "Wrap-up"
- "Empathy" = "Acknowledgment" = "Understanding" = "Active Listening"
- "Missing" = "Incomplete" = "Absent" = "Not Present" = "Skipped" = "Fragmented"
- "Premature" = "Early" = "Too Soon" = "Before"
- "Process" = "Procedure" = "Step" = "Flow"

MERGE AGGRESSIVELY:
1. Same call + overlapping lines → ALWAYS MERGE (same moment, different wording)
2. Same core problem + different words → ALWAYS MERGE
   Examples:
   - "Missing Identity Verification Process" + "Incomplete Identity Confirmation" → MERGE (both about identity)
   - "Incomplete Identity Confirmation" + "Fragmented Identity Confirmation Process" → MERGE (both about identity)
   - "No Greeting" + "Incomplete Introduction" → MERGE (both about opening)
   - "Early Transfer" + "Premature Agent Transfer" → MERGE (both about timing)
3. Different dimensions but same root cause → MERGE
   - "Flow Control: Identity issues" + "Process: Identity verification missing" → MERGE

READ THE "whatHappened" FIELD - that's the actual problem! Ignore title wording.

DON'T MERGE only if:
- Completely different problems (greeting vs payment vs transfer)
- Different specific errors (wrong account # vs wrong amount)

OUTPUT FORMAT:
{
  "categories": [
    {
      "categoryName": "Identity Verification Missing",
      "dimension": "Process",
      "rootCauseType": "execution",
      "severity": "HIGH",
      "scenarioIndices": [0, 2, 5, 8],
      "reasoning": "All about missing/incomplete identity confirmation"
    }
  ]
}

IMPORTANT: rootCauseType must be EXACTLY one of these lowercase values:
- "knowledge" (for Knowledge Gap issues)
- "instruction" (for Instruction Gap issues)
- "execution" (for Execution Failure issues)
- "conversation" (for Conversation Design issues)
- "model" (for Model Limitation issues)

CRITICAL: When merging scenarios, use the rootCauseType that appears most frequently in the scenarios being merged. DO NOT change the rootCauseType unless scenarios have conflicting types - in that case, use the majority type.

RULES:
- Category names: max 4 words, describe the PROBLEM
- Every scenario index 0-${scenarios.length - 1} must appear EXACTLY ONCE
- When in doubt, MERGE IT
- Preserve the original rootCauseType from the scenarios (use majority if there are conflicts)`;

  const userPrompt = `Categorize and deduplicate these ${scenarios.length} scenarios:\n\n${JSON.stringify(scenariosSummary, null, 2)}`;

  try {
    const response = await callOpenAI(apiKey, model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    // Parse LLM response
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    const startIdx = jsonStr.indexOf('{');
    const endIdx = jsonStr.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1) {
      console.error('[LLM Scenario Aggregation] No valid JSON found in response');
      // Fallback: create one category per scenario
      return createFallbackScenarioAggregation(scenarios);
    }

    jsonStr = jsonStr.substring(startIdx, endIdx + 1);
    const result = JSON.parse(jsonStr);

    if (!result.categories || !Array.isArray(result.categories)) {
      console.error('[LLM Scenario Aggregation] Invalid response structure');
      return createFallbackScenarioAggregation(scenarios);
    }

    console.log(`[LLM Scenario Aggregation] Created ${result.categories.length} categories`);

    // Convert to AggregatedScenario format
    const aggregated = result.categories.map((category: any, idx: number) => {
      const categoryScenarios = category.scenarioIndices.map((i: number) => scenarios[i]);

      // Get highest severity
      const severities = categoryScenarios.map((s: Scenario) => s.severity);
      const highestSeverity = getHighestSeverity(severities);

      // Calculate average confidence
      const avgConfidence = Math.round(
        categoryScenarios.reduce((sum: number, s: Scenario) => sum + s.confidence, 0) / categoryScenarios.length
      );

      // Get unique call IDs
      const affectedCallIds = Array.from(new Set(categoryScenarios.map((s: Scenario) => s.callId)));

      // Create pattern description
      const uniqueTitles = new Set(categoryScenarios.map((s: Scenario) => s.title));
      const pattern = uniqueTitles.size > 1
        ? `${uniqueTitles.size} similar patterns identified across ${affectedCallIds.length} call${affectedCallIds.length !== 1 ? 's' : ''}`
        : categoryScenarios[0].whatHappened;

      // Determine rootCauseType from the scenarios being merged (use majority vote)
      const rootCauseTypeCounts: Record<string, number> = {};
      categoryScenarios.forEach((s: Scenario) => {
        if (s.rootCauseType) {
          rootCauseTypeCounts[s.rootCauseType] = (rootCauseTypeCounts[s.rootCauseType] || 0) + 1;
        }
      });

      // Get the most common rootCauseType from the source scenarios
      const sourceRootCauseType = Object.entries(rootCauseTypeCounts).length > 0
        ? Object.entries(rootCauseTypeCounts).sort((a, b) => b[1] - a[1])[0][0]
        : undefined;

      // Normalize LLM's suggested rootCauseType
      const llmSuggestedRootCause = normalizeRootCauseType(category.rootCauseType);

      // Prefer source rootCauseType over LLM's suggestion to maintain consistency
      const normalizedRootCause = sourceRootCauseType || llmSuggestedRootCause;

      // Log if normalization changed the value (indicates LLM returned wrong format)
      if (category.rootCauseType && category.rootCauseType !== normalizedRootCause) {
        console.log(`[LLM Scenario Aggregation] Normalized rootCauseType: "${category.rootCauseType}" → "${normalizedRootCause}"`);
      }

      // Log the aggregated scenario details
      console.log(`[LLM Scenario Aggregation] Category "${category.categoryName}": rootCauseType="${normalizedRootCause}", scenarios=${categoryScenarios.length}, sourceRootCauses=[${Array.from(new Set(categoryScenarios.map((s: Scenario) => s.rootCauseType))).join(', ')}]`);

      return {
        id: `llm-scenario-agg-${idx}`,
        groupKey: `${category.dimension}-${normalizedRootCause || 'unknown'}-${idx}`,
        title: category.categoryName,
        dimension: category.dimension,
        rootCauseType: normalizedRootCause,
        pattern,
        severity: highestSeverity,
        avgConfidence,
        occurrences: categoryScenarios.length,
        uniqueCalls: affectedCallIds.length,
        affectedCallIds,
        scenarios: categoryScenarios.sort((a: Scenario, b: Scenario) => a.callId.localeCompare(b.callId))
      };
    });

    // Sort by impact: occurrences * severity weight
    type AggType = typeof aggregated[0];
    return aggregated.sort((a: AggType, b: AggType) => {
      const impactA = a.occurrences * severityWeight(a.severity);
      const impactB = b.occurrences * severityWeight(b.severity);

      if (impactB !== impactA) {
        return impactB - impactA;
      }

      return b.uniqueCalls - a.uniqueCalls;
    });
  } catch (error) {
    console.error('[LLM Scenario Aggregation] Error:', error);
    return createFallbackScenarioAggregation(scenarios);
  }
}

/**
 * Fallback scenario aggregation when LLM fails
 * Groups by dimension and root cause
 */
function createFallbackScenarioAggregation(scenarios: Scenario[]): AggregatedScenario[] {
  console.log('[LLM Scenario Aggregation] Using fallback aggregation');

  const grouped = new Map<string, Scenario[]>();

  for (const scenario of scenarios) {
    const dimension = scenario.dimension || 'Uncategorized';
    const rootCause = scenario.rootCauseType || 'unknown';
    const key = `${dimension}||${rootCause}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(scenario);
  }

  const aggregated: AggregatedScenario[] = [];
  let idx = 0;

  for (const [key, groupedScenarios] of grouped.entries()) {
    const [dimension, rootCause] = key.split('||');
    const severities = groupedScenarios.map(s => s.severity);
    const highestSeverity = getHighestSeverity(severities);
    const avgConfidence = Math.round(
      groupedScenarios.reduce((sum, s) => sum + s.confidence, 0) / groupedScenarios.length
    );
    const affectedCallIds = Array.from(new Set(groupedScenarios.map(s => s.callId)));

    aggregated.push({
      id: `fallback-scenario-agg-${idx++}`,
      groupKey: key,
      title: groupedScenarios[0].title,
      dimension,
      rootCauseType: rootCause !== 'unknown' ? (rootCause as RootCauseType) : undefined,
      pattern: `${affectedCallIds.length} occurrence${affectedCallIds.length !== 1 ? 's' : ''}`,
      severity: highestSeverity,
      avgConfidence,
      occurrences: groupedScenarios.length,
      uniqueCalls: affectedCallIds.length,
      affectedCallIds,
      scenarios: groupedScenarios.sort((a, b) => a.callId.localeCompare(b.callId))
    });
  }

  type AggType = typeof aggregated[0];
  return aggregated.sort((a: AggType, b: AggType) => {
    const impactA = a.occurrences * severityWeight(a.severity);
    const impactB = b.occurrences * severityWeight(b.severity);

    if (impactB !== impactA) {
      return impactB - impactA;
    }

    return b.uniqueCalls - a.uniqueCalls;
  });
}

/**
 * LLM-based intelligent issue aggregation
 * Groups semantically similar issues and deduplicates same-call overlapping instances
 */
export async function aggregateIssuesWithLLM(
  apiKey: string,
  model: string,
  issues: DetectedIssue[]
): Promise<AggregatedIssue[]> {
  if (issues.length === 0) return [];

  console.log(`[LLM Aggregation] Processing ${issues.length} issues`);

  // Prepare issues summary for LLM
  const issuesSummary = issues.map((issue, idx) => ({
    index: idx,
    id: issue.id,
    callId: issue.callId,
    type: issue.type,
    severity: issue.severity,
    confidence: issue.confidence,
    explanation: issue.explanation,
    evidenceSnippet: issue.evidenceSnippet,
    lineNumbers: issue.lineNumbers,
    isCustomCheck: issue.isCustomCheck,
    sourceCheckName: issue.sourceCheckName
  }));

  const systemPrompt = `You are an expert at deduplicating and grouping quality issues. Your goal is AGGRESSIVE MERGING - combine everything that's the same underlying problem.

CRITICAL: These are SYNONYMS - treat them as IDENTICAL:
- "Identity" = "Name" = "Verification" = "Confirmation" = "Authentication" = "Identity Check"
- "Greeting" = "Introduction" = "Opening" = "Welcome"
- "Closing" = "Conclusion" = "Ending" = "Wrap-up"
- "Empathy" = "Acknowledgment" = "Understanding" = "Active Listening"
- "Missing" = "Incomplete" = "Absent" = "Not Present" = "Skipped"
- "Premature" = "Early" = "Too Soon" = "Before"
- "Process" = "Procedure" = "Step" = "Flow"

MERGE AGGRESSIVELY:
1. Same call + overlapping lines → ALWAYS MERGE (same moment, different wording)
2. Same core problem + different words → ALWAYS MERGE
   Examples:
   - "Missing Identity Verification Process" + "Incomplete Identity Confirmation" → MERGE (both about identity)
   - "No Greeting" + "Incomplete Introduction" → MERGE (both about opening)
   - "Early Transfer" + "Premature Agent Transfer" → MERGE (both about timing)
3. Different dimensions/types but same root cause → MERGE

DON'T MERGE only if:
- Completely different problems (greeting vs payment vs transfer)
- Different specific errors (wrong account # vs wrong amount)

OUTPUT FORMAT:
{
  "categories": [
    {
      "categoryName": "Identity Verification Missing",
      "categoryType": "Process",
      "severity": "HIGH",
      "issueIndices": [0, 2, 5, 8],
      "reasoning": "All about missing/incomplete identity confirmation"
    }
  ]
}

RULES:
- Category names: max 4 words, describe the PROBLEM
- Every issue index 0-${issues.length - 1} must appear EXACTLY ONCE
- When in doubt, MERGE IT`;


  const userPrompt = `Categorize and deduplicate these ${issues.length} issues:\n\n${JSON.stringify(issuesSummary, null, 2)}`;

  try {
    const response = await callOpenAI(apiKey, model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    // Parse LLM response
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    const startIdx = jsonStr.indexOf('{');
    const endIdx = jsonStr.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1) {
      console.error('[LLM Aggregation] No valid JSON found in response');
      // Fallback: create one category per issue
      return createFallbackAggregation(issues);
    }

    jsonStr = jsonStr.substring(startIdx, endIdx + 1);
    const result = JSON.parse(jsonStr);

    if (!result.categories || !Array.isArray(result.categories)) {
      console.error('[LLM Aggregation] Invalid response structure');
      return createFallbackAggregation(issues);
    }

    console.log(`[LLM Aggregation] Created ${result.categories.length} categories`);

    // Convert to AggregatedIssue format
    const aggregated: AggregatedIssue[] = result.categories.map((category: any, idx: number) => {
      const categoryIssues = category.issueIndices.map((i: number) => issues[i]);

      // Get highest severity
      const severities = categoryIssues.map((i: DetectedIssue) => i.severity);
      const highestSeverity = getHighestSeverity(severities);

      // Calculate average confidence
      const avgConfidence = Math.round(
        categoryIssues.reduce((sum: number, i: DetectedIssue) => sum + i.confidence, 0) / categoryIssues.length
      );

      // Get unique call IDs
      const affectedCallIds = Array.from(new Set(categoryIssues.map((i: DetectedIssue) => i.callId)));

      // Get sample evidence snippets (up to 3)
      const evidenceSnippets = Array.from(
        new Set(categoryIssues.map((i: DetectedIssue) => i.evidenceSnippet))
      ).slice(0, 3);

      // Create pattern description
      const uniqueTypes = new Set(categoryIssues.map((i: DetectedIssue) => i.type));
      const pattern = uniqueTypes.size > 1
        ? `${uniqueTypes.size} related issue types across ${affectedCallIds.length} call${affectedCallIds.length !== 1 ? 's' : ''}`
        : `${affectedCallIds.length} occurrence${affectedCallIds.length !== 1 ? 's' : ''} across ${affectedCallIds.length} call${affectedCallIds.length !== 1 ? 's' : ''}`;

      return {
        id: `llm-agg-${idx}`,
        type: category.categoryType,
        pattern: category.categoryName,
        severity: highestSeverity,
        avgConfidence,
        occurrences: affectedCallIds.length,
        affectedCallIds,
        instances: categoryIssues,
        evidenceSnippets
      };
    });

    // Sort by occurrences and severity
    return aggregated.sort((a, b) => {
      if (b.occurrences !== a.occurrences) {
        return b.occurrences - a.occurrences;
      }
      return severityWeight(b.severity) - severityWeight(a.severity);
    });
  } catch (error) {
    console.error('[LLM Aggregation] Error:', error);
    return createFallbackAggregation(issues);
  }
}

/**
 * Fallback aggregation when LLM fails
 * Groups by exact type match
 */
function createFallbackAggregation(issues: DetectedIssue[]): AggregatedIssue[] {
  console.log('[LLM Aggregation] Using fallback aggregation');

  const grouped = new Map<string, DetectedIssue[]>();

  for (const issue of issues) {
    const key = issue.type;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(issue);
  }

  const aggregated: AggregatedIssue[] = [];
  let idx = 0;

  for (const [type, groupedIssues] of grouped.entries()) {
    const severities = groupedIssues.map(i => i.severity);
    const highestSeverity = getHighestSeverity(severities);
    const avgConfidence = Math.round(
      groupedIssues.reduce((sum, i) => sum + i.confidence, 0) / groupedIssues.length
    );
    const affectedCallIds = Array.from(new Set(groupedIssues.map(i => i.callId)));
    const evidenceSnippets = Array.from(
      new Set(groupedIssues.map(i => i.evidenceSnippet))
    ).slice(0, 3);

    aggregated.push({
      id: `fallback-agg-${idx++}`,
      type: type as IssueType,
      pattern: `${affectedCallIds.length} occurrence${affectedCallIds.length !== 1 ? 's' : ''}`,
      severity: highestSeverity,
      avgConfidence,
      occurrences: affectedCallIds.length,
      affectedCallIds,
      instances: groupedIssues,
      evidenceSnippets
    });
  }

  return aggregated.sort((a, b) => {
    if (b.occurrences !== a.occurrences) {
      return b.occurrences - a.occurrences;
    }
    return severityWeight(b.severity) - severityWeight(a.severity);
  });
}

/**
 * Get the highest severity from a list
 */
function getHighestSeverity(severities: Severity[]): Severity {
  if (severities.includes('critical')) return 'critical';
  if (severities.includes('high')) return 'high';
  if (severities.includes('medium')) return 'medium';
  return 'low';
}

/**
 * Convert severity to numeric weight for sorting
 */
function severityWeight(severity: Severity): number {
  switch (severity) {
    case 'critical': return 4;
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
  }
}
