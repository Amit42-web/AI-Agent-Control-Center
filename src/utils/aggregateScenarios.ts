import { Scenario, Severity, RootCauseType } from '@/types';

export interface AggregatedScenario {
  id: string;
  groupKey: string; // Unique identifier for this group
  title: string; // Representative title for the group
  dimension: string;
  rootCauseType?: RootCauseType;
  pattern: string; // Description of the pattern
  severity: Severity; // Highest severity in group
  avgConfidence: number;
  occurrences: number; // Total scenario instances
  uniqueCalls: number; // Number of unique calls affected
  affectedCallIds: string[];
  scenarios: Scenario[]; // All scenarios in this group
}

/**
 * Extract semantic entities from text using generic NLP patterns
 * This works for ANY domain without hardcoded patterns
 */
function extractSemanticEntities(text: string): Set<string> {
  const entities = new Set<string>();
  const normalizedText = text.toLowerCase();

  // 1. Extract multi-word noun phrases (2-3 words)
  // Pattern: adjective? noun+ (e.g., "customer name", "bike details", "payment information")
  const multiWordPatterns = [
    /\b(customer|user|agent|caller|bike|vehicle|payment|address|name|identity|contact|email|phone|timeline|pincode|showroom|dealer|qualification|verification|order|booking)\s+(name|info|information|details|data|verification|check|capture|confirmation|step|process|flow|number|code|address|identity)\b/gi,
    /\b(mandatory|required|core|essential|critical)\s+(step|steps|flow|process|check|information|data|field|fields)\b/gi,
  ];

  for (const pattern of multiWordPatterns) {
    const matches = normalizedText.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Normalize to underscore format
        const normalized = match.trim().replace(/\s+/g, '_');
        entities.add(normalized);
      });
    }
  }

  // 2. Extract important single-word entities (domain objects)
  // These are likely to be the subject of the issue
  const singleWordEntities = [
    /\b(name|address|email|phone|pincode|timeline|bike|vehicle|showroom|dealer|customer|payment|order|booking|identity|qualification|verification|flow|process|step|information|data|details)\b/gi,
  ];

  for (const pattern of singleWordEntities) {
    const matches = normalizedText.match(pattern);
    if (matches) {
      matches.forEach(match => entities.add(match.toLowerCase()));
    }
  }

  return entities;
}

/**
 * Extract action-object patterns (what action failed on what object)
 * E.g., "skipped name capture" → "skip_name", "failed to verify address" → "fail_address"
 */
function extractActionObjectPatterns(text: string): Set<string> {
  const patterns = new Set<string>();
  const normalizedText = text.toLowerCase();

  // Generic action-object patterns that work for any domain
  const actionObjectPatterns = [
    // Negative actions: skip/miss/omit/bypass/fail + object
    /\b(skip|skipped|miss|missed|omit|omitted|bypass|bypassed|jump|jumped|fail|failed|unable|didn'?t|never|not)\s+(?:to\s+)?(capture|collect|verify|confirm|check|get|obtain|gather|provide|enter|complete|finish|progress)\s+(?:correct\s+)?(?:customer\s+)?(\w+)/gi,

    // Negative pattern: didn't/never/not + action + object
    /\b(didn'?t|never|not)\s+(capture|collect|verify|confirm|check|get|obtain)\s+(?:correct\s+)?(?:the\s+)?(\w+)/gi,

    // Positive action patterns: capture/verify/check + object
    /\b(capture|collect|verify|confirm|check|get|obtain|gather)\s+(?:correct\s+)?(?:customer\s+)?(\w+)\s+(?:after|when|during)/gi,
  ];

  for (const pattern of actionObjectPatterns) {
    const matches = [...normalizedText.matchAll(pattern)];
    if (matches.length > 0) {
      matches.forEach(match => {
        // Extract action and object, normalize to action_object format
        const action = normalizeAction(match[1] || match[2]);
        const object = match[match.length - 1]; // Last captured group is the object
        if (action && object && object.length > 2) {
          patterns.add(`${action}_${object}`);
        }
      });
    }
  }

  return patterns;
}

/**
 * Normalize action verbs to common forms
 * This ensures "skipped", "failed to", "didn't", "never" all map to similar concepts
 */
function normalizeAction(action: string): string {
  const normalized = action.toLowerCase().trim();

  // Negative actions → "fail"
  if (['skip', 'skipped', 'miss', 'missed', 'omit', 'omitted', 'bypass', 'bypassed',
       'jump', 'jumped', 'fail', 'failed', 'unable', "didn't", 'didnt', 'never', 'not'].includes(normalized)) {
    return 'fail';
  }

  // Collection actions → "collect"
  if (['capture', 'captured', 'collect', 'collected', 'gather', 'gathered',
       'obtain', 'obtained', 'get'].includes(normalized)) {
    return 'collect';
  }

  // Verification actions → "verify"
  if (['verify', 'verified', 'confirm', 'confirmed', 'check', 'checked',
       'validate', 'validated'].includes(normalized)) {
    return 'verify';
  }

  return normalized;
}

/**
 * Calculate similarity between two strings with comprehensive normalization
 * This handles synonyms, action verbs, and domain terms generically
 */
function calculateTokenSimilarity(str1: string, str2: string): number {
  // Comprehensive stop words
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'from', 'by', 'as', 'is', 'was', 'are', 'been', 'be',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'when', 'where', 'why', 'how', 'which', 'who', 'whom', 'after', 'during'
  ]);

  // Comprehensive synonym mappings for ANY domain
  const synonymMap: Record<string, string> = {
    // Negative actions → 'fail'
    'skip': 'fail',
    'skipped': 'fail',
    'miss': 'fail',
    'missed': 'fail',
    'omit': 'fail',
    'omitted': 'fail',
    'bypass': 'fail',
    'bypassed': 'fail',
    'jump': 'fail',
    'jumped': 'fail',
    'fail': 'fail',
    'failed': 'fail',
    'unable': 'fail',
    "didn't": 'fail',
    'didnt': 'fail',
    'never': 'fail',

    // Collection actions → 'capture'
    'capture': 'capture',
    'captured': 'capture',
    'collect': 'capture',
    'collected': 'capture',
    'gather': 'capture',
    'gathered': 'capture',
    'obtain': 'capture',
    'obtained': 'capture',
    'get': 'capture',

    // Verification → 'verify'
    'verify': 'verify',
    'verified': 'verify',
    'confirm': 'verify',
    'confirmed': 'verify',
    'check': 'verify',
    'checked': 'verify',
    'validate': 'verify',
    'validated': 'verify',
    'qualification': 'verify',
    'verification': 'verify',

    // Process synonyms → 'process'
    'flow': 'process',
    'process': 'process',
    'step': 'process',
    'steps': 'process',
    'procedure': 'process',
    'workflow': 'process',

    // Required synonyms → 'required'
    'mandatory': 'required',
    'required': 'required',
    'essential': 'required',
    'core': 'required',
    'critical': 'required',

    // Information synonyms → 'info'
    'information': 'info',
    'info': 'info',
    'data': 'info',
    'details': 'info',

    // Identity/name synonyms → 'identity'
    'name': 'identity',
    'identity': 'identity',
    'customer': 'customer',
    'user': 'customer',
    'caller': 'customer',
  };

  const normalize = (s: string) => {
    return s.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .map(word => synonymMap[word] || word)
      .filter(Boolean);
  };

  const tokens1 = new Set(normalize(str1));
  const tokens2 = new Set(normalize(str2));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

/**
 * Calculate comprehensive similarity between two scenarios
 * Uses adaptive weighting based on signal strength
 *
 * @param scenario1 First scenario
 * @param scenario2 Second scenario
 * @param embedding1 Optional pre-computed embedding for scenario1 (for semantic similarity)
 * @param embedding2 Optional pre-computed embedding for scenario2 (for semantic similarity)
 * @param useSemanticSimilarity Whether to include semantic similarity in the calculation
 */
function calculateScenarioSimilarity(
  scenario1: Scenario,
  scenario2: Scenario,
  embedding1?: number[],
  embedding2?: number[],
  useSemanticSimilarity: boolean = false
): number {
  const fullText1 = scenario1.title + ' ' + scenario1.whatHappened;
  const fullText2 = scenario2.title + ' ' + scenario2.whatHappened;

  // Signal 1: Semantic entity overlap (generic, works for any domain)
  const entities1 = extractSemanticEntities(fullText1);
  const entities2 = extractSemanticEntities(fullText2);

  let entitySimilarity = 0;
  if (entities1.size > 0 || entities2.size > 0) {
    const entityIntersection = new Set([...entities1].filter(x => entities2.has(x)));
    const entityUnion = new Set([...entities1, ...entities2]);
    entitySimilarity = entityUnion.size > 0 ? entityIntersection.size / entityUnion.size : 0;

    // BOOST: If they share 2+ entities, boost the similarity
    // This works for any entities: customer_name, bike_details, payment_info, etc.
    if (entityIntersection.size >= 2) {
      entitySimilarity = Math.min(1.0, entitySimilarity * 1.5);
    }
  }

  // Signal 2: Action-object pattern matching (e.g., "fail_name", "skip_verification")
  const actionPatterns1 = extractActionObjectPatterns(fullText1);
  const actionPatterns2 = extractActionObjectPatterns(fullText2);

  let actionSimilarity = 0;
  if (actionPatterns1.size > 0 || actionPatterns2.size > 0) {
    const actionIntersection = new Set([...actionPatterns1].filter(x => actionPatterns2.has(x)));
    const actionUnion = new Set([...actionPatterns1, ...actionPatterns2]);
    actionSimilarity = actionUnion.size > 0 ? actionIntersection.size / actionUnion.size : 0;
  }

  // Signal 3: Title token similarity (with comprehensive synonym mapping)
  const titleSimilarity = calculateTokenSimilarity(scenario1.title, scenario2.title);

  // Signal 4: Description similarity
  const descSimilarity = calculateTokenSimilarity(scenario1.whatHappened, scenario2.whatHappened);

  // Signal 5: Semantic embedding similarity (captures paraphrasing and semantic equivalence)
  let embeddingSimilarity = 0;
  if (useSemanticSimilarity && embedding1 && embedding2 && embedding1.length > 0 && embedding2.length > 0) {
    // Import cosine similarity dynamically to avoid circular dependencies
    embeddingSimilarity = calculateCosineSimilarity(embedding1, embedding2);
  }

  // ADAPTIVE WEIGHTING:
  // If semantic embeddings available → include as a strong signal
  // If entity/action signals are strong → use entity-focused weights
  // If entity/action signals are weak but title/desc are strong → boost title/desc weights
  const hasEmbeddings = useSemanticSimilarity && embeddingSimilarity > 0;
  const hasStrongSemanticSignals = (entitySimilarity > 0.3 || actionSimilarity > 0.3);
  const hasStrongTextSignals = (titleSimilarity > 0.4 || descSimilarity > 0.4);
  const hasStrongEmbeddingSimilarity = (embeddingSimilarity > 0.7); // High embedding similarity indicates semantic equivalence

  let combinedSimilarity;

  if (hasEmbeddings) {
    // Embeddings available - use 5-signal weighting
    if (hasStrongEmbeddingSimilarity) {
      // Very similar semantically → trust embeddings more
      combinedSimilarity =
        (embeddingSimilarity * 0.40) +
        (entitySimilarity * 0.20) +
        (actionSimilarity * 0.20) +
        (titleSimilarity * 0.15) +
        (descSimilarity * 0.05);
    } else if (hasStrongSemanticSignals) {
      // Entity/action signals are strong → balanced semantic+lexical
      combinedSimilarity =
        (embeddingSimilarity * 0.25) +
        (entitySimilarity * 0.25) +
        (actionSimilarity * 0.25) +
        (titleSimilarity * 0.15) +
        (descSimilarity * 0.10);
    } else {
      // Balanced weighting with embeddings
      combinedSimilarity =
        (embeddingSimilarity * 0.30) +
        (entitySimilarity * 0.20) +
        (actionSimilarity * 0.20) +
        (titleSimilarity * 0.20) +
        (descSimilarity * 0.10);
    }
  } else {
    // No embeddings - use original 4-signal weighting
    if (hasStrongSemanticSignals) {
      // Entity/action signals are strong → use semantic-focused weights
      combinedSimilarity =
        (entitySimilarity * 0.35) +
        (actionSimilarity * 0.35) +
        (titleSimilarity * 0.20) +
        (descSimilarity * 0.10);
    } else if (hasStrongTextSignals) {
      // Text signals are strong but semantic signals weak → boost text weights
      combinedSimilarity =
        (entitySimilarity * 0.15) +
        (actionSimilarity * 0.15) +
        (titleSimilarity * 0.50) +
        (descSimilarity * 0.20);
    } else {
      // Balanced weighting
      combinedSimilarity =
        (entitySimilarity * 0.30) +
        (actionSimilarity * 0.30) +
        (titleSimilarity * 0.30) +
        (descSimilarity * 0.10);
    }
  }

  return combinedSimilarity;
}

/**
 * Calculate cosine similarity between two embedding vectors
 * (Inline version to avoid import issues)
 */
function calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
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

/**
 * Get the highest severity from a list of severities
 */
function getHighestSeverity(severities: Severity[]): Severity {
  if (severities.includes('critical')) return 'critical';
  if (severities.includes('high')) return 'high';
  if (severities.includes('medium')) return 'medium';
  return 'low';
}

/**
 * Aggregate scenarios by dimension, root cause, and title similarity
 */
/**
 * Aggregate scenarios with optional semantic similarity via embeddings
 *
 * @param scenarios The scenarios to aggregate
 * @param scenarioEmbeddings Optional map of scenario ID to embedding vector
 * @returns Aggregated scenarios
 */
export function aggregateScenarios(
  scenarios: Scenario[],
  scenarioEmbeddings?: Map<string, number[]>
): AggregatedScenario[] {
  if (scenarios.length === 0) return [];

  const useSemanticSimilarity = scenarioEmbeddings && scenarioEmbeddings.size > 0;

  // Step 1: Group by dimension and root cause
  const primaryGroups = scenarios.reduce((acc, scenario) => {
    // Normalize dimension by removing (A), (B), etc. suffix
    const rawDimension = scenario.dimension || 'Uncategorized';
    const dimension = rawDimension.replace(/\s*\([A-G]\)\s*$/, '').trim();
    const rootCause = scenario.rootCauseType || 'unknown';
    const key = `${dimension}||${rootCause}`;

    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(scenario);
    return acc;
  }, {} as Record<string, Scenario[]>);

  const aggregated: AggregatedScenario[] = [];

  // Step 2: Within each primary group, cluster by similarity
  for (const [primaryKey, groupScenarios] of Object.entries(primaryGroups)) {
    const [dimension, rootCause] = primaryKey.split('||');
    const clusters: Scenario[][] = [];

    // Cluster scenarios with similar semantic patterns
    for (const scenario of groupScenarios) {
      let addedToCluster = false;

      const scenarioEmbedding = useSemanticSimilarity ? scenarioEmbeddings?.get(scenario.id) : undefined;

      for (const cluster of clusters) {
        // Check if this scenario is similar to any scenario in the cluster
        const similarityScores = cluster.map(s => {
          const clusterScenarioEmbedding = useSemanticSimilarity ? scenarioEmbeddings?.get(s.id) : undefined;
          return calculateScenarioSimilarity(
            scenario,
            s,
            scenarioEmbedding,
            clusterScenarioEmbedding,
            useSemanticSimilarity
          );
        });
        const maxSimilarity = Math.max(...similarityScores);

        // Similarity threshold: 0.30 (30% weighted similarity)
        // This threshold works with our adaptive weighting system:
        // - Strong semantic embedding signals (paraphrasing detection) → merge similar issues
        // - Strong semantic signals (entity + action patterns) → merge similar issues
        // - Strong text signals (title + description tokens) → merge similar issues
        // - Works for ANY domain without manual pattern definitions
        if (maxSimilarity >= 0.30) {
          cluster.push(scenario);
          addedToCluster = true;
          break;
        }
      }

      // If not similar to any existing cluster, create new cluster
      if (!addedToCluster) {
        clusters.push([scenario]);
      }
    }

    // Step 3: Create aggregated entries for each cluster
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];

      // Use the most common title or the first one
      const titleCounts = cluster.reduce((acc, s) => {
        acc[s.title] = (acc[s.title] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const representativeTitle = Object.entries(titleCounts)
        .sort((a, b) => b[1] - a[1])[0][0];

      const affectedCallIds = Array.from(new Set(cluster.map(s => s.callId)));
      const severities = cluster.map(s => s.severity);
      const avgConfidence = cluster.reduce((sum, s) => sum + s.confidence, 0) / cluster.length;

      // Create pattern description
      const uniqueTitles = new Set(cluster.map(s => s.title));
      const pattern = uniqueTitles.size > 1
        ? `${uniqueTitles.size} similar patterns identified`
        : cluster[0].whatHappened;

      aggregated.push({
        id: `agg-${primaryKey}-${i}`,
        groupKey: `${dimension}-${rootCause}-${i}`,
        title: representativeTitle,
        dimension,
        rootCauseType: rootCause !== 'unknown' ? rootCause as RootCauseType : undefined,
        pattern,
        severity: getHighestSeverity(severities),
        avgConfidence: Math.round(avgConfidence),
        occurrences: cluster.length,
        uniqueCalls: affectedCallIds.length,
        affectedCallIds,
        scenarios: cluster.sort((a, b) => a.callId.localeCompare(b.callId))
      });
    }
  }

  // Sort by impact: occurrences * severity weight
  const severityWeight = (s: Severity) => {
    switch (s) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
    }
  };

  return aggregated.sort((a, b) => {
    const impactA = a.occurrences * severityWeight(a.severity);
    const impactB = b.occurrences * severityWeight(b.severity);

    if (impactB !== impactA) {
      return impactB - impactA;
    }

    // Secondary sort by unique calls
    return b.uniqueCalls - a.uniqueCalls;
  });
}

/**
 * Get aggregation summary statistics
 */
export function getAggregationSummary(aggregated: AggregatedScenario[]) {
  const totalScenarios = aggregated.reduce((sum, agg) => sum + agg.occurrences, 0);
  const totalGroups = aggregated.length;
  const avgScenariosPerGroup = totalGroups > 0 ? Math.round(totalScenarios / totalGroups) : 0;

  const allCallIds = new Set<string>();
  aggregated.forEach(agg => agg.affectedCallIds.forEach(id => allCallIds.add(id)));

  return {
    totalScenarios,
    totalGroups,
    avgScenariosPerGroup,
    totalCalls: allCallIds.size
  };
}

/**
 * Pre-compute embeddings for all scenarios to enable semantic similarity
 * This is called before aggregateScenarios() when semantic deduplication is enabled
 *
 * ## Why Semantic Similarity?
 *
 * Traditional lexical similarity (word overlap) struggles with paraphrasing:
 * - "incorrect finance percentages were communicated"
 * - "incorrect states 95% finance as a definite outcome"
 *
 * These describe the SAME issue but have different wording. Semantic similarity
 * using embeddings detects that they have the same meaning and should be deduplicated.
 *
 * ## Usage Example:
 *
 * ```typescript
 * // Step 1: Compute embeddings for all scenarios
 * const embeddings = await computeScenarioEmbeddings(
 *   scenarios,
 *   apiKey,
 *   'text-embedding-3-small'
 * );
 *
 * // Step 2: Aggregate with semantic similarity enabled
 * const aggregated = aggregateScenarios(scenarios, embeddings);
 * ```
 *
 * ## How It Works:
 *
 * 1. Each scenario's title + description is converted to a vector embedding
 * 2. Cosine similarity between embeddings measures semantic closeness (0-1)
 * 3. High embedding similarity (>0.7) indicates paraphrasing or semantic equivalence
 * 4. The similarity is combined with lexical signals in adaptive weighting:
 *    - Strong embedding similarity → 40% weight (trusted more)
 *    - Balanced mode → 30% weight (equal with other signals)
 * 5. The 30% overall threshold still applies for clustering
 *
 * ## Performance:
 *
 * - Batch processing with 50 scenarios per batch
 * - Rate limit protection with 100ms delays
 * - OpenAI text-embedding-3-small: ~$0.02 per 1M tokens (~500 scenarios)
 *
 * @param scenarios The scenarios to compute embeddings for
 * @param apiKey OpenAI API key
 * @param model Embedding model to use (default: text-embedding-3-small)
 * @returns Map of scenario ID to embedding vector
 */
export async function computeScenarioEmbeddings(
  scenarios: Scenario[],
  apiKey: string,
  model: string = 'text-embedding-3-small'
): Promise<Map<string, number[]>> {
  // Dynamically import to avoid issues with server/client imports
  const { getEmbedding } = await import('@/services/openai');

  const embeddingsMap = new Map<string, number[]>();

  // Batch process embeddings to avoid rate limits
  // OpenAI allows ~3000 requests/min for embeddings, but we'll be conservative
  const batchSize = 50;

  for (let i = 0; i < scenarios.length; i += batchSize) {
    const batch = scenarios.slice(i, i + batchSize);

    const promises = batch.map(async (scenario) => {
      try {
        // Combine title and whatHappened for semantic context
        const text = scenario.title + ' ' + scenario.whatHappened;
        const embedding = await getEmbedding(apiKey, text, model);
        return { id: scenario.id, embedding };
      } catch (error) {
        console.error(`Failed to get embedding for scenario ${scenario.id}:`, error);
        return { id: scenario.id, embedding: [] };
      }
    });

    const results = await Promise.all(promises);

    results.forEach(({ id, embedding }) => {
      if (embedding.length > 0) {
        embeddingsMap.set(id, embedding);
      }
    });

    // Small delay between batches to respect rate limits
    if (i + batchSize < scenarios.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`Computed ${embeddingsMap.size} embeddings out of ${scenarios.length} scenarios`);

  return embeddingsMap;
}
