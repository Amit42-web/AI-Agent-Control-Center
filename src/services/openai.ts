import { Transcript, DetectedIssue, CheckConfig, IssueType, Severity, Fix, Scenario, EnhancedFix, FixType } from '@/types';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
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

  // Build transcript text
  const transcriptText = transcript.lines
    .map((line, idx) => `[${idx + 1}] ${line.speaker.toUpperCase()}: ${line.text}`)
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

    // Convert to DetectedIssue format with IDs
    return issues.map((issue: {
      type: string;
      severity: string;
      confidence: number;
      evidenceSnippet: string;
      lineNumbers: number[];
      explanation: string;
      suggestedFix?: string;
    }, idx: number) => ({
      id: `${transcript.id}-issue-${idx}`,
      callId: transcript.id,
      type: issue.type as IssueType,
      severity: issue.severity as Severity,
      confidence: issue.confidence,
      evidenceSnippet: issue.evidenceSnippet,
      lineNumbers: issue.lineNumbers,
      explanation: issue.explanation,
      suggestedFix: issue.suggestedFix,
    }));
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
- action: one of ["add", "remove", "replace"] - what type of change to make
  * "add": Insert new content (most common)
  * "remove": Delete existing problematic content
  * "replace": Replace existing content with improved version
- suggestion: MUST BE IN ENGLISH - This is instruction/guidance for developers - DO NOT write in Hindi/Hinglish - MUST USE SAME SCRIPT/ALPHABET AS REFERENCE (English/Latin characters)
- targetContent: (ONLY for "remove" or "replace") The exact text from the script to remove/replace
- placementHint: ONLY where to make the change (e.g., "Add to State S1" or "Replace in State S2")
- exampleResponse: (OPTIONAL) What the bot should actually say to customers (this CAN be in native language/Hinglish)
- relatedIssueIds: array of issue IDs this addresses

🎯 LANGUAGE RULES FOR SUGGESTION FIELD:
- suggestion field = INSTRUCTIONS for developers in ENGLISH
- Write like you're instructing a developer: "Always check availability in one complete sentence..."
- DO NOT write in romanized Hindi/Hinglish like "Availability check ko hamesha..."
- Keep it professional, clear, and in English
- exampleResponse field = What bot SAYS to customers (can be Hindi/Hinglish/native language)

🚨 CRITICAL - SUGGESTION FIELD RULES:
- "suggestion" = The actual instruction/guidance ONLY
- DO NOT start with "In State X" or "Add to..." or any location phrases
- DO NOT include where to add it - that goes in "placementHint"
- Start directly with the instruction: "First clearly check availability..." NOT "In State S0, first clearly check..."
- Examples in suggestion field are OPTIONAL - only include if truly helpful to show bot's response format

CRITICAL SEPARATION:
- "suggestion" field = WHAT to add/replace (the actual prompt/instruction text ONLY)
- "placementHint" field = WHERE to make the change (location description ONLY)
- DO NOT mix these two! Keep them completely separate.

Example for LATIN/ROMAN script reference (CORRECT - DO THIS):
Reference script format: "State S0 - Availability & Readiness Check / Confirm customer availability"
{
  "action": "add",
  "suggestion": "Always check availability in one complete, clear sentence. Do not fragment the question or pause mid-sentence. Ask in a single flow without breaking into pieces. The question should feel natural and complete.",
  "exampleResponse": "Namaste, kya abhi aap baat karna aapke liye theek rahega? Yeh call sirf 2 minute ka hai.",
  "placementHint": "Add under State S0 - Availability & Readiness Check as explicit phrasing guidance for the first question"
}

WRONG Example 1 (DO NOT DO THIS - includes location in suggestion):
{
  "action": "add",
  "suggestion": "In State S0 - Availability & Readiness Check, use a clear sentence...",  ← WRONG - has "In State S0"
  "placementHint": "Add to State S0"
}

WRONG Example 2 (DO NOT DO THIS - suggestion in Hindi/Hinglish):
{
  "action": "add",
  "suggestion": "Availability check ko hamesha ek hi poori saaf sentence mein bolo, beech mein ruk kar tukde-tukde mein mat bolo.",  ← WRONG - uses Hinglish
  "placementHint": "Add to State S0"
}

WRONG Example 3 (DO NOT DO THIS - uses Devanagari script):
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
        `Issue ID: ${issue.id}\nType: ${issue.type}\nSeverity: ${issue.severity}\nExplanation: ${issue.explanation}\nEvidence: ${issue.evidenceSnippet}`
    )
    .join('\n\n---\n\n');

  const userPrompt = `Issues detected:\n\n${issuesSummary}\n\n${
    referenceScript ? `Current Reference Script (ANALYZE THE SCRIPT/ALPHABET USED):\n${referenceScript}\n\n` : ''
  }${
    knowledgeBase ? `Current Knowledge Base:\n${knowledgeBase}\n\n` : ''
  }Generate PROMPT-ONLY fix suggestions. Each suggestion must be a specific prompt instruction that can be added to the bot's system prompt, reference script, or knowledge base.

⚠️ CRITICAL REMINDERS:
1. LANGUAGE: Write "suggestion" field in ENGLISH only (instructions for developers). Write "exampleResponse" field in the native language the bot speaks to customers.
2. FORMAT: Match the reference script's formatting style (State S0, bullet points, etc.)
3. LOCATION: DO NOT include location/placement info in "suggestion" - that goes in "placementHint"

Think: "suggestion" = Developer instructions in English | "exampleResponse" = What bot says to customers`;

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
      console.error('Attempted to parse:', jsonStr.substring(0, 500)); // Log first 500 chars

      // Try multiple cleanup strategies
      try {
        // Strategy 1: Fix common issues
        let cleaned = jsonStr
          .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
          .replace(/\n/g, ' ')             // Remove newlines
          .replace(/\r/g, '')              // Remove carriage returns
          .replace(/\t/g, ' ');            // Replace tabs with spaces

        fixesData = JSON.parse(cleaned);
      } catch (secondError) {
        try {
          // Strategy 2: More aggressive - fix escaped quotes
          let cleaned = jsonStr
            .replace(/\\'/g, "'")           // Fix escaped single quotes
            .replace(/,(\s*[}\]])/g, '$1')  // Remove trailing commas
            .replace(/[\n\r\t]/g, ' ')      // Remove all whitespace chars
            .replace(/\s+/g, ' ');          // Collapse multiple spaces

          fixesData = JSON.parse(cleaned);
        } catch (thirdError) {
          // Last resort: try to extract just the arrays
          console.error('All parsing strategies failed');
          console.error('Original error:', parseError);
          console.error('Second error:', secondError);
          console.error('Third error:', thirdError);

          throw new Error(`Failed to parse fix suggestions. The AI response was not in valid JSON format. Please try again.`);
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
      ? fixesData.scriptFixes.map((fix: any, idx: number) => ({
          id: `script-fix-${idx}`,
          issueType: fix.issueType || 'quality_issue',
          problem: fix.problem || 'Issue detected',
          suggestion: fix.suggestion || '',
          placementHint: fix.placementHint || 'Add to system prompt',
          exampleResponse: fix.exampleResponse || '',
          relatedIssueIds: Array.isArray(fix.relatedIssueIds) ? fix.relatedIssueIds : [],
          action: fix.action || 'add',
          targetContent: fix.targetContent || undefined,
        }))
      : [];

    const generalFixes = Array.isArray(fixesData.generalFixes)
      ? fixesData.generalFixes.map((fix: any, idx: number) => ({
          id: `general-fix-${idx}`,
          issueType: fix.issueType || 'quality_issue',
          problem: fix.problem || 'Issue detected',
          suggestion: fix.suggestion || '',
          placementHint: fix.placementHint || 'Add to system prompt',
          exampleResponse: fix.exampleResponse || '',
          relatedIssueIds: Array.isArray(fix.relatedIssueIds) ? fix.relatedIssueIds : [],
          action: fix.action || 'add',
          targetContent: fix.targetContent || undefined,
        }))
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

  // Build transcript text
  const transcriptText = transcript.lines
    .map((line, idx) => `[${idx + 1}] ${line.speaker.toUpperCase()}: ${line.text}`)
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
- rootCauseType: WHY this issue happened. You MUST select EXACTLY ONE of these 5 values (DO NOT use "N/A", "unknown", or any other value):
  * "prompt" - Agent's CONVERSATION DESIGN, SYSTEM INSTRUCTIONS, or PROMPTS need updates (FIX: change configuration, prompts, conversation structure, or flow scripts)
  * "training" - AI model has FUNDAMENTAL CAPABILITY LIMITATIONS that cannot be fixed with better prompts (FIX: model upgrade, fine-tuning, or specialized training) - USE THIS VERY RARELY
  * "knowledge" - INFORMATION IS MISSING from knowledge base or reference materials (FIX: add to KB/docs)
  * "process" - BUSINESS WORKFLOW/PROCEDURES are flawed (FIX: revise business processes)
  * "system" - TECHNICAL LIMITATIONS, bugs, or system capability issues (FIX: engineering/dev work)

  CRITICAL DISTINCTION - Prompt vs Training (MOST ISSUES ARE PROMPT, NOT TRAINING):
  - DEFAULT TO "prompt" for 95% of issues - this includes conversation flow, structure, instructions, tone, phrasing, logic, etc.
  - Use "prompt" when: wrong greeting, missing context handling, poor transitions, unclear instructions, flow gaps, structural issues, tone problems, logic errors
  - Use "training" ONLY when: AI fundamentally cannot understand a domain despite perfect prompts (e.g., cannot comprehend medical terminology), consistent failures across all prompt variations, or proven model capability gaps
  - Example "prompt": Agent doesn't ask for order details → fix the conversation flow/prompt
  - Example "prompt": Agent interrupts customer → adjust prompt instructions for turn-taking
  - Example "prompt": Agent gives wrong tone → update prompt with tone guidance
  - Example "training": AI cannot distinguish regional accents despite perfect instructions → model limitation
  - Example "training": AI cannot understand domain-specific jargon even with definitions → needs fine-tuning

  When in doubt between "prompt" and "training", ALWAYS choose "prompt". Training should be <5% of all scenarios.

  If uncertain, choose the closest match from these 5 options. Never use any value other than these exact 5 strings.
- context: Rich contextual details - what was happening, what led to this moment (e.g., "Lines 45-67, during pricing discussion, agent made assumption about customer's budget based on accent")
- whatHappened: Detailed, specific description of what the agent did or didn't do - be observant and nuanced
- impact: Clear explanation of how this affected customer experience, trust, satisfaction, or call outcome - be specific
- severity: one of [low, medium, high, critical] - based on actual impact to customer and business
- confidence: number between 0-100 - how confident you are this is a genuine issue worth addressing
- lineNumbers: array of line numbers where this scenario occurs (e.g., [19, 20, 21, 22] for lines 19-22)

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
    const validRootCauseTypes = ['prompt', 'training', 'process', 'system', 'knowledge'];

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
      };
    });
  } catch (error) {
    console.error('Error analyzing transcript scenarios:', error);
    throw error;
  }
}

// Open-ended flow: Generate enhanced fix suggestions with implementation details
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
- prompt: Agent's system instructions/prompts are inadequate
- flow: Conversation script/flow structure has gaps
- training: Agent lacks skills or coaching
- process: Business workflow is flawed
- system: Technical limitation or bug
- knowledge: Information missing from knowledge base

For each scenario, provide a JSON object with:
- scenarioId: The ID of the scenario this addresses
- title: Short descriptive title (e.g., "Add Empathy Steps", "Improve Information Gathering")
- fixType: one of [script, training, process, system]
- rootCauseType: one of [prompt, training, process, system, knowledge] - WHY this issue happened
- rootCause: Detailed explanation of why this scenario happened (1-2 sentences)
- suggestedSolution: What to do about it (overview, 2-3 sentences)
- whereToImplement: Specific location in the flow/process/script where this applies
- whatToImplement: Detailed steps or content to add/change (be very specific)
- concreteExample: Before/after example or sample dialogue showing the improvement
- successCriteria: How to measure if this fix worked (observable outcomes)
- howToTest: Specific validation method (e.g., "Review next 10 calls for empathy statements")

**CRITICAL - For PROMPT (Design) fixes, ALSO provide a "promptFix" object:**
{
  "action": "add" | "replace" | "remove",
  "targetSection": "Specific section name (e.g., 'State S0 - Availability Check' or 'System Prompt - Empathy Guidelines')",
  "lineNumber": optional number if you can identify exact line,
  "exactContent": "The EXACT text to add or use as replacement - make this copy-paste ready",
  "beforeText": "For 'replace' action - the text to be replaced"
}

Examples:
- If rootCauseType is "prompt": Add promptFix with exact system instruction text, conversation flow, or script dialogue to add/replace
- If rootCauseType is "training/process/system/knowledge": Do NOT include promptFix (not applicable)

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
    const validRootCauseTypes = ['prompt', 'training', 'process', 'system', 'knowledge'];

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
      let rootCauseType = fix.rootCauseType?.toLowerCase() || 'training';

      // If rootCauseType is invalid, default to 'training'
      if (!validRootCauseTypes.includes(rootCauseType)) {
        console.warn(`[Fix ${idx}] Invalid rootCauseType "${fix.rootCauseType}" - defaulting to "training". Valid values are: ${validRootCauseTypes.join(', ')}`);
        rootCauseType = 'training';
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
