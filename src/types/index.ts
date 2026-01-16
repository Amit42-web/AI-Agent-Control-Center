export type CheckType =
  | 'flow_compliance'
  | 'repetition'
  | 'language_alignment'
  | 'restart_reset'
  | 'general_quality'
  | string; // Allow custom check IDs

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type IssueType =
  | 'flow_deviation'
  | 'repetition_loop'
  | 'language_mismatch'
  | 'mid_call_restart'
  | 'quality_issue';

export interface TranscriptLine {
  speaker: 'bot' | 'customer';
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
}

export interface FixSuggestions {
  scriptFixes: Fix[];
  generalFixes: Fix[];
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
}

export interface SavedAnalysisWithState extends SavedAnalysis {
  state: AnalysisState;
}

export interface AnalysisState {
  transcripts: Transcript[];
  referenceScript: string;
  referenceEnabled: boolean;
  knowledgeBase: string;
  knowledgeBaseEnabled: boolean;
  checks: CheckConfig[];
  openaiConfig: OpenAIConfig;
  results: AnalysisResult | null;
  fixes: FixSuggestions | null;
  selectedCallId: string | null;
}

export interface AppState {
  // Input state
  transcripts: Transcript[];
  referenceScript: string;
  referenceEnabled: boolean;
  knowledgeBase: string;
  knowledgeBaseEnabled: boolean;
  checks: CheckConfig[];

  // OpenAI configuration
  openaiConfig: OpenAIConfig;

  // Run state
  isRunning: boolean;
  runProgress: number;
  currentStep: 'analyses' | 'input' | 'running' | 'results' | 'fixes';

  // Analysis management
  currentAnalysisId: string | null;
  currentAnalysisName: string | null;

  // Results state
  results: AnalysisResult | null;
  fixes: FixSuggestions | null;
  selectedCallId: string | null;

  // Actions
  setTranscripts: (transcripts: Transcript[]) => void;
  setReferenceScript: (script: string) => void;
  setReferenceEnabled: (enabled: boolean) => void;
  setKnowledgeBase: (kb: string) => void;
  setKnowledgeBaseEnabled: (enabled: boolean) => void;
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
  goToStep: (step: 'analyses' | 'input' | 'running' | 'results' | 'fixes') => void;

  // Analysis management
  saveAnalysis: (name: string) => Promise<void>;
  loadAnalysis: (id: string) => Promise<void>;
  createNewAnalysis: (name: string) => void;
  getAnalysisState: () => AnalysisState;
  restoreAnalysisState: (state: AnalysisState) => void;
}
