import { Transcript, DetectedIssue, CheckConfig, IssueType, Severity, Fix } from '@/types';

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
- MAINTAIN the exact language, format, and style of the original script (do NOT translate to Devanagari or any other script)

For each fix, provide a JSON object with these SEPARATE fields:
- issueType: type of issue this addresses (flow_deviation, repetition_loop, language_mismatch, mid_call_restart, quality_issue)
- problem: brief description of the problem identified
- action: one of ["add", "remove", "replace"] - what type of change to make
  * "add": Insert new content (most common)
  * "remove": Delete existing problematic content
  * "replace": Replace existing content with improved version
- suggestion: The actual prompt text/instruction (for "add" or "replace" actions) - MAINTAIN ORIGINAL FORMAT
- targetContent: (ONLY for "remove" or "replace") The exact text from the script to remove/replace
- placementHint: ONLY where to make the change (e.g., "Add to State S1" or "Replace in State S2" or "Remove from State S3")
- exampleResponse: example of how bot should respond (avoid using quotes or special characters)
- relatedIssueIds: array of issue IDs this addresses

LANGUAGE AND FORMAT PRESERVATION:
- If the original script uses English with occasional Hindi terms, keep that exact style
- If it uses bullet points, keep bullet points
- If it uses specific formatting (dashes, numbers, etc.), maintain that
- DO NOT convert English to Devanagari or change the writing system
- DO NOT translate or change the format unless specifically needed for the fix

CRITICAL SEPARATION:
- "suggestion" field = WHAT to add/replace (the actual prompt/instruction text ONLY)
- "placementHint" field = WHERE to make the change (location description ONLY)
- DO NOT mix these two! Keep them completely separate.

Example of CORRECT format preservation:
{
  "action": "add",
  "suggestion": "Always verify customer identity with full name confirmation before proceeding\nExample: 'Am I speaking with [customer name]?'\nIf unclear, restate: 'This is Sunita from Animal app, am I speaking with [customer name]?'",
  "placementHint": "Within State S1 - Greeting & Identity Confirmation, after greeting and before availability check"
}

Example with REMOVE action:
{
  "action": "remove",
  "targetContent": "If busy, explain the call will take only two minutes",
  "suggestion": "",
  "placementHint": "Remove from State S0 - this creates pressure and should be removed"
}

Example with REPLACE action:
{
  "action": "replace",
  "targetContent": "Confirm customer availability",
  "suggestion": "Check customer availability and get explicit consent to continue\nExample: 'Do you have 2-3 minutes to discuss your listing?'\nIf not available: 'No problem! When would be a better time for me to call you back?'",
  "placementHint": "Replace in State S0 - Availability & Readiness Check"
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
    referenceScript ? `Current Reference Script:\n${referenceScript}\n\n` : ''
  }${
    knowledgeBase ? `Current Knowledge Base:\n${knowledgeBase}\n\n` : ''
  }Generate PROMPT-ONLY fix suggestions. Each suggestion must be a specific prompt instruction that can be added to the bot's system prompt, reference script, or knowledge base.`;

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
