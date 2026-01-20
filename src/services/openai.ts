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
  checks: CheckConfig[],
  referenceScript: string | null,
  knowledgeBase: string | null = null
): Promise<Scenario[]> {
  const enabledChecks = checks.filter((c) => c.enabled);

  if (enabledChecks.length === 0) {
    console.log('No enabled checks, skipping scenario analysis');
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

  console.log(`Analyzing transcript ${transcript.id} for scenarios with ${transcript.lines.length} lines`);

  // Build checks description
  const checksDescription = enabledChecks
    .map((check) => `- ${check.name}: ${check.instructions}`)
    .join('\n');

  const systemPrompt = `You are an expert call center quality analyst conducting holistic, open-ended audits of agent performance.

Your task is to identify SCENARIOS where the agent underperformed or could improve. Think beyond simple rule violations - look for:
- Missed opportunities to build rapport or show empathy
- Poor handling of customer emotions or objections
- Incomplete problem resolution or information gathering
- Lack of personalization or active listening
- Process inefficiencies or awkward conversation flow
- Any situation where customer experience was suboptimal

Focus areas based on enabled checks:
${checksDescription}

${referenceScript ? `Reference Script/Flow:\n${referenceScript}\n` : ''}
${knowledgeBase ? `Knowledge Base:\n${knowledgeBase}\n` : ''}

For each scenario, provide a JSON object with:
- title: Concise title describing the scenario (e.g., "Empathy Gap During Customer Frustration", "Incomplete Information Gathering")
- context: Where/when this occurred (e.g., "Lines 45-67, customer expressed frustration about delayed order")
- whatHappened: What the agent did or didn't do (be specific and objective)
- impact: How this affected the customer experience or call outcome
- severity: one of [low, medium, high, critical] - based on impact to customer
- confidence: number between 0-100 - how confident you are this is a genuine issue
- lineNumbers: array of line numbers where this scenario occurs
- evidenceSnippet: relevant excerpt from the transcript

Think like a call center trainer reviewing calls with agents. Be constructive, specific, and focus on actionable improvements.

Return ONLY a JSON array of scenarios. If no concerning scenarios are found, return an empty array [].`;

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

    let scenarios;
    try {
      scenarios = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Attempted to parse:', jsonStr);

      // Try one more time with cleanup
      try {
        const cleaned = jsonStr
          .replace(/,(\s*[}\]])/g, '$1')
          .replace(/\n/g, ' ')
          .replace(/\r/g, '');
        scenarios = JSON.parse(cleaned);
      } catch (secondError) {
        console.error('Failed to parse scenarios after cleanup:', secondError);
        return [];
      }
    }

    if (!Array.isArray(scenarios)) {
      console.error('Parsed result is not an array:', scenarios);
      return [];
    }

    console.log(`Found ${scenarios.length} scenarios in transcript ${transcript.id}`);

    // Convert to Scenario format with IDs
    return scenarios.map((scenario: {
      title: string;
      context: string;
      whatHappened: string;
      impact: string;
      severity: string;
      confidence: number;
      lineNumbers: number[];
      evidenceSnippet: string;
    }, idx: number) => ({
      id: `${transcript.id}-scenario-${idx}`,
      callId: transcript.id,
      title: scenario.title,
      context: scenario.context,
      whatHappened: scenario.whatHappened,
      impact: scenario.impact,
      severity: scenario.severity as Severity,
      confidence: scenario.confidence,
      lineNumbers: scenario.lineNumbers,
      evidenceSnippet: scenario.evidenceSnippet,
    }));
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
- WHY did this happen? (root cause)
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

For each scenario, provide a JSON object with:
- scenarioId: The ID of the scenario this addresses
- title: Short descriptive title (e.g., "Add Empathy Steps", "Improve Information Gathering")
- fixType: one of [script, training, process, system]
- rootCause: Why this scenario happened (1-2 sentences)
- suggestedSolution: What to do about it (overview, 2-3 sentences)
- whereToImplement: Specific location in the flow/process/script where this applies
- whatToImplement: Detailed steps or content to add/change (be very specific)
- concreteExample: Before/after example or sample dialogue showing the improvement
- successCriteria: How to measure if this fix worked (observable outcomes)
- howToTest: Specific validation method (e.g., "Review next 10 calls for empathy statements", "Check if customers ask fewer clarifying questions")

Be practical and actionable. Think like you're creating an implementation plan for a team.

Return ONLY a JSON array of enhanced fixes. Return one fix per scenario.`;

  const scenariosSummary = scenarios
    .map(
      (scenario) =>
        `Scenario ID: ${scenario.id}\nTitle: ${scenario.title}\nContext: ${scenario.context}\nWhat Happened: ${scenario.whatHappened}\nImpact: ${scenario.impact}\nSeverity: ${scenario.severity}`
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

    // Convert to EnhancedFix format with IDs
    return fixes.map((fix: {
      scenarioId: string;
      title: string;
      fixType: string;
      rootCause: string;
      suggestedSolution: string;
      whereToImplement: string;
      whatToImplement: string;
      concreteExample: string;
      successCriteria: string;
      howToTest: string;
    }, idx: number) => ({
      id: `enhanced-fix-${idx}`,
      scenarioId: fix.scenarioId,
      title: fix.title,
      fixType: fix.fixType as FixType,
      rootCause: fix.rootCause,
      suggestedSolution: fix.suggestedSolution,
      whereToImplement: fix.whereToImplement,
      whatToImplement: fix.whatToImplement,
      concreteExample: fix.concreteExample,
      successCriteria: fix.successCriteria,
      howToTest: fix.howToTest,
    }));
  } catch (error) {
    console.error('Error generating enhanced fix suggestions:', error);
    throw error;
  }
}
