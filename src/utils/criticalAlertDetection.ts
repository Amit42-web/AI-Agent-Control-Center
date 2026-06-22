import {
  Transcript,
  CriticalAlertConfig,
  DetectedCriticalAlert,
  CriticalAlertId,
  CriticalAlertCategory,
} from '@/types';

function randomId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeAlert(
  alertConfigId: CriticalAlertId,
  config: CriticalAlertConfig,
  callId: string,
  evidence: string,
  confidence: number,
  lineNumbers?: number[]
): DetectedCriticalAlert {
  return {
    id: randomId(),
    alertConfigId,
    callId,
    alertName: config.name,
    category: config.category,
    evidence,
    lineNumbers,
    confidence,
  };
}

/** Normalise text for comparison: lowercase, collapse whitespace, strip punctuation */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(' ').filter(Boolean));
  const wordsB = new Set(normalize(b).split(' ').filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  wordsA.forEach((w) => { if (wordsB.has(w)) intersection++; });
  return intersection / Math.max(wordsA.size, wordsB.size);
}

// ─── Deterministic checks ────────────────────────────────────────────────────

export function runDeterministicChecks(
  transcript: Transcript,
  configs: CriticalAlertConfig[]
): DetectedCriticalAlert[] {
  const enabledIds = new Set(
    configs
      .filter((c) => c.enabled && c.detectionMethod === 'deterministic')
      .map((c) => c.id)
  );
  const configMap = Object.fromEntries(configs.map((c) => [c.id, c]));

  const alerts: DetectedCriticalAlert[] = [];
  const lines = transcript.lines;
  if (!lines || lines.length === 0) return alerts;

  const agentLines = lines.filter((l) => l.speaker === 'agent');
  const customerLines = lines.filter((l) => l.speaker === 'customer');

  // ── bot_silence ────────────────────────────────────────────────────────────
  if (enabledIds.has('bot_silence')) {
    const cfg = configMap['bot_silence'];
    let silentCount = 0;
    lines.forEach((line, idx) => {
      if (line.speaker !== 'agent') return;
      const words = line.text.trim().split(/\s+/).filter(Boolean);
      if (words.length <= 2 && silentCount < 3) {
        silentCount++;
        alerts.push(
          makeAlert(
            'bot_silence',
            cfg,
            transcript.id,
            `Line ${idx + 1}: "${line.text.trim()}"`,
            95,
            [idx + 1]
          )
        );
      }
    });
  }

  // ── loop_detection ────────────────────────────────────────────────────────
  if (enabledIds.has('loop_detection')) {
    const cfg = configMap['loop_detection'];
    const agentTurns = lines
      .map((l, idx) => ({ ...l, lineNum: idx + 1 }))
      .filter((l) => l.speaker === 'agent');

    for (let i = 1; i < agentTurns.length; i++) {
      const prev = agentTurns[i - 1];
      const curr = agentTurns[i];
      if (wordOverlap(prev.text, curr.text) >= 0.70) {
        alerts.push(
          makeAlert(
            'loop_detection',
            cfg,
            transcript.id,
            `Lines ${prev.lineNum} and ${curr.lineNum}: "${curr.text.slice(0, 120)}"`,
            90,
            [prev.lineNum, curr.lineNum]
          )
        );
        // Skip the next to avoid chaining duplicate alerts
        i++;
      }
    }
  }

  // ── one_sided_call ────────────────────────────────────────────────────────
  if (enabledIds.has('one_sided_call')) {
    const cfg = configMap['one_sided_call'];
    const agentWords = agentLines.reduce(
      (sum, l) => sum + l.text.split(/\s+/).filter(Boolean).length,
      0
    );
    const totalWords = lines.reduce(
      (sum, l) => sum + l.text.split(/\s+/).filter(Boolean).length,
      0
    );
    if (totalWords > 0 && agentWords / totalWords < 0.10) {
      const pct = Math.round((agentWords / totalWords) * 100);
      alerts.push(
        makeAlert(
          'one_sided_call',
          cfg,
          transcript.id,
          `Bot spoke ${pct}% of total words (${agentWords}/${totalWords})`,
          92
        )
      );
    }
  }

  // ── call_ended_customer ───────────────────────────────────────────────────
  if (enabledIds.has('call_ended_customer')) {
    const cfg = configMap['call_ended_customer'];
    const lastThree = lines.slice(-3);
    if (lastThree.length === 3 && lastThree.every((l) => l.speaker === 'customer')) {
      const lineNums = lines.slice(-3).map((_, i) => lines.length - 2 + i);
      alerts.push(
        makeAlert(
          'call_ended_customer',
          cfg,
          transcript.id,
          `Last 3 turns were all from the customer with no bot response: "${lastThree[lastThree.length - 1].text.slice(0, 100)}"`,
          88,
          lineNums
        )
      );
    }
  }

  // ── no_greeting ───────────────────────────────────────────────────────────
  if (enabledIds.has('no_greeting')) {
    const cfg = configMap['no_greeting'];
    const greetingWords = [
      'hello', 'hi', 'good morning', 'good afternoon', 'good evening',
      'welcome', 'thank you for calling', 'namaskar', 'namaste', 'greetings',
    ];
    // Check first 3 agent turns
    const firstAgentTurns = agentLines.slice(0, 3);
    const hasGreeting = firstAgentTurns.some((l) => {
      const lower = l.text.toLowerCase();
      return greetingWords.some((g) => lower.includes(g));
    });
    if (firstAgentTurns.length > 0 && !hasGreeting) {
      alerts.push(
        makeAlert(
          'no_greeting',
          cfg,
          transcript.id,
          `First bot turn: "${firstAgentTurns[0].text.slice(0, 120)}" — no greeting detected`,
          85
        )
      );
    }
  }

  // ── wrong_language ────────────────────────────────────────────────────────
  if (enabledIds.has('wrong_language')) {
    const cfg = configMap['wrong_language'];
    const linesWithLanguage = lines.filter((l) => l.language);
    if (linesWithLanguage.length >= 4) {
      const agentLangs = lines
        .filter((l) => l.speaker === 'agent' && l.language)
        .map((l) => l.language as string);
      const customerLangs = lines
        .filter((l) => l.speaker === 'customer' && l.language)
        .map((l) => l.language as string);

      if (agentLangs.length > 0 && customerLangs.length > 0) {
        const dominantAgentLang = mode(agentLangs);
        const dominantCustomerLang = mode(customerLangs);
        if (dominantAgentLang && dominantCustomerLang && dominantAgentLang !== dominantCustomerLang) {
          alerts.push(
            makeAlert(
              'wrong_language',
              cfg,
              transcript.id,
              `Customer spoke ${dominantCustomerLang}, bot responded in ${dominantAgentLang}`,
              90
            )
          );
        }
      }
    }
  }

  return alerts;
}

function mode(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const counts: Record<string, number> = {};
  arr.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ─── LLM checks ──────────────────────────────────────────────────────────────

const LLM_CHECK_DESCRIPTIONS: Record<CriticalAlertId, string> = {
  transfer_denied: 'Customer explicitly asked to speak to a human and the bot refused or ignored the request',
  cancel_ignored: 'Customer said cancel/terminate/stop the service and the bot ignored or deflected the request',
  repeated_unresolved: 'Customer repeated the exact same request 3+ times without the bot resolving it',
  frustration_ignored: 'Customer expressed extreme frustration/anger and the bot gave a generic or dismissive response',
  customer_hung_up: 'Customer abruptly ended the call (e.g., said "hello? hello?" repeatedly or disconnected mid-conversation)',
  denied_being_bot: 'Customer asked if the agent is a bot/AI/robot and the bot explicitly denied it',
  impersonated_human: 'Bot claimed to be a human agent or used a human name to pass as a person',
  false_urgency: 'Bot created false time pressure such as "this offer expires soon" to manipulate the customer',
  unauthorized_commitment: 'Bot promised a refund, callback, compensation, or discount without authority to do so',
  shared_data_no_verification: 'Bot shared sensitive account or personal data before verifying the customer\'s identity',
  identity_skip: 'Bot proceeded to account-related actions (balance, changes) without completing identity verification',
  skipped_mandatory_disclosure: 'Bot missed a required legal or compliance statement (recording notice, terms, etc.)',
  continued_after_optout: 'Customer explicitly said to stop calling / remove them, but bot continued the interaction',
  out_of_scope_advice: 'Bot gave legal, medical, or financial advice outside its role and authority',
  wrong_price: 'Bot quoted a price, fee, or plan that differs from the correct/standard pricing',
  no_resolution: 'Call ended without any clear outcome, resolution, or next step being communicated to the customer',
  // Deterministic IDs (will never be requested here, but typed to satisfy Record<CriticalAlertId, string>)
  bot_silence: '',
  loop_detection: '',
  one_sided_call: '',
  call_ended_customer: '',
  no_greeting: '',
  wrong_language: '',
};

const CATEGORY_MAP: Record<CriticalAlertId, CriticalAlertCategory> = {
  bot_silence: 'bot_failure',
  loop_detection: 'bot_failure',
  one_sided_call: 'bot_failure',
  call_ended_customer: 'bot_failure',
  no_greeting: 'bot_failure',
  wrong_language: 'bot_failure',
  transfer_denied: 'escalation',
  cancel_ignored: 'escalation',
  repeated_unresolved: 'escalation',
  frustration_ignored: 'escalation',
  customer_hung_up: 'escalation',
  denied_being_bot: 'deception',
  impersonated_human: 'deception',
  false_urgency: 'deception',
  unauthorized_commitment: 'compliance',
  shared_data_no_verification: 'compliance',
  identity_skip: 'compliance',
  skipped_mandatory_disclosure: 'compliance',
  continued_after_optout: 'compliance',
  out_of_scope_advice: 'compliance',
  wrong_price: 'compliance',
  no_resolution: 'flow',
};

export async function runLLMChecks(
  transcript: Transcript,
  configs: CriticalAlertConfig[],
  apiKey: string,
  model: string
): Promise<DetectedCriticalAlert[]> {
  const llmConfigs = configs.filter(
    (c) => c.enabled && c.detectionMethod === 'llm'
  );
  if (llmConfigs.length === 0 || !transcript.lines || transcript.lines.length === 0) {
    return [];
  }

  try {
    const checksList = llmConfigs
      .map((c, i) => `${i + 1}. ${c.id}: ${LLM_CHECK_DESCRIPTIONS[c.id]}`)
      .join('\n');

    const transcriptText = transcript.lines
      .map((l, idx) => `[${idx + 1}] ${l.speaker === 'agent' ? 'Agent' : 'Customer'}: ${l.text}`)
      .join('\n');

    const systemPrompt = `You are a critical QA system for AI voice bot calls. Analyze the transcript for specific critical violations.
RULES:
- Only report a condition if you can quote the EXACT line from the transcript
- If you are not at least 85% confident, do NOT report it
- Prefer false negatives over false positives — accuracy is paramount
- Return valid JSON only`;

    const userPrompt = `Check this transcript for the following critical conditions:
${checksList}

TRANSCRIPT:
${transcriptText}

Return a JSON array (empty array [] if nothing found):
[{"alertId": "transfer_denied", "evidence": "exact quote from transcript", "lineNumbers": [12, 13], "confidence": 92}]`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      console.error('Critical alerts LLM call failed:', response.statusText);
      return [];
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || '[]';

    // Extract JSON array from response (handle markdown code blocks)
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed: Array<{
      alertId: string;
      evidence: string;
      lineNumbers?: number[];
      confidence: number;
    }> = JSON.parse(jsonMatch[0]);

    const configMap = Object.fromEntries(llmConfigs.map((c) => [c.id, c]));

    return parsed
      .filter((item) => item.confidence >= 80 && configMap[item.alertId])
      .map((item) => {
        const cfg = configMap[item.alertId];
        return {
          id: randomId(),
          alertConfigId: item.alertId as CriticalAlertId,
          callId: transcript.id,
          alertName: cfg.name,
          category: CATEGORY_MAP[item.alertId as CriticalAlertId] ?? cfg.category,
          evidence: item.evidence,
          lineNumbers: item.lineNumbers,
          confidence: item.confidence,
        } satisfies DetectedCriticalAlert;
      });
  } catch (err) {
    console.error('Error running LLM critical alert checks:', err);
    return [];
  }
}
