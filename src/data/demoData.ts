import { Transcript, CheckConfig, DetectedIssue, Fix } from '@/types';

// Demo transcript with all 4 error types
export const demoTranscript: Transcript = {
  id: 'demo-001',
  lines: [
    // Normal start
    { speaker: 'agent', text: 'Hello! Welcome to TechSupport. How can I assist you today?', timestamp: '00:00' },
    { speaker: 'customer', text: 'Hi, I need help with my internet connection. It keeps dropping.', timestamp: '00:05' },
    { speaker: 'agent', text: 'I understand you\'re having connectivity issues. Let me help you troubleshoot that.', timestamp: '00:10' },
    { speaker: 'customer', text: 'Yes please, it\'s been happening for two days now.', timestamp: '00:15' },

    // Flow deviation - Bot skips verification step, jumps directly to solution
    { speaker: 'agent', text: 'Please restart your router by unplugging it for 30 seconds.', timestamp: '00:20' },
    { speaker: 'customer', text: 'I already tried that three times.', timestamp: '00:25' },

    // Repetition loop starts
    { speaker: 'agent', text: 'I see. Have you tried restarting your router?', timestamp: '00:30' },
    { speaker: 'customer', text: 'Yes, I just told you I did that already.', timestamp: '00:35' },
    { speaker: 'agent', text: 'I understand. Let me suggest restarting your router by unplugging it for 30 seconds.', timestamp: '00:40' },
    { speaker: 'customer', text: 'Are you even listening? I said I already restarted it multiple times!', timestamp: '00:45' },
    { speaker: 'agent', text: 'I apologize for the confusion. Have you tried power cycling your router?', timestamp: '00:50' },

    // Customer switches to Hindi - Language mismatch
    { speaker: 'customer', text: 'Yeh kya ho raha hai? Mujhe Hindi mein baat karni hai.', timestamp: '00:55', language: 'hi' },
    { speaker: 'agent', text: 'I understand you\'re frustrated. Let me check your account details.', timestamp: '01:00' },
    { speaker: 'customer', text: 'Main Hindi mein baat kar raha hoon, aap English mein kyun jawab de rahe ho?', timestamp: '01:05', language: 'hi' },
    { speaker: 'agent', text: 'Could you please provide your account number so I can look into this further?', timestamp: '01:10' },

    // Mid-call restart/reset
    { speaker: 'customer', text: 'Fine, my account number is 12345678.', timestamp: '01:15' },
    { speaker: 'agent', text: 'Hello! Welcome to TechSupport. How can I assist you today?', timestamp: '01:20' },
    { speaker: 'customer', text: 'What? We were already talking! Why are you greeting me again?', timestamp: '01:25' },
    { speaker: 'agent', text: 'I apologize for any confusion. How may I help you today?', timestamp: '01:30' },

    // Attempt to recover
    { speaker: 'customer', text: 'This is ridiculous. I want to speak to a human.', timestamp: '01:35' },
    { speaker: 'agent', text: 'I understand your frustration. Let me transfer you to a human agent. Please hold.', timestamp: '01:40' },
  ],
  metadata: {
    duration: '01:45',
    date: '2024-01-15',
    agentId: 'AGENT-001',
  },
};

// Additional demo transcripts for CSV batch testing
export const demoBatchTranscripts: Transcript[] = [
  demoTranscript,
  {
    id: 'demo-002',
    lines: [
      { speaker: 'agent', text: 'Hello! Welcome to TechSupport. How can I assist you today?', timestamp: '00:00' },
      { speaker: 'customer', text: 'I want to cancel my subscription.', timestamp: '00:05' },
      // Flow deviation - Doesn't follow cancellation protocol
      { speaker: 'agent', text: 'I\'m sorry to hear that. Your subscription has been cancelled.', timestamp: '00:10' },
      { speaker: 'customer', text: 'Wait, don\'t you need to verify my identity first?', timestamp: '00:15' },
      { speaker: 'agent', text: 'You\'re right, I apologize. Can I have your account number?', timestamp: '00:20' },
      // Language switch
      { speaker: 'customer', text: 'Mera account number 98765432 hai.', timestamp: '00:25', language: 'hi' },
      { speaker: 'agent', text: 'Thank you. I\'ve located your account. Are you sure you want to cancel?', timestamp: '00:30' },
    ],
    metadata: { duration: '00:35', date: '2024-01-15', agentId: 'AGENT-002' },
  },
  {
    id: 'demo-003',
    lines: [
      { speaker: 'agent', text: 'Hello! Welcome to TechSupport. How can I assist you today?', timestamp: '00:00' },
      { speaker: 'customer', text: 'My bill seems too high this month.', timestamp: '00:05' },
      { speaker: 'agent', text: 'I\'d be happy to help review your bill. Let me pull up your account.', timestamp: '00:10' },
      { speaker: 'customer', text: 'Sure, take your time.', timestamp: '00:15' },
      // Repetition
      { speaker: 'agent', text: 'I\'d be happy to help review your bill. Let me pull up your account.', timestamp: '00:20' },
      { speaker: 'customer', text: 'You just said that...', timestamp: '00:25' },
      { speaker: 'agent', text: 'I apologize. I\'d be happy to help review your bill.', timestamp: '00:30' },
      { speaker: 'customer', text: 'This bot is broken.', timestamp: '00:35' },
    ],
    metadata: { duration: '00:40', date: '2024-01-15', agentId: 'AGENT-001' },
  },
  {
    id: 'demo-004',
    lines: [
      { speaker: 'agent', text: 'Hello! Welcome to TechSupport. How can I assist you today?', timestamp: '00:00' },
      { speaker: 'customer', text: 'I need to update my address.', timestamp: '00:05' },
      { speaker: 'agent', text: 'Of course! I can help you with that. What is your new address?', timestamp: '00:10' },
      { speaker: 'customer', text: '123 Main Street, Apt 4B, New York, NY 10001', timestamp: '00:15' },
      { speaker: 'agent', text: 'Thank you. I\'ve updated your address to 123 Main Street, Apt 4B, New York, NY 10001.', timestamp: '00:20' },
      { speaker: 'customer', text: 'Great, thanks!', timestamp: '00:25' },
      { speaker: 'agent', text: 'You\'re welcome! Is there anything else I can help you with?', timestamp: '00:30' },
      { speaker: 'customer', text: 'No, that\'s all. Thanks!', timestamp: '00:35' },
      { speaker: 'agent', text: 'Thank you for contacting TechSupport. Have a great day!', timestamp: '00:40' },
    ],
    metadata: { duration: '00:45', date: '2024-01-15', agentId: 'AGENT-003' },
  },
  {
    id: 'demo-005',
    lines: [
      { speaker: 'agent', text: 'Hello! Welcome to TechSupport. How can I assist you today?', timestamp: '00:00' },
      { speaker: 'customer', text: 'My payment didn\'t go through.', timestamp: '00:05' },
      { speaker: 'agent', text: 'I\'m sorry to hear about the payment issue. Let me check that for you.', timestamp: '00:10' },
      // Mid-call restart
      { speaker: 'agent', text: 'Hello! Welcome to TechSupport. How can I assist you today?', timestamp: '00:15' },
      { speaker: 'customer', text: 'Uhh what? We were just talking about my payment.', timestamp: '00:20' },
      { speaker: 'agent', text: 'I apologize for the confusion. Could you tell me what you need help with?', timestamp: '00:25' },
      { speaker: 'customer', text: 'Never mind, this is useless.', timestamp: '00:30' },
    ],
    metadata: { duration: '00:35', date: '2024-01-15', agentId: 'AGENT-002' },
  },
];

// Default reference script
export const defaultReferenceScript = `# TechSupport Customer Service Call Flow

## 1. Greeting & Introduction (Required First Step)
Bot should say:
"Hello! Welcome to TechSupport. My name is [Bot Name]. How can I assist you today?"

Key Requirements:
- Always start with a warm greeting
- Mention company name (TechSupport)
- Use professional and friendly tone
- Wait for customer to describe their issue

## 2. Identity Verification (Required Before Any Account Actions)
IMPORTANT: MUST verify identity before accessing account information, making changes, or processing cancellations.

Verification Steps:
a) Request account number or registered phone number
   "To help you with this, I'll need to verify your account. Could you please provide your account number or the phone number registered with your account?"

b) Verify customer name
   "Thank you. Can you please confirm the name on the account?"

c) For sensitive actions (cancellations, payments, address changes):
   "For security purposes, can you confirm the last 4 digits of your payment method on file?"

⚠️ NEVER skip verification - This is a critical compliance requirement

## 3. Issue Identification & Active Listening
- Listen carefully to customer's problem without interrupting
- Take note of key details mentioned by customer
- Ask clarifying questions to understand the full context
- Summarize the issue back to confirm understanding:
  "Just to confirm, you're experiencing [issue summary]. Is that correct?"

Important: Track what customer has ALREADY TRIED to avoid suggesting the same solutions

## 4. Troubleshooting & Resolution
Follow systematic troubleshooting:
- Start with the most relevant solution based on the issue
- BEFORE suggesting a solution, ask: "Have you already tried [solution]?"
- Explain each step clearly with simple language
- Give customer time to complete each step
- Confirm if each step worked before moving to next

Common Issues:
- Internet connectivity: Check router status → Restart router → Check cables → Check service status
- Billing inquiries: Review account → Explain charges → Offer payment plan if needed
- Account changes: Verify identity → Make requested changes → Confirm changes with customer

⚠️ NEVER repeat the same suggestion if customer says they already tried it

## 5. Language Handling & Multilingual Support
When customer switches to a different language:
1. Acknowledge the language switch immediately
2. If bot supports that language, respond in that language:
   "I understand you'd prefer to speak in [language]. I can help you in [language]."
3. If bot does NOT support that language:
   "I apologize, I notice you're speaking [language]. While I don't speak [language] fluently, I can transfer you to a representative who does. Would that be helpful?"

⚠️ NEVER ignore language switches or continue only in English when customer clearly switched languages

## 6. Context Maintenance & Memory
Throughout the conversation:
- Remember what customer has told you (their issue, what they've tried, their account details)
- Reference previous parts of the conversation naturally
- NEVER ask for information customer already provided
- NEVER restart the conversation or re-greet mid-call
- Keep track of conversation history and build on it

⚠️ WARNING: If you lose context or restart, this is a CRITICAL FAILURE

## 7. Escalation (When Needed)
Escalate to human agent when:
- Issue is beyond bot's capability to resolve
- Customer explicitly requests human support
- Customer is frustrated after 2-3 failed attempts
- Technical issue requires specialized knowledge

Escalation Script:
"I understand this issue requires additional expertise. Let me transfer you to one of our specialized agents who can help you further. They'll have full context of our conversation. Please hold for just a moment."

## 8. Closing & Wrap-up
Before ending the call:
1. Summarize what was accomplished:
   "To recap, we've [summary of actions taken]"
2. Confirm issue is resolved:
   "Does this resolve your issue, or is there anything else I can help you with today?"
3. Offer additional help:
   "Is there anything else I can assist you with?"
4. Thank customer professionally:
   "Thank you for contacting TechSupport. Have a great day!"

⚠️ NEVER end the call abruptly without proper closing

---

## Critical Rules Summary:
1. ✓ Always start with greeting, NEVER re-greet mid-call
2. ✓ MUST verify identity before account actions
3. ✓ Track what customer already tried, NEVER repeat suggestions
4. ✓ Acknowledge and adapt to language switches
5. ✓ Maintain context throughout entire conversation
6. ✓ Escalate when appropriate, don't keep customer stuck
7. ✓ Close professionally with summary`;

// Default check configurations
export const defaultChecks: CheckConfig[] = [
  {
    id: 'flow_compliance',
    name: 'Flow Compliance (Script Adherence)',
    description: 'Detects where bot deviated from the reference script/flow. Only runs when reference script is enabled.',
    enabled: true,
    requiresReference: true,
    instructions: `Analyze if the bot follows the expected conversation flow defined in the reference script. Pay special attention to:

CRITICAL VIOLATIONS (High/Critical Severity):
- Skipping identity verification before account actions (e.g., cancellations, account changes, viewing account info)
- Jumping directly to solutions without understanding the problem
- Missing required steps in order (greeting → verification → issue identification → resolution)
- Making account changes without proper verification

MODERATE VIOLATIONS (Medium Severity):
- Out-of-order execution of non-critical steps
- Skipping optional but recommended steps (like summarizing the issue back to customer)
- Missing closing/wrap-up steps
- Not asking clarifying questions when issue is unclear

MINOR VIOLATIONS (Low Severity):
- Slight deviations in wording while maintaining intent
- Skipping non-essential pleasantries
- Different order for non-sequential steps

For each violation found, specify:
1. Which step was skipped or done out of order
2. Where in the reference script this step is defined
3. Why this matters (impact on customer experience or compliance)
4. Line numbers where this occurred

Example: "Bot jumped directly to suggesting router restart without first verifying customer's identity or asking what troubleshooting steps they've already tried. This violates the required Identity Verification (Step 2) and Issue Identification (Step 3) from the reference script."`,
    defaultInstructions: `Analyze if the bot follows the expected conversation flow defined in the reference script. Pay special attention to:

CRITICAL VIOLATIONS (High/Critical Severity):
- Skipping identity verification before account actions (e.g., cancellations, account changes, viewing account info)
- Jumping directly to solutions without understanding the problem
- Missing required steps in order (greeting → verification → issue identification → resolution)
- Making account changes without proper verification

MODERATE VIOLATIONS (Medium Severity):
- Out-of-order execution of non-critical steps
- Skipping optional but recommended steps (like summarizing the issue back to customer)
- Missing closing/wrap-up steps
- Not asking clarifying questions when issue is unclear

MINOR VIOLATIONS (Low Severity):
- Slight deviations in wording while maintaining intent
- Skipping non-essential pleasantries
- Different order for non-sequential steps

For each violation found, specify:
1. Which step was skipped or done out of order
2. Where in the reference script this step is defined
3. Why this matters (impact on customer experience or compliance)
4. Line numbers where this occurred

Example: "Bot jumped directly to suggesting router restart without first verifying customer's identity or asking what troubleshooting steps they've already tried. This violates the required Identity Verification (Step 2) and Issue Identification (Step 3) from the reference script."`,
  },
  {
    id: 'repetition',
    name: 'Repetition / Looping',
    description: 'Detects repeated phrases and conversation loops where the bot says the same thing multiple times.',
    enabled: true,
    requiresReference: false,
    instructions: `Detect instances where the bot repeats itself or gets stuck in loops. Look for:

CRITICAL LOOPS (High/Critical Severity):
- Bot suggests the exact same solution 3+ times after customer says they already tried it
- Bot asks the same question multiple times in a row
- Bot gives the same response word-for-word within a short timespan (3-5 exchanges)
- Customer explicitly points out the repetition (e.g., "You just said that", "I already told you")

MODERATE REPETITION (Medium Severity):
- Bot suggests the same solution 2 times after customer mentions trying it
- Bot uses the exact same phrasing for different questions (copy-paste responses)
- Bot repeats pleasantries or acknowledgments excessively (e.g., "I understand" 4+ times in a row)
- Semantic repetition: saying the same thing in slightly different words without adding value

LOW-LEVEL REPETITION (Low Severity):
- Normal confirmation phrases used appropriately (e.g., "I understand" once or twice)
- Legitimate restatement for clarity (e.g., summarizing customer's issue)
- Standard call flow phrases that are meant to be consistent (greetings, closings)

Key Indicators:
1. Customer says "I already tried that" or "You just said that" → Strong signal
2. Same keywords/phrases appear in multiple consecutive bot messages
3. Bot ignores customer's feedback about already trying something
4. Conversation doesn't progress - same topic discussed in circles

For each repetition issue found:
- Quote the repeated text from all instances
- Count how many times it was repeated
- Note if customer expressed frustration about the repetition
- Explain why this creates a poor experience

Example: "Bot suggested 'restart your router' three times (lines 5, 7, 9) even after customer explicitly said 'I already tried that three times' (line 6). This shows the bot is not tracking conversation context or listening to customer feedback."`,
    defaultInstructions: `Detect instances where the bot repeats itself or gets stuck in loops. Look for:

CRITICAL LOOPS (High/Critical Severity):
- Bot suggests the exact same solution 3+ times after customer says they already tried it
- Bot asks the same question multiple times in a row
- Bot gives the same response word-for-word within a short timespan (3-5 exchanges)
- Customer explicitly points out the repetition (e.g., "You just said that", "I already told you")

MODERATE REPETITION (Medium Severity):
- Bot suggests the same solution 2 times after customer mentions trying it
- Bot uses the exact same phrasing for different questions (copy-paste responses)
- Bot repeats pleasantries or acknowledgments excessively (e.g., "I understand" 4+ times in a row)
- Semantic repetition: saying the same thing in slightly different words without adding value

LOW-LEVEL REPETITION (Low Severity):
- Normal confirmation phrases used appropriately (e.g., "I understand" once or twice)
- Legitimate restatement for clarity (e.g., summarizing customer's issue)
- Standard call flow phrases that are meant to be consistent (greetings, closings)

Key Indicators:
1. Customer says "I already tried that" or "You just said that" → Strong signal
2. Same keywords/phrases appear in multiple consecutive bot messages
3. Bot ignores customer's feedback about already trying something
4. Conversation doesn't progress - same topic discussed in circles

For each repetition issue found:
- Quote the repeated text from all instances
- Count how many times it was repeated
- Note if customer expressed frustration about the repetition
- Explain why this creates a poor experience

Example: "Bot suggested 'restart your router' three times (lines 5, 7, 9) even after customer explicitly said 'I already tried that three times' (line 6). This shows the bot is not tracking conversation context or listening to customer feedback."`,
  },
  {
    id: 'language_alignment',
    name: 'Language Alignment',
    description: 'Detects language mismatch when customer switches to a different language but bot continues in the original language.',
    enabled: true,
    requiresReference: false,
    instructions: `Detect language misalignment where customer switches languages but bot fails to acknowledge or adapt. Analyze:

CRITICAL MISALIGNMENT (High/Critical Severity):
- Customer switches to a different language (Hindi, Spanish, etc.) for 2+ consecutive messages
- Bot completely ignores the language switch and continues in original language (usually English)
- Customer explicitly asks to speak in their language (e.g., "Can we speak in Hindi?", "Quiero hablar en español")
- Bot proceeds with important account actions while customer is communicating in a different language

Common Language Switches to Detect:
- Hindi: Words like "main", "mujhe", "kya", "hai", "mein", "hoon", "kyun"
- Spanish: "Quiero", "necesito", "hablar", "español", "por favor"
- French: "Je", "parler", "français", "s'il vous plaît"
- Any non-English phrases or sentences

MODERATE MISALIGNMENT (Medium Severity):
- Customer uses 1-2 words in another language but bot doesn't acknowledge
- Bot asks customer to repeat in English without offering language support
- Delayed acknowledgment (bot ignores first language switch, only responds after 2nd)

WHAT IS NOT AN ISSUE (Don't Flag):
- Customer uses occasional foreign words within English sentences (code-switching)
- Bot appropriately offers language support or transfer
- Bot successfully switches to customer's preferred language
- Single non-English word that's part of a name or technical term

Bot Should Respond With (when language switch detected):
1. Acknowledge the language switch immediately
2. Either:
   a) "I understand you'd prefer to speak in [language]. I can help you in [language]." (if bot supports it)
   OR
   b) "I notice you're speaking [language]. While I primarily speak English, I can transfer you to a [language]-speaking representative. Would that help?"

For each language misalignment found:
- Identify the language customer switched to
- Quote the customer messages in that language with line numbers
- Count how many messages bot ignored the language switch
- Note if customer expressed frustration about language barrier
- Specify what bot should have done instead

Example: "Customer switched to Hindi at line 12 ('Yeh kya ho raha hai? Mujhe Hindi mein baat karni hai.') and continued in Hindi at line 14 ('Main Hindi mein baat kar raha hoon...'). Bot ignored both messages and continued responding only in English (lines 13, 15). Bot should have acknowledged the language preference and either switched to Hindi or offered to transfer to a Hindi-speaking agent."`,
    defaultInstructions: `Detect language misalignment where customer switches languages but bot fails to acknowledge or adapt. Analyze:

CRITICAL MISALIGNMENT (High/Critical Severity):
- Customer switches to a different language (Hindi, Spanish, etc.) for 2+ consecutive messages
- Bot completely ignores the language switch and continues in original language (usually English)
- Customer explicitly asks to speak in their language (e.g., "Can we speak in Hindi?", "Quiero hablar en español")
- Bot proceeds with important account actions while customer is communicating in a different language

Common Language Switches to Detect:
- Hindi: Words like "main", "mujhe", "kya", "hai", "mein", "hoon", "kyun"
- Spanish: "Quiero", "necesito", "hablar", "español", "por favor"
- French: "Je", "parler", "français", "s'il vous plaît"
- Any non-English phrases or sentences

MODERATE MISALIGNMENT (Medium Severity):
- Customer uses 1-2 words in another language but bot doesn't acknowledge
- Bot asks customer to repeat in English without offering language support
- Delayed acknowledgment (bot ignores first language switch, only responds after 2nd)

WHAT IS NOT AN ISSUE (Don't Flag):
- Customer uses occasional foreign words within English sentences (code-switching)
- Bot appropriately offers language support or transfer
- Bot successfully switches to customer's preferred language
- Single non-English word that's part of a name or technical term

Bot Should Respond With (when language switch detected):
1. Acknowledge the language switch immediately
2. Either:
   a) "I understand you'd prefer to speak in [language]. I can help you in [language]." (if bot supports it)
   OR
   b) "I notice you're speaking [language]. While I primarily speak English, I can transfer you to a [language]-speaking representative. Would that help?"

For each language misalignment found:
- Identify the language customer switched to
- Quote the customer messages in that language with line numbers
- Count how many messages bot ignored the language switch
- Note if customer expressed frustration about language barrier
- Specify what bot should have done instead

Example: "Customer switched to Hindi at line 12 ('Yeh kya ho raha hai? Mujhe Hindi mein baat karni hai.') and continued in Hindi at line 14 ('Main Hindi mein baat kar raha hoon...'). Bot ignored both messages and continued responding only in English (lines 13, 15). Bot should have acknowledged the language preference and either switched to Hindi or offered to transfer to a Hindi-speaking agent."`,
  },
  {
    id: 'restart_reset',
    name: 'Restart / Reset Detection',
    description: 'Detects when bot suddenly starts greeting again mid-call or loses context.',
    enabled: true,
    requiresReference: false,
    instructions: `Detect instances where the bot loses context, restarts the conversation, or behaves as if the conversation just started. Look for:

CRITICAL CONTEXT LOSS (Critical Severity):
- Bot repeats the initial greeting ("Hello! Welcome to [company]") in the middle of an ongoing conversation
- Bot asks "How can I help you?" after customer already explained their problem and conversation was in progress
- Bot forgets information customer already provided (account number, issue description, name) and asks for it again
- Bot starts verification process from scratch after customer was already verified
- Customer explicitly calls out the restart (e.g., "What? We were already talking!", "Why are you greeting me again?")

SEVERE CONTEXT LOSS (High Severity):
- Bot acts like conversation is starting fresh after several exchanges
- Bot loses track of what troubleshooting steps were already attempted
- Bot suggests solutions that were already tried and failed (but not due to repetition - due to forgetting)
- Bot asks customer to re-explain their issue after it was already discussed in detail

MODERATE CONTEXT LOSS (Medium Severity):
- Bot forgets specific details mentioned earlier but maintains general conversation flow
- Bot references wrong information from earlier in the conversation
- Bot shows inconsistent knowledge of customer's situation
- Conversation flow feels disjointed or disconnected from previous exchanges

Signals of Context Loss:
1. Greeting phrases appearing mid-call: "Hello", "Welcome to", "How can I help you today?"
2. Re-asking for information already provided: account number, name, issue description
3. Restarting verification or identification steps
4. Customer confusion: "We were just talking about...", "I already told you..."
5. Abrupt topic change that ignores previous context
6. Bot responses that don't relate to immediately preceding customer messages

WHAT IS NOT A CONTEXT LOSS (Don't Flag):
- Bot asking follow-up clarifying questions
- Bot confirming information for security/accuracy
- Bot naturally transitioning to next phase of conversation
- Bot summarizing previous discussion (this shows good context retention)

For each restart/reset issue found:
- Identify the exact line where context was lost or restart occurred
- Quote the bot message that indicates restart (e.g., re-greeting, re-asking)
- Reference what context should have been maintained
- Explain the impact on customer experience
- Note customer's reaction if they pointed it out

Example: "At line 15, bot suddenly says 'Hello! Welcome to TechSupport. How can I assist you today?' This is a full restart mid-call - customer had already explained their payment issue at line 2, provided account number at line 10, and the conversation was well underway. Customer rightfully questions this at line 16: 'What? We were already talking! Why are you greeting me again?' This represents a critical failure in context maintenance."`,
    defaultInstructions: `Detect instances where the bot loses context, restarts the conversation, or behaves as if the conversation just started. Look for:

CRITICAL CONTEXT LOSS (Critical Severity):
- Bot repeats the initial greeting ("Hello! Welcome to [company]") in the middle of an ongoing conversation
- Bot asks "How can I help you?" after customer already explained their problem and conversation was in progress
- Bot forgets information customer already provided (account number, issue description, name) and asks for it again
- Bot starts verification process from scratch after customer was already verified
- Customer explicitly calls out the restart (e.g., "What? We were already talking!", "Why are you greeting me again?")

SEVERE CONTEXT LOSS (High Severity):
- Bot acts like conversation is starting fresh after several exchanges
- Bot loses track of what troubleshooting steps were already attempted
- Bot suggests solutions that were already tried and failed (but not due to repetition - due to forgetting)
- Bot asks customer to re-explain their issue after it was already discussed in detail

MODERATE CONTEXT LOSS (Medium Severity):
- Bot forgets specific details mentioned earlier but maintains general conversation flow
- Bot references wrong information from earlier in the conversation
- Bot shows inconsistent knowledge of customer's situation
- Conversation flow feels disjointed or disconnected from previous exchanges

Signals of Context Loss:
1. Greeting phrases appearing mid-call: "Hello", "Welcome to", "How can I help you today?"
2. Re-asking for information already provided: account number, name, issue description
3. Restarting verification or identification steps
4. Customer confusion: "We were just talking about...", "I already told you..."
5. Abrupt topic change that ignores previous context
6. Bot responses that don't relate to immediately preceding customer messages

WHAT IS NOT A CONTEXT LOSS (Don't Flag):
- Bot asking follow-up clarifying questions
- Bot confirming information for security/accuracy
- Bot naturally transitioning to next phase of conversation
- Bot summarizing previous discussion (this shows good context retention)

For each restart/reset issue found:
- Identify the exact line where context was lost or restart occurred
- Quote the bot message that indicates restart (e.g., re-greeting, re-asking)
- Reference what context should have been maintained
- Explain the impact on customer experience
- Note customer's reaction if they pointed it out

Example: "At line 15, bot suddenly says 'Hello! Welcome to TechSupport. How can I assist you today?' This is a full restart mid-call - customer had already explained their payment issue at line 2, provided account number at line 10, and the conversation was well underway. Customer rightfully questions this at line 16: 'What? We were already talking! Why are you greeting me again?' This represents a critical failure in context maintenance."`,
  },
  {
    id: 'general_quality',
    name: 'General Quality (Transcript-only)',
    description: 'Analyzes transcript for general quality issues and suggests improvements. No reference script or knowledge base applied.',
    enabled: true,
    requiresReference: false,
    instructions: `Analyze the overall conversation quality based solely on the transcript, regardless of any reference script. Evaluate multiple quality dimensions:

1. EMPATHY & TONE (Critical for Customer Satisfaction)

   Good Signs:
   - Bot acknowledges customer frustration: "I understand this must be frustrating..."
   - Uses warm, professional language
   - Shows patience when customer is upset
   - Validates customer concerns before jumping to solutions

   Quality Issues to Flag:
   - Robotic, cold, or impersonal responses
   - Dismissive tone when customer expresses frustration
   - Overly formal language that feels distant
   - Lack of acknowledgment when customer is clearly upset
   - Tone-deaf responses (e.g., cheerful when customer is angry)

   Example Issue: "Customer expressed frustration multiple times ('This is ridiculous', 'Are you even listening?') but bot never acknowledged their emotional state or apologized for the poor experience."

2. ACTIVE LISTENING & COMPREHENSION

   Good Signs:
   - Bot references specific details customer mentioned
   - Bot asks relevant follow-up questions
   - Bot summarizes customer's issue to confirm understanding
   - Bot builds on previous exchanges naturally

   Quality Issues to Flag:
   - Bot ignores important information customer provides
   - Bot asks questions that were already answered
   - Bot provides irrelevant solutions that don't match the issue
   - Bot fails to acknowledge customer's stated concerns
   - Responses feel generic rather than tailored to this specific customer

   Example Issue: "Customer stated 'I already tried that three times' (line 6) but bot completely ignored this and suggested the same solution again without acknowledgment."

3. CLARITY & HELPFULNESS

   Good Signs:
   - Instructions are clear and step-by-step
   - Bot explains technical terms when needed
   - Bot checks if customer understood before moving on
   - Solutions are relevant and actionable

   Quality Issues to Flag:
   - Vague or unclear instructions
   - Technical jargon without explanation
   - Assumed knowledge customer may not have
   - Incomplete solutions or half-answers
   - Bot moves on without confirming customer could follow steps

   Example Issue: "Bot said 'Please restart your router' but didn't explain how to do this or how long to wait, leaving customer without clear guidance."

4. PROBLEM RESOLUTION APPROACH

   Good Signs:
   - Systematic troubleshooting (not random guesses)
   - Bot asks what was already tried before suggesting solutions
   - Bot escalates appropriately when stuck
   - Bot stays focused on resolving the actual issue

   Quality Issues to Flag:
   - Bot suggests random solutions without logical order
   - Bot keeps trying same approach when it's clearly not working
   - Bot never offers escalation even when customer is frustrated and nothing is working
   - Bot ignores the actual problem and focuses on something else
   - Bot gives up too easily or escalates too quickly without trying to help

   Example Issue: "After three failed attempts to resolve the issue, bot never offered to escalate to a human agent despite customer expressing frustration."

5. CONVERSATIONAL FLOW & TRANSITIONS

   Good Signs:
   - Smooth transitions between topics
   - Natural conversation progression
   - Clear signposting ("Now let's...", "Next, I'll...")
   - Logical sequence of questions and actions

   Quality Issues to Flag:
   - Abrupt topic changes without explanation
   - Disjointed conversation that jumps around
   - Awkward or confusing transitions
   - Missing connective phrases that guide the conversation

   Example Issue: "Bot abruptly switched from troubleshooting to asking for account number without explaining why or transitioning smoothly (line 12)."

6. MISSED OPPORTUNITIES

   Quality Issues to Flag:
   - Bot could have shown more empathy at key moments
   - Bot could have proactively offered related help
   - Bot could have educated customer about preventing similar issues
   - Bot could have checked customer satisfaction before closing
   - Bot could have offered alternative solutions when first approach failed

   Example Issue: "Customer mentioned frustration with this being a recurring issue, but bot only addressed the immediate problem without offering to investigate why it keeps happening or how to prevent it."

7. PROFESSIONALISM & ETIQUETTE

   Quality Issues to Flag:
   - Missing pleasantries (thank you, please)
   - Interrupting customer's thought
   - Not apologizing when bot made errors
   - Ending call without proper closing
   - Overly casual or too stiff language

   Example Issue: "Bot never apologized for the confusion it caused with repetitive suggestions, showing lack of accountability."

SEVERITY GUIDELINES:
- Critical: Issues that would make most customers very upset or harm company reputation
- High: Issues that significantly degrade customer experience or show poor service
- Medium: Issues that could be improved but conversation is still functional
- Low: Minor polish issues or small missed opportunities

For each quality issue found:
- Specify which quality dimension it affects
- Quote relevant parts of the transcript
- Explain the impact on customer experience
- Suggest specific improvement (what bot should have said/done instead)

Example: "EMPATHY ISSUE - Severity: High. Customer expressed significant frustration at lines 8 and 10 ('Are you even listening?', 'This bot is broken') but bot never acknowledged their emotional state or apologized for the poor experience. Bot should have said something like: 'I sincerely apologize for the frustration this is causing you. I can see you've been patient while we work through this. Let me try a different approach or transfer you to a specialist who can help.'"`,
    defaultInstructions: `Analyze the overall conversation quality based solely on the transcript, regardless of any reference script. Evaluate multiple quality dimensions:

1. EMPATHY & TONE (Critical for Customer Satisfaction)

   Good Signs:
   - Bot acknowledges customer frustration: "I understand this must be frustrating..."
   - Uses warm, professional language
   - Shows patience when customer is upset
   - Validates customer concerns before jumping to solutions

   Quality Issues to Flag:
   - Robotic, cold, or impersonal responses
   - Dismissive tone when customer expresses frustration
   - Overly formal language that feels distant
   - Lack of acknowledgment when customer is clearly upset
   - Tone-deaf responses (e.g., cheerful when customer is angry)

   Example Issue: "Customer expressed frustration multiple times ('This is ridiculous', 'Are you even listening?') but bot never acknowledged their emotional state or apologized for the poor experience."

2. ACTIVE LISTENING & COMPREHENSION

   Good Signs:
   - Bot references specific details customer mentioned
   - Bot asks relevant follow-up questions
   - Bot summarizes customer's issue to confirm understanding
   - Bot builds on previous exchanges naturally

   Quality Issues to Flag:
   - Bot ignores important information customer provides
   - Bot asks questions that were already answered
   - Bot provides irrelevant solutions that don't match the issue
   - Bot fails to acknowledge customer's stated concerns
   - Responses feel generic rather than tailored to this specific customer

   Example Issue: "Customer stated 'I already tried that three times' (line 6) but bot completely ignored this and suggested the same solution again without acknowledgment."

3. CLARITY & HELPFULNESS

   Good Signs:
   - Instructions are clear and step-by-step
   - Bot explains technical terms when needed
   - Bot checks if customer understood before moving on
   - Solutions are relevant and actionable

   Quality Issues to Flag:
   - Vague or unclear instructions
   - Technical jargon without explanation
   - Assumed knowledge customer may not have
   - Incomplete solutions or half-answers
   - Bot moves on without confirming customer could follow steps

   Example Issue: "Bot said 'Please restart your router' but didn't explain how to do this or how long to wait, leaving customer without clear guidance."

4. PROBLEM RESOLUTION APPROACH

   Good Signs:
   - Systematic troubleshooting (not random guesses)
   - Bot asks what was already tried before suggesting solutions
   - Bot escalates appropriately when stuck
   - Bot stays focused on resolving the actual issue

   Quality Issues to Flag:
   - Bot suggests random solutions without logical order
   - Bot keeps trying same approach when it's clearly not working
   - Bot never offers escalation even when customer is frustrated and nothing is working
   - Bot ignores the actual problem and focuses on something else
   - Bot gives up too easily or escalates too quickly without trying to help

   Example Issue: "After three failed attempts to resolve the issue, bot never offered to escalate to a human agent despite customer expressing frustration."

5. CONVERSATIONAL FLOW & TRANSITIONS

   Good Signs:
   - Smooth transitions between topics
   - Natural conversation progression
   - Clear signposting ("Now let's...", "Next, I'll...")
   - Logical sequence of questions and actions

   Quality Issues to Flag:
   - Abrupt topic changes without explanation
   - Disjointed conversation that jumps around
   - Awkward or confusing transitions
   - Missing connective phrases that guide the conversation

   Example Issue: "Bot abruptly switched from troubleshooting to asking for account number without explaining why or transitioning smoothly (line 12)."

6. MISSED OPPORTUNITIES

   Quality Issues to Flag:
   - Bot could have shown more empathy at key moments
   - Bot could have proactively offered related help
   - Bot could have educated customer about preventing similar issues
   - Bot could have checked customer satisfaction before closing
   - Bot could have offered alternative solutions when first approach failed

   Example Issue: "Customer mentioned frustration with this being a recurring issue, but bot only addressed the immediate problem without offering to investigate why it keeps happening or how to prevent it."

7. PROFESSIONALISM & ETIQUETTE

   Quality Issues to Flag:
   - Missing pleasantries (thank you, please)
   - Interrupting customer's thought
   - Not apologizing when bot made errors
   - Ending call without proper closing
   - Overly casual or too stiff language

   Example Issue: "Bot never apologized for the confusion it caused with repetitive suggestions, showing lack of accountability."

SEVERITY GUIDELINES:
- Critical: Issues that would make most customers very upset or harm company reputation
- High: Issues that significantly degrade customer experience or show poor service
- Medium: Issues that could be improved but conversation is still functional
- Low: Minor polish issues or small missed opportunities

For each quality issue found:
- Specify which quality dimension it affects
- Quote relevant parts of the transcript
- Explain the impact on customer experience
- Suggest specific improvement (what bot should have said/done instead)

Example: "EMPATHY ISSUE - Severity: High. Customer expressed significant frustration at lines 8 and 10 ('Are you even listening?', 'This bot is broken') but bot never acknowledged their emotional state or apologized for the poor experience. Bot should have said something like: 'I sincerely apologize for the frustration this is causing you. I can see you've been patient while we work through this. Let me try a different approach or transfer you to a specialist who can help.'"`,
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

// CSV format demo data - ONE COLUMN ONLY with complete call transcripts
// Header: Transcript
// Each row = one complete call transcript in a single cell
// Format: Speaker and timestamp on one line, message text on next line(s)
export const demoCSVContent = `Transcript
"outbound Call to 919820203664

 setup user  00:00:00
 Hello! Welcome to TechSupport. How can I assist you today?

 919820203664  00:00:05
 Hi, I need help with my internet connection. It keeps dropping.

 setup user  00:00:10
 I understand you're having connectivity issues. Let me help you troubleshoot that.

 919820203664  00:00:15
 Yes please, it's been happening for two days now.

 setup user  00:00:20
 Please restart your router by unplugging it for 30 seconds.

 919820203664  00:00:25
 I already tried that three times.

 setup user  00:00:30
 I see. Have you tried restarting your router?

 919820203664  00:00:35
 Yes, I just told you I did that already."
"outbound Call to 918765432109

 setup user  00:00:00
 Hello! Welcome to TechSupport. How can I assist you today?

 918765432109  00:00:05
 I want to cancel my subscription.

 setup user  00:00:10
 I'm sorry to hear that. Your subscription has been cancelled.

 918765432109  00:00:15
 Wait, don't you need to verify my identity first?

 setup user  00:00:20
 You're right, I apologize. Can I have your account number?

 918765432109  00:00:25
 Mera account number 98765432 hai.

 setup user  00:00:30
 Thank you. I've located your account. Are you sure you want to cancel?"
"outbound Call to 917654321098

 setup user  00:00:00
 Hello! Welcome to TechSupport. How can I assist you today?

 917654321098  00:00:05
 My bill seems too high this month.

 setup user  00:00:10
 I'd be happy to help review your bill. Let me pull up your account.

 917654321098  00:00:15
 Sure, take your time.

 setup user  00:00:20
 I'd be happy to help review your bill. Let me pull up your account.

 917654321098  00:00:25
 You just said that...

 setup user  00:00:30
 I apologize. I'd be happy to help review your bill.

 917654321098  00:00:35
 This bot is broken."
"outbound Call to 916543210987

 setup user  00:00:00
 Hello! Welcome to TechSupport. How can I assist you today?

 916543210987  00:00:05
 I need to update my address.

 setup user  00:00:10
 Of course! I can help you with that. What is your new address?

 916543210987  00:00:15
 123 Main Street, Apt 4B, New York, NY 10001

 setup user  00:00:20
 Thank you. I've updated your address to 123 Main Street, Apt 4B, New York, NY 10001.

 916543210987  00:00:25
 Great, thanks!

 setup user  00:00:30
 You're welcome! Is there anything else I can help you with?

 916543210987  00:00:35
 No, that's all. Thanks!"
"outbound Call to 915432109876

 setup user  00:00:00
 Hello! Welcome to TechSupport. How can I assist you today?

 915432109876  00:00:05
 My payment didn't go through.

 setup user  00:00:10
 I'm sorry to hear about the payment issue. Let me check that for you.

 setup user  00:00:15
 Hello! Welcome to TechSupport. How can I assist you today?

 915432109876  00:00:20
 Uhh what? We were just talking about my payment.

 setup user  00:00:25
 I apologize for the confusion. Could you tell me what you need help with?

 915432109876  00:00:30
 Never mind, this is useless."`;
