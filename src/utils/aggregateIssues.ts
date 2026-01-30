import { DetectedIssue, AggregatedIssue, Severity } from '@/types';

/**
 * Aggregates similar issues across multiple calls by clustering semantically similar types
 * Uses multi-signal similarity: entity extraction, action patterns, token similarity, and optional embeddings
 */
export function aggregateIssues(
  issues: DetectedIssue[],
  issueTypeEmbeddings?: Map<string, number[]>
): AggregatedIssue[] {
  if (issues.length === 0) return [];

  const useSemanticSimilarity = issueTypeEmbeddings && issueTypeEmbeddings.size > 0;

  // Step 1: Cluster issues by semantic type similarity instead of exact type match
  const typeClusters: DetectedIssue[][] = [];

  for (const issue of issues) {
    let addedToCluster = false;

    const issueEmbedding = useSemanticSimilarity ? issueTypeEmbeddings?.get(issue.type) : undefined;

    // Try to find a cluster with similar types
    for (const cluster of typeClusters) {
      // Get the representative type from the cluster (use first issue's type)
      const representativeIssue = cluster[0];
      const representativeEmbedding = useSemanticSimilarity ? issueTypeEmbeddings?.get(representativeIssue.type) : undefined;

      // Calculate type similarity
      const similarity = calculateTypeSimilarity(
        issue.type,
        representativeIssue.type,
        issueEmbedding,
        representativeEmbedding,
        useSemanticSimilarity
      );

      // Use same threshold as scenarios: 0.30 (30% weighted similarity)
      if (similarity >= 0.30) {
        cluster.push(issue);
        addedToCluster = true;
        break;
      }
    }

    // If not similar to any cluster, create new cluster
    if (!addedToCluster) {
      typeClusters.push([issue]);
    }
  }

  const aggregated: AggregatedIssue[] = [];

  // Step 2: Create aggregated entry for each type cluster
  for (let i = 0; i < typeClusters.length; i++) {
    const clusterIssues = typeClusters[i];

    // Use most common type as representative, or first one
    const typeCounts = clusterIssues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const representativeType = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])[0][0];

    const severities = clusterIssues.map(i => i.severity);
    const highestSeverity = getHighestSeverity(severities);

    const avgConfidence = clusterIssues.reduce((sum, i) => sum + i.confidence, 0) / clusterIssues.length;

    const affectedCallIds = Array.from(new Set(clusterIssues.map(i => i.callId)));

    // Collect all unique patterns/explanations
    const allPatterns = Array.from(new Set(clusterIssues.map(i => i.explanation)));

    // Show pattern diversity if multiple types were clustered
    const uniqueTypes = new Set(clusterIssues.map(i => i.type));
    const pattern = uniqueTypes.size > 1
      ? `${uniqueTypes.size} similar issue types clustered: ${allPatterns.length} patterns across ${affectedCallIds.length} call${affectedCallIds.length !== 1 ? 's' : ''}`
      : allPatterns.length > 1
      ? `${allPatterns.length} different patterns identified across ${affectedCallIds.length} call${affectedCallIds.length !== 1 ? 's' : ''}`
      : allPatterns[0];

    // Get sample evidence (up to 3 unique examples)
    const evidenceSnippets = Array.from(
      new Set(clusterIssues.map(i => i.evidenceSnippet))
    ).slice(0, 3);

    aggregated.push({
      id: `agg-type-cluster-${i}`,
      type: representativeType as any,
      pattern,
      severity: highestSeverity,
      avgConfidence: Math.round(avgConfidence),
      occurrences: affectedCallIds.length,
      affectedCallIds,
      instances: clusterIssues,
      evidenceSnippets
    });
  }

  // Sort by occurrences (most common first), then by severity
  return aggregated.sort((a, b) => {
    if (b.occurrences !== a.occurrences) {
      return b.occurrences - a.occurrences;
    }
    return severityWeight(b.severity) - severityWeight(a.severity);
  });
}


/**
 * Calculate semantic similarity between two issue types
 * Uses multi-signal approach: entities, actions, tokens, and optional embeddings
 */
function calculateTypeSimilarity(
  type1: string,
  type2: string,
  embedding1?: number[],
  embedding2?: number[],
  useSemanticSimilarity: boolean = false
): number {
  // Signal 1: Semantic entity overlap
  const entities1 = extractSemanticEntities(type1);
  const entities2 = extractSemanticEntities(type2);

  let entitySimilarity = 0;
  if (entities1.size > 0 || entities2.size > 0) {
    const entityIntersection = new Set([...entities1].filter(x => entities2.has(x)));
    const entityUnion = new Set([...entities1, ...entities2]);
    entitySimilarity = entityUnion.size > 0 ? entityIntersection.size / entityUnion.size : 0;

    // Boost if they share 2+ entities (e.g., both mention "customer_name")
    if (entityIntersection.size >= 2) {
      entitySimilarity = Math.min(1.0, entitySimilarity * 1.5);
    }
  }

  // Signal 2: Action-object pattern matching
  const actionPatterns1 = extractActionObjectPatterns(type1);
  const actionPatterns2 = extractActionObjectPatterns(type2);

  let actionSimilarity = 0;
  if (actionPatterns1.size > 0 || actionPatterns2.size > 0) {
    const actionIntersection = new Set([...actionPatterns1].filter(x => actionPatterns2.has(x)));
    const actionUnion = new Set([...actionPatterns1, ...actionPatterns2]);
    actionSimilarity = actionUnion.size > 0 ? actionIntersection.size / actionUnion.size : 0;
  }

  // Signal 3: Token similarity with synonyms
  const tokenSimilarity = calculateTokenSimilarity(type1, type2);

  // Signal 4: Semantic embedding similarity
  let embeddingSimilarity = 0;
  if (useSemanticSimilarity && embedding1 && embedding2 && embedding1.length > 0 && embedding2.length > 0) {
    embeddingSimilarity = calculateCosineSimilarity(embedding1, embedding2);
  }

  // Adaptive weighting (same logic as scenarios)
  const hasEmbeddings = useSemanticSimilarity && embeddingSimilarity > 0;
  const hasStrongEmbeddingSimilarity = embeddingSimilarity > 0.7;
  const hasStrongSemanticSignals = (entitySimilarity > 0.3 || actionSimilarity > 0.3);
  const hasStrongTextSignals = tokenSimilarity > 0.4;

  let combinedSimilarity;

  if (hasEmbeddings) {
    if (hasStrongEmbeddingSimilarity) {
      // Trust embeddings more
      combinedSimilarity =
        (embeddingSimilarity * 0.50) +
        (entitySimilarity * 0.20) +
        (actionSimilarity * 0.20) +
        (tokenSimilarity * 0.10);
    } else if (hasStrongSemanticSignals) {
      combinedSimilarity =
        (embeddingSimilarity * 0.30) +
        (entitySimilarity * 0.30) +
        (actionSimilarity * 0.30) +
        (tokenSimilarity * 0.10);
    } else {
      combinedSimilarity =
        (embeddingSimilarity * 0.35) +
        (entitySimilarity * 0.25) +
        (actionSimilarity * 0.25) +
        (tokenSimilarity * 0.15);
    }
  } else {
    // No embeddings - use 3-signal weighting
    if (hasStrongSemanticSignals) {
      combinedSimilarity =
        (entitySimilarity * 0.40) +
        (actionSimilarity * 0.40) +
        (tokenSimilarity * 0.20);
    } else if (hasStrongTextSignals) {
      combinedSimilarity =
        (entitySimilarity * 0.25) +
        (actionSimilarity * 0.25) +
        (tokenSimilarity * 0.50);
    } else {
      combinedSimilarity =
        (entitySimilarity * 0.35) +
        (actionSimilarity * 0.35) +
        (tokenSimilarity * 0.30);
    }
  }

  return combinedSimilarity;
}

/**
 * Extract semantic entities from text using domain-agnostic patterns
 */
function extractSemanticEntities(text: string): Set<string> {
  const entities = new Set<string>();
  const normalizedText = text.toLowerCase();

  // Multi-word noun phrases
  const multiWordPatterns = [
    /\b(customer|user|agent|caller|bike|vehicle|payment|address|name|identity|contact|email|phone|timeline|pincode|showroom|dealer|qualification|verification|order|booking|greeting|handling)\s+(name|info|information|details|data|verification|check|capture|confirmation|step|process|flow|number|code|address|identity|rule|handling)\b/gi,
    /\b(mandatory|required|core|essential|critical|minor|major)\s+(step|steps|flow|process|check|information|data|field|fields|deviation|issue)\b/gi,
  ];

  for (const pattern of multiWordPatterns) {
    const matches = normalizedText.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const normalized = match.trim().replace(/\s+/g, '_');
        entities.add(normalized);
      });
    }
  }

  // Single-word entities
  const singleWordEntities = [
    /\b(name|address|email|phone|pincode|timeline|bike|vehicle|showroom|dealer|customer|payment|order|booking|identity|qualification|verification|flow|process|step|information|data|details|greeting|handling|rule|deviation)\b/gi,
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
 * Extract action-object patterns (e.g., "skip_name", "fail_verification")
 */
function extractActionObjectPatterns(text: string): Set<string> {
  const patterns = new Set<string>();
  const normalizedText = text.toLowerCase();

  const actionObjectPatterns = [
    /\b(skip|skipped|miss|missed|omit|omitted|bypass|bypassed|jump|jumped|fail|failed|unable|didn'?t|never|not|did\s+not|minor|major)\s+(?:to\s+)?(?:follow\s+)?(capture|collect|verify|confirm|check|get|obtain|gather|provide|enter|complete|finish|progress|follow|handle|deviation|from)\s+(?:correct\s+)?(?:customer\s+)?(\w+)/gi,
    /\b(didn'?t|never|not|did\s+not)\s+(capture|collect|verify|confirm|check|get|obtain|follow|handle)\s+(?:correct\s+)?(?:the\s+)?(\w+)/gi,
  ];

  for (const pattern of actionObjectPatterns) {
    const matches = [...normalizedText.matchAll(pattern)];
    if (matches.length > 0) {
      matches.forEach(match => {
        const action = normalizeAction(match[1] || match[2]);
        const object = match[match.length - 1];
        if (action && object && object.length > 2) {
          patterns.add(`${action}_${object}`);
        }
      });
    }
  }

  return patterns;
}

/**
 * Normalize action verbs to common semantic forms
 */
function normalizeAction(action: string): string {
  const normalized = action.toLowerCase().trim();

  // Negative actions → "fail"
  if (['skip', 'skipped', 'miss', 'missed', 'omit', 'omitted', 'bypass', 'bypassed',
       'jump', 'jumped', 'fail', 'failed', 'unable', "didn't", 'didnt', 'never', 'not',
       'did not', 'minor', 'major', 'deviation'].includes(normalized)) {
    return 'fail';
  }

  // Collection actions → "collect"
  if (['capture', 'captured', 'collect', 'collected', 'gather', 'gathered',
       'obtain', 'obtained', 'get'].includes(normalized)) {
    return 'collect';
  }

  // Verification/following actions → "verify"
  if (['verify', 'verified', 'confirm', 'confirmed', 'check', 'checked',
       'validate', 'validated', 'follow', 'handle', 'handling'].includes(normalized)) {
    return 'verify';
  }

  return normalized;
}

/**
 * Calculate token-based similarity with synonym mapping
 */
function calculateTokenSimilarity(str1: string, str2: string): number {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'from', 'by', 'as', 'is', 'was', 'are', 'been', 'be',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'when', 'where', 'why', 'how', 'which', 'who', 'whom', 'after', 'during'
  ]);

  const synonymMap: Record<string, string> = {
    // Negative actions
    'skip': 'fail', 'skipped': 'fail', 'miss': 'fail', 'missed': 'fail',
    'omit': 'fail', 'omitted': 'fail', 'bypass': 'fail', 'bypassed': 'fail',
    'fail': 'fail', 'failed': 'fail', 'unable': 'fail', "didn't": 'fail',
    'never': 'fail', 'not': 'fail', 'minor': 'fail', 'major': 'fail',
    'deviation': 'fail',

    // Collection actions
    'capture': 'capture', 'collect': 'capture', 'gather': 'capture',
    'obtain': 'capture', 'get': 'capture',

    // Verification/validation actions
    'verify': 'verify', 'confirm': 'verify', 'check': 'verify',
    'validate': 'verify', 'qualification': 'verify', 'verification': 'verify',
    'follow': 'verify', 'handle': 'verify', 'handling': 'verify',
    'confirmation': 'verify', 'greeting': 'verify',

    // Identity/name synonyms
    'name': 'identity', 'identity': 'identity',
    'customer': 'customer', 'user': 'customer', 'caller': 'customer',

    // Process/rule synonyms
    'rule': 'process', 'process': 'process', 'step': 'process',
    'procedure': 'process', 'protocol': 'process',
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
 * Calculate cosine similarity between two embedding vectors
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
 * Pre-compute embeddings for all unique issue types
 * Similar to scenario embeddings but for issue types
 *
 * @param issues The issues to compute type embeddings for
 * @param apiKey OpenAI API key
 * @param model Embedding model (default: text-embedding-3-small)
 * @returns Map of issue type to embedding vector
 */
export async function computeIssueTypeEmbeddings(
  issues: DetectedIssue[],
  apiKey: string,
  model: string = 'text-embedding-3-small'
): Promise<Map<string, number[]>> {
  const { getEmbedding } = await import('@/services/openai');

  const embeddingsMap = new Map<string, number[]>();

  // Get unique issue types
  const uniqueTypes = Array.from(new Set(issues.map(i => i.type)));

  // Batch process
  const batchSize = 50;

  for (let i = 0; i < uniqueTypes.length; i += batchSize) {
    const batch = uniqueTypes.slice(i, i + batchSize);

    const promises = batch.map(async (type) => {
      try {
        const embedding = await getEmbedding(apiKey, type, model);
        return { type, embedding };
      } catch (error) {
        console.error(`Failed to get embedding for type "${type}":`, error);
        return { type, embedding: [] };
      }
    });

    const results = await Promise.all(promises);

    results.forEach(({ type, embedding }) => {
      if (embedding.length > 0) {
        embeddingsMap.set(type, embedding);
      }
    });

    // Small delay between batches
    if (i + batchSize < uniqueTypes.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`Computed ${embeddingsMap.size} issue type embeddings out of ${uniqueTypes.length} unique types`);

  return embeddingsMap;
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
