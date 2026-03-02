import { Transcript, DetectedIssue, CheckConfig, IssueType, Severity, Fix, Scenario, EnhancedFix, FixType, AggregatedIssue, AggregatedScenario, RootCauseType } from '@/types';

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
- suggestion: The EXACT prompt text/instruction to add - write the literal text that should be added to the prompt, not a description
- targetContent: (ONLY for "remove" or "replace") The exact text from the script to remove/replace
- placementHint: ONLY where to make the change (e.g., "Add to State S1" or "Replace in State S2")
- exampleResponse: (OPTIONAL) What the bot should actually say to customers (this CAN be in native language/Hinglish)
- relatedIssueIds: array of issue IDs this addresses

🎯 LANGUAGE RULES FOR SUGGESTION FIELD:
- suggestion field = EXACT prompt text to add in ENGLISH (must be copy-paste ready)
- DO NOT write meta-descriptions like "Add explicit guidance to..." or "Instruct the bot to..."
- Write the LITERAL instruction text: "When customer interrupts, acknowledge immediately and redirect..."
- DO NOT write in romanized Hindi/Hinglish like "Availability check ko hamesha..."
- exampleResponse field = What bot SAYS to customers (can be Hindi/Hinglish/native language)

🚨 CRITICAL - SUGGESTION FIELD RULES:
- "suggestion" = The EXACT text to add to the prompt (copy-paste ready)
- DO NOT write descriptions like "Add explicit guidance to politely acknowledge..."
- DO write the actual instruction: "When a customer interrupts during plan explanation, politely acknowledge immediately: 'I understand. Let me finish explaining this key benefit, then I'll address your question.' Then continue with the plan details."
- DO NOT start with "In State X" or "Add to..." or any location phrases
- DO NOT include where to add it - that goes in "placementHint"
- The suggestion should be EXACTLY what gets added to the prompt, word-for-word

CRITICAL SEPARATION:
- "suggestion" field = WHAT to add/replace (the actual prompt/instruction text ONLY)
- "placementHint" field = WHERE to make the change (location description ONLY)
- DO NOT mix these two! Keep them completely separate.

Example for LATIN/ROMAN script reference (CORRECT - DO THIS):
Reference script format: "State S0 - Availability & Readiness Check / Confirm customer availability"
Scenario: Bot failed to follow instruction to ask availability clearly (rootCauseType: "execution")
{
  "action": "add",
  "rootCauseType": "execution",
  "suggestion": "Ask the availability question in one complete, uninterrupted sentence. Do not break it into fragments or pause mid-sentence. Example: 'Namaste, kya abhi aap baat karna aapke liye theek rahega? Yeh call sirf 2 minute ka hai.' The question must flow naturally as a single unit.",
  "exampleResponse": "Namaste, kya abhi aap baat karna aapke liye theek rahega? Yeh call sirf 2 minute ka hai.",
  "placementHint": "Add under State S0 - Availability & Readiness Check as explicit phrasing guidance"
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
5. EXACT TEXT: Write the literal instruction to add, NOT a description like "Add guidance to..." - it must be copy-paste ready

Think: "suggestion" = Exact prompt text to add | "exampleResponse" = What bot says to customers`;

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
            suggestion: fix.suggestion || '',
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
            suggestion: fix.suggestion || '',
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

// Open-ended flow: Scenario-based analysis
export async function analyzeTranscriptScenarios(
  apiKey: string,
  model: string,
  transcript: Transcript,
  auditPrompt: string,
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

  const systemPrompt = `You are an expert call center quality analyst conducting holistic, open-ended audits of agent performance.

Your task is to identify SCENARIOS where the agent underperformed or could improve.

## Audit Dimensions & Framework:
${auditPrompt}

CRITICAL CATEGORIZATION RULES:
1. For each scenario, you MUST assign it to ONE of the primary audit dimensions (A-G) defined above
2. Use dimensions A-F for known issue types that fit those categories
3. Use dimension G (Novel & Emerging Issues) for patterns that DON'T fit A-F clearly
4. When using dimension G, explain why it's novel and which dimension it's closest to
5. Look for nuanced, specific issues within each dimension - not just surface-level problems
6. Think deeply about conversation dynamics, timing, empathy, control, and emerging patterns

${referenceScript ? `\n## Reference Script/Flow:\n${referenceScript}\n` : ''}
${knowledgeBase ? `\n## Knowledge Base:\n${knowledgeBase}\n` : ''}

## Output Format:
For each scenario, provide a JSON object with:
- title: Compelling, specific title (e.g., "Lost Conversation Control - Customer Dictated Flow", "Cultural Insensitivity in Product Explanation")
- dimension: The PRIMARY dimension label this fits into. Use EXACTLY ONE of:
  * "Conversation Control & Flow Management" (A)
  * "Temporal Dynamics & Turn-Taking" (B)
  * "Context Tracking & Intent Alignment" (C)
  * "Language Quality & Human-Likeness" (D)
  * "Knowledge & Accuracy" (E)
  * "Process & Policy Adherence" (F)
  * "Novel & Emerging Issues" (G) - only if it truly doesn't fit A-F
- rootCauseType: The PRIMARY root cause of the agent failure. You MUST classify into EXACTLY ONE of these 5 categories (DO NOT use "N/A", "unknown", or any other value):

  1️⃣ "knowledge" - KNOWLEDGE GAP
  Use this ONLY if required factual or domain information was NOT available to the agent anywhere.
  Criteria:
  - The information does not exist in the prompt, knowledge base, tools, or references
  - Even a perfectly instructed agent could not answer correctly
  Examples: Missing product pricing/specs/policies, unknown escalation contacts, missing regulatory facts
  Fix location: Knowledge base / documentation
  User-friendly meaning: "The bot didn't have the information."

  2️⃣ "instruction" - INSTRUCTION GAP
  Use this if the information EXISTS, but the agent was NOT instructed on HOW or WHEN to use it.
  Criteria:
  - Data or facts are present
  - But rules, logic, triggers, or flow instructions are missing or unclear
  - Agent behavior is undefined or underspecified
  Examples: Refund policy exists but no instruction on when to offer it, bot not told to ask for order number, KB exists but no instruction to consult it
  Fix location: System prompt / conversation design
  User-friendly meaning: "The bot wasn't told how to handle this situation."

  3️⃣ "execution" - EXECUTION FAILURE
  Use this if BOTH the information AND the instructions EXIST, but the agent FAILED to apply them.
  Criteria:
  - Clear instructions are present
  - Required knowledge is present
  - Expected behavior is unambiguous
  - Agent ignored, skipped, or misapplied the rule
  Examples: Identity confirmation rule exists but bot skips it, refund logic defined but wrong branch used, instruction to consult KB exists but bot answers from memory
  Fix location: Prompt reinforcement, constraints, examples, guardrails
  User-friendly meaning: "The bot knew what to do, but didn't do it."

  4️⃣ "conversation" - CONVERSATION DESIGN ISSUE
  Use this if the agent technically followed instructions but the experience was poor or unnatural.
  Criteria:
  - Steps are correct
  - Information is correct
  - But conversation quality is degraded
  Examples: Interrupting the customer, asking multiple questions at once, robotic phrasing, poor turn-taking or abrupt transitions
  Fix location: Conversation design, tone rules, phrasing guidance
  User-friendly meaning: "The conversation felt awkward or confusing."

  5️⃣ "model" - MODEL LIMITATION (USE RARELY, expected <5% of cases)
  Use this RARELY when all other categories are ruled out.
  Criteria:
  - Knowledge is complete
  - Instructions are clear
  - Prompt is well-designed
  - Failure persists due to fundamental model capability limits
  Examples: Long multi-step reasoning consistently fails, complex judgment beyond model class, persistent memory breakdown across turns
  Fix location: Model upgrade or architectural change
  User-friendly meaning: "This task exceeds the model's capability."

  CLASSIFICATION RULES (NON-NEGOTIABLE):
  - Choose ONLY ONE primary category per issue
  - If multiple seem applicable, select the EARLIEST root cause: Knowledge > Instruction > Execution > Conversation > Model
  - NEVER label as Knowledge Gap if the information exists but was unused
  - NEVER label as Model Limitation unless all other categories are ruled out
  - DO NOT invent missing information or instructions
  - When uncertain, choose the closest match from these 5 options. Never use any value other than these exact 5 strings.
- context: Rich contextual details - what was happening, what led to this moment (e.g., "Lines 45-67, during pricing discussion, agent made assumption about customer's budget based on accent")
- whatHappened: Detailed, specific description of what the agent did or didn't do - be observant and nuanced
- impact: Clear explanation of how this affected customer experience, trust, satisfaction, or call outcome - be specific
- severity: one of [low, medium, high, critical] - based on actual impact to customer and business
- confidence: number between 0-100 - how confident you are this is a genuine issue worth addressing
- lineNumbers: array of line numbers where this scenario occurs (e.g., [19, 20, 21, 22] for lines 19-22)
- instructionReference (REQUIRED for rootCauseType="execution", optional otherwise): {
    source: "script" | "kb" | "policy" | "guideline",
    documentName: optional string (e.g., "Sales Call Script v2.1"),
    section: string (e.g., "Section 2.3: Pricing Objections", "Lines 15-20", "Payment Confirmation Step"),
    expectedBehavior: string (what the instruction says the agent should do),
    actualBehavior: string (what the agent actually did instead),
    confidence: optional number 0-100 (how confident you are about this specific instruction reference)
  }
  NOTE: When classifying as "execution", you MUST identify which specific script/KB/policy instruction was not followed. If you cannot identify a specific instruction, reconsider whether this is truly an execution failure or an instruction gap.

IMPORTANT GUIDELINES:
- Do NOT include evidence snippets or transcript excerpts in the JSON - just provide line numbers
- Think like an experienced call center trainer who notices subtle patterns and missed opportunities
- Be constructive, specific, and actionable - not just critical
- Look for both OBVIOUS issues and SUBTLE patterns that manual reviews often miss
- Consider the customer's emotional journey and experience
- Identify moments where the agent could have been more effective
- **ADAPTIVE MINDSET**: Stay alert for novel issue types (bias, privacy, AI-specific problems, emerging customer needs)

Quality over quantity - each scenario should be meaningful and tied to a specific dimension.

Return ONLY a valid JSON array of scenarios. If no concerning scenarios are found, return an empty array [].`;

  const userPrompt = `Transcript to analyze:\n${transcriptText}`;

  try {
    console.log(`[SCENARIO ANALYSIS] Starting for ${transcript.id}`);
    console.log(`[SCENARIO ANALYSIS] Audit prompt length: ${auditPrompt.length} chars`);
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
  "exactContent": "The EXACT text to add or use as replacement - make this copy-paste ready",
  "beforeText": "For 'replace' action - the text to be replaced"
}

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
