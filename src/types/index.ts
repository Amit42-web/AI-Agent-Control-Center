export type CheckType =
  | 'flow_compliance'
  | 'repetition'
  | 'language_alignment'
  | 'restart_reset'
  | 'general_quality'
  | string; // Allow custom check IDs

export type FlowType = 'objective' | 'open-ended';

export type FixType = 'script' | 'training' | 'process' | 'system';
export type RootCauseType = 'prompt' | 'flow' | 'training' | 'process' | 'system' | 'knowledge';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type IssueType =
  | 'flow_deviation'
  | 'repetition_loop'
  | 'language_mismatch'
  | 'mid_call_restart'
  | 'quality_issue'
  | string; // Allow custom issue types from custom checks

export interface TranscriptLine {
  speaker: 'agent' | 'customer';
  text: string;
  timestamp?: string;
  language?: string;
}

export interface Transcript {
  id: string;
  lines: TranscriptLine[];
  metadata?: {
    duration?: string;
    date?: string;
    agentId?: string;
  };
}

export interface DetectedIssue {
  id: string;
  callId: string;
  type: IssueType;
  severity: Severity;
  confidence: number;
  evidenceSnippet: string;
  lineNumbers: number[];
  explanation: string;
  suggestedFix?: string;
  isCustomCheck?: boolean; // Flag if this came from a custom/open-ended audit
  sourceCheckId?: string; // ID of the custom check that generated this
  sourceCheckName?: string; // Name of the custom check for display
}

export interface AggregatedIssue {
  id: string;
  type: IssueType;
  pattern: string; // Common pattern extracted from explanations
  severity: Severity; // Highest severity from instances
  avgConfidence: number;
  occurrences: number; // Number of calls affected
  affectedCallIds: string[];
  instances: DetectedIssue[]; // All individual instances
  evidenceSnippets: string[]; // Sample evidence from different calls
}

export interface CheckConfig {
  id: CheckType;
  name: string;
  description: string;
  enabled: boolean;
  requiresReference: boolean;
  instructions: string;
  defaultInstructions: string;
  custom?: boolean; // Mark custom checks
  icon?: string; // Custom icon for custom checks
}

export interface AnalysisResult {
  totalCalls: number;
  callsWithIssues: number;
  issues: DetectedIssue[];
  issuesByType: Record<IssueType, number>;
  severityDistribution: Record<Severity, number>;
  languageMismatchRate: number;
}

export interface Fix {
  id: string;
  issueType: IssueType;
  problem: string;
  suggestion: string;
  placementHint: string;
  exampleResponse: string;
  relatedIssueIds: string[];
  action?: 'add' | 'remove' | 'replace'; // Type of change: add new content, remove existing, or replace
  targetContent?: string; // For remove/replace: the content to be removed or replaced
}

export interface FixSuggestions {
  scriptFixes: Fix[];
  generalFixes: Fix[];
}

// Open-ended flow types
export interface Scenario {
  id: string;
  callId: string;
  title: string; // e.g., "Empathy Gap - Customer Frustration Handling"
  dimension?: string; // Which audit dimension this relates to (e.g., "Conversation Control", "Empathy & Tone")
  rootCauseType?: RootCauseType; // Why this happened: prompt/flow/training/process/system/knowledge
  context: string; // "Lines 45-67, customer waited 2 weeks for resolution"
  whatHappened: string; // What the agent did/didn't do
  impact: string; // Effect on customer/outcome
  severity: Severity;
  confidence: number;
  lineNumbers: number[];
  // evidenceSnippet removed - we'll show actual transcript lines in UI instead
}

export interface PromptFix {
  action: 'add' | 'replace' | 'remove';
  targetSection: string; // e.g., "State S0 - Availability Check" or "System Prompt - Line 15"
  lineNumber?: number; // Specific line number if known
  exactContent: string; // The exact text to add or use as replacement
  beforeText?: string; // For "replace" action - what to replace
  visualDiff?: string; // Optional formatted diff for display
}

export interface EnhancedFix {
  id: string;
  scenarioId: string;
  title: string; // e.g., "Add Empathy Steps"
  fixType: FixType; // 'script' | 'training' | 'process' | 'system'
  rootCauseType: RootCauseType; // Why this happened: 'prompt' | 'flow' | 'training' | 'process' | 'system' | 'knowledge'
  rootCause: string; // Detailed explanation of why this happened
  suggestedSolution: string; // What to do
  whereToImplement: string; // Where in the flow/process
  whatToImplement: string; // Specific steps/content
  concreteExample: string; // Before/after or example
  successCriteria: string; // How to know it's fixed
  howToTest: string; // Validation method

  // For prompt/flow fixes - exact implementation details
  promptFix?: PromptFix;
}

export interface ScenarioResults {
  totalScenarios: number;
  scenariosByType: Record<FixType, number>;
  scenarios: Scenario[];
  severityDistribution: Record<Severity, number>;
}

export interface EnhancedFixSuggestions {
  fixes: EnhancedFix[];
}

export interface OpenAIConfig {
  apiKey: string;
  model: string;
}

export interface SavedAnalysis {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  stats?: {
    totalCalls: number;
    avgIssuesPerCall: number;
    totalIssues: number;
  };
}

export interface SavedAnalysisWithState extends SavedAnalysis {
  state: AnalysisState;
}

export interface AnalysisState {
  flowType: FlowType;
  transcripts: Transcript[];
  referenceScript: string;
  referenceEnabled: boolean;
  knowledgeBase: string;
  knowledgeBaseEnabled: boolean;
  checks: CheckConfig[];
  auditPrompt: string; // For open-ended flow
  openaiConfig: OpenAIConfig;
  results: AnalysisResult | null;
  fixes: FixSuggestions | null;
  scenarioResults: ScenarioResults | null; // For open-ended flow
  enhancedFixes: EnhancedFixSuggestions | null; // For open-ended flow
  selectedCallId: string | null;
}

export type ResultsViewMode = 'detailed' | 'overview';

export interface AppState {
  // Flow type
  flowType: FlowType;

  // Results view mode (detailed table or overview/aggregate charts)
  resultsViewMode: ResultsViewMode;

  // Input state
  transcripts: Transcript[];
  referenceScript: string;
  referenceEnabled: boolean;
  knowledgeBase: string;
  knowledgeBaseEnabled: boolean;
  checks: CheckConfig[];

  // Open-ended flow audit prompt
  auditPrompt: string;

  // OpenAI configuration
  openaiConfig: OpenAIConfig;

  // Run state
  isRunning: boolean;
  runProgress: number;
  currentStep: 'analyses' | 'input' | 'running' | 'results' | 'aggregate' | 'fixes';

  // Analysis management
  currentAnalysisId: string | null;
  currentAnalysisName: string | null;

  // Results state - Objective flow
  results: AnalysisResult | null;
  fixes: FixSuggestions | null;

  // Results state - Open-ended flow
  scenarioResults: ScenarioResults | null;
  enhancedFixes: EnhancedFixSuggestions | null;

  selectedCallId: string | null;
  selectedDimension: string | null; // For filtering scenarios by dimension

  // Actions
  setFlowType: (flowType: FlowType) => void;
  setResultsViewMode: (mode: ResultsViewMode) => void;
  setSelectedDimension: (dimension: string | null) => void;
  setTranscripts: (transcripts: Transcript[]) => void;
  setReferenceScript: (script: string) => void;
  setReferenceEnabled: (enabled: boolean) => void;
  setKnowledgeBase: (kb: string) => void;
  setKnowledgeBaseEnabled: (enabled: boolean) => void;
  setAuditPrompt: (prompt: string) => void;
  setOpenAIConfig: (config: Partial<OpenAIConfig>) => void;
  toggleCheck: (checkId: CheckType) => void;
  updateCheckInstructions: (checkId: CheckType, instructions: string) => void;
  updateCheckName: (checkId: CheckType, name: string) => void;
  addCustomCheck: (check: CheckConfig) => void;
  deleteCustomCheck: (checkId: CheckType) => void;
  resetCheckInstructions: (checkId: CheckType) => void;
  resetAllToDefaults: () => void;
  runAnalysis: () => Promise<void>;
  generateFixes: () => void;
  setSelectedCallId: (id: string | null) => void;
  goToStep: (step: 'analyses' | 'input' | 'running' | 'results' | 'aggregate' | 'fixes') => void;

  // Analysis management
  saveAnalysis: (name: string) => Promise<void>;
  loadAnalysis: (id: string) => Promise<void>;
  createNewAnalysis: (name: string, flowType: FlowType) => void;
  getAnalysisState: () => AnalysisState;
  restoreAnalysisState: (state: AnalysisState) => void;
}
