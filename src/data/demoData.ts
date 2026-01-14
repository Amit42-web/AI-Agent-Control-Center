import { Transcript, CheckConfig, DetectedIssue, Fix } from '@/types';

// Demo transcript with all 4 error types
export const demoTranscript: Transcript = {
  id: 'demo-001',
  lines: [
    // Normal start
    { speaker: 'bot', text: 'Hello! Welcome to TechSupport. How can I assist you today?', timestamp: '00:00' },
    { speaker: 'customer', text: 'Hi, I need help with my internet connection. It keeps dropping.', timestamp: '00:05' },
    { speaker: 'bot', text: 'I understand you\'re having connectivity issues. Let me help you troubleshoot that.', timestamp: '00:10' },
    { speaker: 'customer', text: 'Yes please, it\'s been happening for two days now.', timestamp: '00:15' },

    // Flow deviation - Bot skips verification step, jumps directly to solution
    { speaker: 'bot', text: 'Please restart your router by unplugging it for 30 seconds.', timestamp: '00:20' },
    { speaker: 'customer', text: 'I already tried that three times.', timestamp: '00:25' },

    // Repetition loop starts
    { speaker: 'bot', text: 'I see. Have you tried restarting your router?', timestamp: '00:30' },
    { speaker: 'customer', text: 'Yes, I just told you I did that already.', timestamp: '00:35' },
    { speaker: 'bot', text: 'I understand. Let me suggest restarting your router by unplugging it for 30 seconds.', timestamp: '00:40' },
    { speaker: 'customer', text: 'Are you even listening? I said I already restarted it multiple times!', timestamp: '00:45' },
    { speaker: 'bot', text: 'I apologize for the confusion. Have you tried power cycling your router?', timestamp: '00:50' },

    // Customer switches to Hindi - Language mismatch
    { speaker: 'customer', text: 'Yeh kya ho raha hai? Mujhe Hindi mein baat karni hai.', timestamp: '00:55', language: 'hi' },
    { speaker: 'bot', text: 'I understand you\'re frustrated. Let me check your account details.', timestamp: '01:00' },
    { speaker: 'customer', text: 'Main Hindi mein baat kar raha hoon, aap English mein kyun jawab de rahe ho?', timestamp: '01:05', language: 'hi' },
    { speaker: 'bot', text: 'Could you please provide your account number so I can look into this further?', timestamp: '01:10' },

    // Mid-call restart/reset
    { speaker: 'customer', text: 'Fine, my account number is 12345678.', timestamp: '01:15' },
    { speaker: 'bot', text: 'Hello! Welcome to TechSupport. How can I assist you today?', timestamp: '01:20' },
    { speaker: 'customer', text: 'What? We were already talking! Why are you greeting me again?', timestamp: '01:25' },
    { speaker: 'bot', text: 'I apologize for any confusion. How may I help you today?', timestamp: '01:30' },

    // Attempt to recover
    { speaker: 'customer', text: 'This is ridiculous. I want to speak to a human.', timestamp: '01:35' },
    { speaker: 'bot', text: 'I understand your frustration. Let me transfer you to a human agent. Please hold.', timestamp: '01:40' },
  ],
  metadata: {
    duration: '01:45',
    date: '2024-01-15',
    agentId: 'BOT-001',
  },
};

// Additional demo transcripts for CSV batch testing
export const demoBatchTranscripts: Transcript[] = [
  demoTranscript,
  {
    id: 'demo-002',
    lines: [
      { speaker: 'bot', text: 'Hello! Welcome to TechSupport. How can I assist you today?', timestamp: '00:00' },
      { speaker: 'customer', text: 'I want to cancel my subscription.', timestamp: '00:05' },
      // Flow deviation - Doesn't follow cancellation protocol
      { speaker: 'bot', text: 'I\'m sorry to hear that. Your subscription has been cancelled.', timestamp: '00:10' },
      { speaker: 'customer', text: 'Wait, don\'t you need to verify my identity first?', timestamp: '00:15' },
      { speaker: 'bot', text: 'You\'re right, I apologize. Can I have your account number?', timestamp: '00:20' },
      // Language switch
      { speaker: 'customer', text: 'Mera account number 98765432 hai.', timestamp: '00:25', language: 'hi' },
      { speaker: 'bot', text: 'Thank you. I\'ve located your account. Are you sure you want to cancel?', timestamp: '00:30' },
    ],
    metadata: { duration: '00:35', date: '2024-01-15', agentId: 'BOT-002' },
  },
  {
    id: 'demo-003',
    lines: [
      { speaker: 'bot', text: 'Hello! Welcome to TechSupport. How can I assist you today?', timestamp: '00:00' },
      { speaker: 'customer', text: 'My bill seems too high this month.', timestamp: '00:05' },
      { speaker: 'bot', text: 'I\'d be happy to help review your bill. Let me pull up your account.', timestamp: '00:10' },
      { speaker: 'customer', text: 'Sure, take your time.', timestamp: '00:15' },
      // Repetition
      { speaker: 'bot', text: 'I\'d be happy to help review your bill. Let me pull up your account.', timestamp: '00:20' },
      { speaker: 'customer', text: 'You just said that...', timestamp: '00:25' },
      { speaker: 'bot', text: 'I apologize. I\'d be happy to help review your bill.', timestamp: '00:30' },
      { speaker: 'customer', text: 'This bot is broken.', timestamp: '00:35' },
    ],
    metadata: { duration: '00:40', date: '2024-01-15', agentId: 'BOT-001' },
  },
  {
    id: 'demo-004',
    lines: [
      { speaker: 'bot', text: 'Hello! Welcome to TechSupport. How can I assist you today?', timestamp: '00:00' },
      { speaker: 'customer', text: 'I need to update my address.', timestamp: '00:05' },
      { speaker: 'bot', text: 'Of course! I can help you with that. What is your new address?', timestamp: '00:10' },
      { speaker: 'customer', text: '123 Main Street, Apt 4B, New York, NY 10001', timestamp: '00:15' },
      { speaker: 'bot', text: 'Thank you. I\'ve updated your address to 123 Main Street, Apt 4B, New York, NY 10001.', timestamp: '00:20' },
      { speaker: 'customer', text: 'Great, thanks!', timestamp: '00:25' },
      { speaker: 'bot', text: 'You\'re welcome! Is there anything else I can help you with?', timestamp: '00:30' },
      { speaker: 'customer', text: 'No, that\'s all. Thanks!', timestamp: '00:35' },
      { speaker: 'bot', text: 'Thank you for contacting TechSupport. Have a great day!', timestamp: '00:40' },
    ],
    metadata: { duration: '00:45', date: '2024-01-15', agentId: 'BOT-003' },
  },
  {
    id: 'demo-005',
    lines: [
      { speaker: 'bot', text: 'Hello! Welcome to TechSupport. How can I assist you today?', timestamp: '00:00' },
      { speaker: 'customer', text: 'My payment didn\'t go through.', timestamp: '00:05' },
      { speaker: 'bot', text: 'I\'m sorry to hear about the payment issue. Let me check that for you.', timestamp: '00:10' },
      // Mid-call restart
      { speaker: 'bot', text: 'Hello! Welcome to TechSupport. How can I assist you today?', timestamp: '00:15' },
      { speaker: 'customer', text: 'Uhh what? We were just talking about my payment.', timestamp: '00:20' },
      { speaker: 'bot', text: 'I apologize for the confusion. Could you tell me what you need help with?', timestamp: '00:25' },
      { speaker: 'customer', text: 'Never mind, this is useless.', timestamp: '00:30' },
    ],
    metadata: { duration: '00:35', date: '2024-01-15', agentId: 'BOT-002' },
  },
];

// Default reference script
export const defaultReferenceScript = `# Customer Support Call Flow

## 1. Greeting
- Welcome the customer warmly
- Introduce yourself and the company
- Ask how you can help

## 2. Identity Verification
- Ask for account number or registered phone number
- Verify customer name
- Confirm last 4 digits of payment method (if needed)

## 3. Issue Identification
- Listen to customer's problem
- Ask clarifying questions
- Summarize the issue back to the customer

## 4. Troubleshooting / Resolution
- Follow the appropriate troubleshooting guide
- Explain each step clearly
- Check if the solution worked

## 5. Language Handling
- If customer switches language, acknowledge and switch if possible
- If unable to switch, offer to transfer to appropriate language support

## 6. Escalation (if needed)
- Acknowledge when issue is beyond scope
- Explain the escalation process
- Transfer to human agent smoothly

## 7. Closing
- Summarize what was resolved
- Ask if there's anything else
- Thank the customer
- End call professionally`;

// Default check configurations
export const defaultChecks: CheckConfig[] = [
  {
    id: 'flow_compliance',
    name: 'Flow Compliance (Script Adherence)',
    description: 'Detects where bot deviated from the reference script/flow. Only runs when reference script is enabled.',
    enabled: true,
    requiresReference: true,
    instructions: 'Check if the bot follows the expected conversation flow defined in the reference script. Flag any skipped steps, out-of-order actions, or missing verifications.',
    defaultInstructions: 'Check if the bot follows the expected conversation flow defined in the reference script. Flag any skipped steps, out-of-order actions, or missing verifications.',
  },
  {
    id: 'repetition',
    name: 'Repetition / Looping',
    description: 'Detects repeated phrases and conversation loops where the bot says the same thing multiple times.',
    enabled: true,
    requiresReference: false,
    instructions: 'Identify instances where the bot repeats the same or very similar responses multiple times. Flag loops where the bot seems stuck suggesting the same solution.',
    defaultInstructions: 'Identify instances where the bot repeats the same or very similar responses multiple times. Flag loops where the bot seems stuck suggesting the same solution.',
  },
  {
    id: 'language_alignment',
    name: 'Language Alignment',
    description: 'Detects language mismatch when customer switches to a different language but bot continues in the original language.',
    enabled: true,
    requiresReference: false,
    instructions: 'Detect when the customer switches to a different language (e.g., Hindi, Spanish) and the bot fails to acknowledge or adapt. Flag continued responses in the wrong language.',
    defaultInstructions: 'Detect when the customer switches to a different language (e.g., Hindi, Spanish) and the bot fails to acknowledge or adapt. Flag continued responses in the wrong language.',
  },
  {
    id: 'restart_reset',
    name: 'Restart / Reset Detection',
    description: 'Detects when bot suddenly starts greeting again mid-call or loses context.',
    enabled: true,
    requiresReference: false,
    instructions: 'Identify instances where the bot unexpectedly restarts the conversation, repeats the initial greeting mid-call, or appears to lose all prior context.',
    defaultInstructions: 'Identify instances where the bot unexpectedly restarts the conversation, repeats the initial greeting mid-call, or appears to lose all prior context.',
  },
  {
    id: 'general_quality',
    name: 'General Quality (Transcript-only)',
    description: 'Analyzes transcript for general quality issues and suggests improvements. No reference script or knowledge base applied.',
    enabled: true,
    requiresReference: false,
    instructions: 'Review the transcript for general quality issues: unclear responses, poor tone, missed opportunities to help, abrupt transitions, or unhelpful answers. Suggest improvements based solely on the conversation.',
    defaultInstructions: 'Review the transcript for general quality issues: unclear responses, poor tone, missed opportunities to help, abrupt transitions, or unhelpful answers. Suggest improvements based solely on the conversation.',
  },
];

// Pre-generated demo issues (simulating analysis results)
export const demoIssues: DetectedIssue[] = [
  // Call demo-001 issues
  {
    id: 'issue-001',
    callId: 'demo-001',
    type: 'flow_deviation',
    severity: 'high',
    confidence: 92,
    evidenceSnippet: 'Bot: "Please restart your router by unplugging it for 30 seconds." - Skipped identity verification step',
    lineNumbers: [4],
    explanation: 'The bot jumped directly to troubleshooting without verifying the customer\'s identity or account, violating the standard flow.',
    suggestedFix: 'Add identity verification prompt before troubleshooting',
  },
  {
    id: 'issue-002',
    callId: 'demo-001',
    type: 'repetition_loop',
    severity: 'critical',
    confidence: 98,
    evidenceSnippet: 'Bot repeatedly suggested: "restart your router" / "power cycling your router" (3 times)',
    lineNumbers: [6, 8, 10],
    explanation: 'The bot entered a loop, repeatedly suggesting the same router restart solution despite the customer stating they had already tried it multiple times.',
    suggestedFix: 'Implement solution tracking to avoid repeating already-tried fixes',
  },
  {
    id: 'issue-003',
    callId: 'demo-001',
    type: 'language_mismatch',
    severity: 'high',
    confidence: 95,
    evidenceSnippet: 'Customer: "Yeh kya ho raha hai? Mujhe Hindi mein baat karni hai." Bot: "I understand you\'re frustrated..."',
    lineNumbers: [11, 12, 13, 14],
    explanation: 'Customer switched to Hindi but the bot continued responding in English without acknowledging the language preference or offering language support.',
    suggestedFix: 'Add language detection and response in customer\'s preferred language',
  },
  {
    id: 'issue-004',
    callId: 'demo-001',
    type: 'mid_call_restart',
    severity: 'critical',
    confidence: 99,
    evidenceSnippet: 'Bot: "Hello! Welcome to TechSupport. How can I assist you today?" (mid-conversation)',
    lineNumbers: [16, 18],
    explanation: 'The bot unexpectedly restarted the conversation with an initial greeting after the customer provided their account number, indicating a context loss or reset.',
    suggestedFix: 'Implement persistent context management to prevent mid-call resets',
  },
  // Call demo-002 issues
  {
    id: 'issue-005',
    callId: 'demo-002',
    type: 'flow_deviation',
    severity: 'critical',
    confidence: 96,
    evidenceSnippet: 'Bot: "Your subscription has been cancelled." - Before any verification',
    lineNumbers: [2],
    explanation: 'Bot confirmed subscription cancellation without any identity verification, creating a security risk and violating the cancellation protocol.',
    suggestedFix: 'Require identity verification before any account modifications',
  },
  {
    id: 'issue-006',
    callId: 'demo-002',
    type: 'language_mismatch',
    severity: 'medium',
    confidence: 85,
    evidenceSnippet: 'Customer: "Mera account number 98765432 hai." Bot: "Thank you. I\'ve located your account..."',
    lineNumbers: [5, 6],
    explanation: 'Customer provided information in Hindi but bot responded in English. While the bot understood the message, it did not acknowledge or adapt to the language preference.',
    suggestedFix: 'Acknowledge language switch and respond appropriately',
  },
  // Call demo-003 issues
  {
    id: 'issue-007',
    callId: 'demo-003',
    type: 'repetition_loop',
    severity: 'high',
    confidence: 94,
    evidenceSnippet: 'Bot: "I\'d be happy to help review your bill. Let me pull up your account." (repeated 3 times)',
    lineNumbers: [2, 4, 6],
    explanation: 'Bot repeated the same response about reviewing the bill three times in quick succession, frustrating the customer.',
    suggestedFix: 'Add response tracking to prevent immediate repetition',
  },
  // Call demo-005 issues
  {
    id: 'issue-008',
    callId: 'demo-005',
    type: 'mid_call_restart',
    severity: 'critical',
    confidence: 97,
    evidenceSnippet: 'Bot: "Hello! Welcome to TechSupport..." (greeting repeated after discussing payment issue)',
    lineNumbers: [3],
    explanation: 'Bot restarted with initial greeting immediately after acknowledging a payment issue, losing all conversation context.',
    suggestedFix: 'Implement context persistence and recovery mechanisms',
  },
  // General quality issues
  {
    id: 'issue-009',
    callId: 'demo-001',
    type: 'quality_issue',
    severity: 'medium',
    confidence: 78,
    evidenceSnippet: 'Bot response tone became repetitive and unhelpful when customer expressed frustration',
    lineNumbers: [10, 12, 14],
    explanation: 'When the customer showed signs of frustration, the bot failed to adjust its approach or escalate appropriately. The responses lacked empathy and continued with the same ineffective suggestions.',
    suggestedFix: 'Add frustration detection and empathetic response patterns',
  },
  {
    id: 'issue-010',
    callId: 'demo-003',
    type: 'quality_issue',
    severity: 'low',
    confidence: 72,
    evidenceSnippet: 'Customer: "This bot is broken." - No de-escalation attempted',
    lineNumbers: [7],
    explanation: 'When customer expressed dissatisfaction with "This bot is broken", there was no attempt to de-escalate or offer human support proactively.',
    suggestedFix: 'Add sentiment-based escalation triggers',
  },
];

// Pre-generated demo fixes
export const demoScriptFixes: Fix[] = [
  {
    id: 'fix-001',
    issueType: 'flow_deviation',
    problem: 'Bot skips identity verification before troubleshooting or account changes',
    suggestion: 'Add a mandatory verification gate in the conversation flow that cannot be bypassed. The bot should always confirm customer identity before accessing account details or making changes.',
    placementHint: 'Add after greeting, before any troubleshooting or account access',
    exampleResponse: '"Before I help you with that, I\'ll need to verify your account. Could you please provide your account number or the phone number registered with us?"',
    relatedIssueIds: ['issue-001', 'issue-005'],
  },
  {
    id: 'fix-002',
    issueType: 'repetition_loop',
    problem: 'Bot repeats the same solution even after customer says they\'ve tried it',
    suggestion: 'Implement solution tracking that records what has been suggested and what the customer has already tried. The bot should acknowledge previous attempts and move to alternative solutions.',
    placementHint: 'Add to the troubleshooting logic and response generation',
    exampleResponse: '"I understand you\'ve already restarted the router. Let\'s try a different approach - can you check if other devices on your network are experiencing the same issue?"',
    relatedIssueIds: ['issue-002', 'issue-007'],
  },
  {
    id: 'fix-003',
    issueType: 'mid_call_restart',
    problem: 'Bot loses context and restarts conversation mid-call',
    suggestion: 'Implement robust context persistence with session recovery. Add conversation state tracking that survives temporary disconnections or processing errors.',
    placementHint: 'Add at the session management and state handling layer',
    exampleResponse: '"I apologize for the brief interruption. To continue helping you with [previous topic], I have your account number ending in [last 4 digits]. Where were we?"',
    relatedIssueIds: ['issue-004', 'issue-008'],
  },
];

export const demoGeneralFixes: Fix[] = [
  {
    id: 'fix-004',
    issueType: 'language_mismatch',
    problem: 'Bot continues in English when customer switches to Hindi or another language',
    suggestion: 'Add language detection for customer messages and implement multi-language response capability. If the bot cannot respond in the detected language, it should acknowledge the preference and offer to transfer to appropriate support.',
    placementHint: 'Add to message processing and response generation',
    exampleResponse: '"Main samajh sakta hoon aap Hindi mein baat karna chahte hain. Main aapki Hindi mein madad karunga." OR "I noticed you\'d prefer to speak in Hindi. Let me connect you with our Hindi-speaking support team."',
    relatedIssueIds: ['issue-003', 'issue-006'],
  },
  {
    id: 'fix-005',
    issueType: 'quality_issue',
    problem: 'Bot fails to detect and respond appropriately to customer frustration',
    suggestion: 'Implement sentiment analysis to detect frustration, anger, or dissatisfaction. When negative sentiment is detected, adjust response tone to be more empathetic and proactively offer escalation to human support.',
    placementHint: 'Add to sentiment analysis and response selection logic',
    exampleResponse: '"I can hear that this has been frustrating for you, and I\'m truly sorry for the experience. Let me either try a completely different approach, or I can connect you with a specialist who may be able to help more quickly. What would you prefer?"',
    relatedIssueIds: ['issue-009', 'issue-010'],
  },
  {
    id: 'fix-006',
    issueType: 'quality_issue',
    problem: 'Bot responses lack personalization and feel robotic',
    suggestion: 'Add contextual personalization by referencing previous customer statements, using their name when known, and varying response patterns to feel more natural.',
    placementHint: 'Add throughout response generation templates',
    exampleResponse: 'Instead of: "I understand. Let me help with that." Use: "I understand the internet dropping for two days must be really inconvenient, especially if you work from home. Let\'s get this sorted out for you."',
    relatedIssueIds: ['issue-009'],
  },
];

// CSV format demo data string
export const demoCSVContent = `call_id,timestamp,speaker,text,language
demo-001,00:00,bot,"Hello! Welcome to TechSupport. How can I assist you today?",en
demo-001,00:05,customer,"Hi, I need help with my internet connection. It keeps dropping.",en
demo-001,00:10,bot,"I understand you're having connectivity issues. Let me help you troubleshoot that.",en
demo-001,00:15,customer,"Yes please, it's been happening for two days now.",en
demo-001,00:20,bot,"Please restart your router by unplugging it for 30 seconds.",en
demo-001,00:25,customer,"I already tried that three times.",en
demo-001,00:30,bot,"I see. Have you tried restarting your router?",en
demo-001,00:35,customer,"Yes, I just told you I did that already.",en
demo-001,00:40,bot,"I understand. Let me suggest restarting your router by unplugging it for 30 seconds.",en
demo-001,00:45,customer,"Are you even listening? I said I already restarted it multiple times!",en
demo-001,00:50,bot,"I apologize for the confusion. Have you tried power cycling your router?",en
demo-001,00:55,customer,"Yeh kya ho raha hai? Mujhe Hindi mein baat karni hai.",hi
demo-001,01:00,bot,"I understand you're frustrated. Let me check your account details.",en
demo-001,01:05,customer,"Main Hindi mein baat kar raha hoon, aap English mein kyun jawab de rahe ho?",hi
demo-001,01:10,bot,"Could you please provide your account number so I can look into this further?",en
demo-001,01:15,customer,"Fine, my account number is 12345678.",en
demo-001,01:20,bot,"Hello! Welcome to TechSupport. How can I assist you today?",en
demo-001,01:25,customer,"What? We were already talking! Why are you greeting me again?",en
demo-001,01:30,bot,"I apologize for any confusion. How may I help you today?",en
demo-001,01:35,customer,"This is ridiculous. I want to speak to a human.",en
demo-001,01:40,bot,"I understand your frustration. Let me transfer you to a human agent. Please hold.",en
demo-002,00:00,bot,"Hello! Welcome to TechSupport. How can I assist you today?",en
demo-002,00:05,customer,"I want to cancel my subscription.",en
demo-002,00:10,bot,"I'm sorry to hear that. Your subscription has been cancelled.",en
demo-002,00:15,customer,"Wait, don't you need to verify my identity first?",en
demo-002,00:20,bot,"You're right, I apologize. Can I have your account number?",en
demo-002,00:25,customer,"Mera account number 98765432 hai.",hi
demo-002,00:30,bot,"Thank you. I've located your account. Are you sure you want to cancel?",en
demo-003,00:00,bot,"Hello! Welcome to TechSupport. How can I assist you today?",en
demo-003,00:05,customer,"My bill seems too high this month.",en
demo-003,00:10,bot,"I'd be happy to help review your bill. Let me pull up your account.",en
demo-003,00:15,customer,"Sure, take your time.",en
demo-003,00:20,bot,"I'd be happy to help review your bill. Let me pull up your account.",en
demo-003,00:25,customer,"You just said that...",en
demo-003,00:30,bot,"I apologize. I'd be happy to help review your bill.",en
demo-003,00:35,customer,"This bot is broken.",en
demo-004,00:00,bot,"Hello! Welcome to TechSupport. How can I assist you today?",en
demo-004,00:05,customer,"I need to update my address.",en
demo-004,00:10,bot,"Of course! I can help you with that. What is your new address?",en
demo-004,00:15,customer,"123 Main Street, Apt 4B, New York, NY 10001",en
demo-004,00:20,bot,"Thank you. I've updated your address to 123 Main Street, Apt 4B, New York, NY 10001.",en
demo-004,00:25,customer,"Great, thanks!",en
demo-004,00:30,bot,"You're welcome! Is there anything else I can help you with?",en
demo-004,00:35,customer,"No, that's all. Thanks!",en
demo-004,00:40,bot,"Thank you for contacting TechSupport. Have a great day!",en
demo-005,00:00,bot,"Hello! Welcome to TechSupport. How can I assist you today?",en
demo-005,00:05,customer,"My payment didn't go through.",en
demo-005,00:10,bot,"I'm sorry to hear about the payment issue. Let me check that for you.",en
demo-005,00:15,bot,"Hello! Welcome to TechSupport. How can I assist you today?",en
demo-005,00:20,customer,"Uhh what? We were just talking about my payment.",en
demo-005,00:25,bot,"I apologize for the confusion. Could you tell me what you need help with?",en
demo-005,00:30,customer,"Never mind, this is useless.",en`;
