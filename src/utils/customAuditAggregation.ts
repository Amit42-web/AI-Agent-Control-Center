import { DetectedIssue, AggregatedIssue, Severity } from '@/types';

/**
 * Aggregates custom audit results with intelligent semantic similarity detection
 * Merges issues from different custom checks if they refer to the same underlying problem
 */
export function aggregateCustomAudits(issues: DetectedIssue[]): AggregatedIssue[] {
  if (issues.length === 0) return [];

  // First, group by call ID and check if similar issues exist
  const clusters: DetectedIssue[][] = [];

  for (const issue of issues) {
    let addedToCluster = false;

    // Try to find a cluster this issue belongs to
    for (const cluster of clusters) {
      // Check if this issue is similar to any issue in the cluster
      if (isSimilarIssue(issue, cluster[0])) {
        cluster.push(issue);
        addedToCluster = true;
        break;
      }
    }

    // If not added to any cluster, create a new one
    if (!addedToCluster) {
      clusters.push([issue]);
    }
  }

  // Convert clusters to AggregatedIssue
  return clusters.map((cluster, index) => {
    const severities = cluster.map(i => i.severity);
    const highestSeverity = getHighestSeverity(severities);

    const avgConfidence = cluster.reduce((sum, i) => sum + i.confidence, 0) / cluster.length;

    const affectedCallIds = Array.from(new Set(cluster.map(i => i.callId)));

    // Collect all unique explanations
    const allExplanations = Array.from(new Set(cluster.map(i => i.explanation)));

    // Create pattern summary
    const pattern = allExplanations.length > 1
      ? `${allExplanations.length} similar findings across ${affectedCallIds.length} call${affectedCallIds.length !== 1 ? 's' : ''}`
      : allExplanations[0];

    // Get sample evidence
    const evidenceSnippets = Array.from(
      new Set(cluster.map(i => i.evidenceSnippet))
    ).slice(0, 3);

    // Use the most specific type name from the cluster
    const issueType = selectBestTypeName(cluster.map(i => i.type));

    // Get all source check names
    const sourceChecks = Array.from(
      new Set(cluster.map(i => i.sourceCheckName).filter(Boolean))
    );

    return {
      id: `custom-agg-${index}`,
      type: issueType,
      pattern: sourceChecks.length > 0 ? `[${sourceChecks.join(', ')}] ${pattern}` : pattern,
      severity: highestSeverity,
      avgConfidence: Math.round(avgConfidence),
      occurrences: affectedCallIds.length,
      affectedCallIds,
      instances: cluster,
      evidenceSnippets
    };
  }).sort((a, b) => {
    if (b.occurrences !== a.occurrences) {
      return b.occurrences - a.occurrences;
    }
    return severityWeight(b.severity) - severityWeight(a.severity);
  });
}

/**
 * Determines if two issues are similar enough to be grouped together
 * Uses multiple similarity signals: evidence overlap, explanation similarity, line proximity
 */
function isSimilarIssue(issue1: DetectedIssue, issue2: DetectedIssue): boolean {
  // Must be from same call
  if (issue1.callId !== issue2.callId) return false;

  // Check if they have overlapping line numbers (same conversation segment)
  const lines1 = new Set(issue1.lineNumbers);
  const lines2 = new Set(issue2.lineNumbers);
  const lineOverlap = [...lines1].some(line => lines2.has(line));

  // Check explanation similarity
  const explanationSimilarity = calculateTextSimilarity(issue1.explanation, issue2.explanation);

  // Check evidence similarity
  const evidenceSimilarity = calculateTextSimilarity(issue1.evidenceSnippet, issue2.evidenceSnippet);

  // Consider similar if:
  // 1. They overlap in lines AND have similar explanations (>40%)
  // 2. They have very similar explanations (>60%) even if different lines
  // 3. They have nearly identical evidence (>70%)
  if (lineOverlap && explanationSimilarity > 0.4) return true;
  if (explanationSimilarity > 0.6) return true;
  if (evidenceSimilarity > 0.7) return true;

  return false;
}

/**
 * Calculate text similarity using word overlap (Jaccard similarity)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  // Normalize and tokenize
  const words1 = tokenize(text1);
  const words2 = tokenize(text2);

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  // Calculate intersection
  let intersection = 0;
  for (const word of set1) {
    if (set2.has(word)) intersection++;
  }

  // Calculate union
  const union = set1.size + set2.size - intersection;

  if (union === 0) return 0;
  return intersection / union;
}

/**
 * Tokenize text into meaningful words (filter stop words and short words)
 */
function tokenize(text: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'this', 'that', 'these', 'those']);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word)); // Filter stop words and short words
}

/**
 * Select the best (most specific) type name from a list
 */
function selectBestTypeName(types: string[]): string {
  const uniqueTypes = Array.from(new Set(types));

  // Standard types (less specific)
  const standardTypes = ['flow_deviation', 'repetition_loop', 'language_mismatch', 'mid_call_restart', 'quality_issue'];

  // Prefer custom type names over standard ones
  const customTypes = uniqueTypes.filter(t => !standardTypes.includes(t));

  if (customTypes.length > 0) {
    // Return the most common custom type
    const typeCounts = customTypes.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0];
  }

  // Fall back to most common type
  const typeCounts = uniqueTypes.reduce((acc, type) => {
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Get the highest severity from a list
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
