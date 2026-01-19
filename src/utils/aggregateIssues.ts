import { DetectedIssue, AggregatedIssue, Severity } from '@/types';

/**
 * Aggregates similar issues across multiple calls by grouping them by type
 * and finding common patterns in their explanations
 */
export function aggregateIssues(issues: DetectedIssue[]): AggregatedIssue[] {
  // Group issues by type
  const issuesByType = issues.reduce((acc, issue) => {
    if (!acc[issue.type]) {
      acc[issue.type] = [];
    }
    acc[issue.type].push(issue);
    return acc;
  }, {} as Record<string, DetectedIssue[]>);

  const aggregated: AggregatedIssue[] = [];

  // For each type, try to find common patterns
  for (const [type, typeIssues] of Object.entries(issuesByType)) {
    // Further group by similarity in explanation
    const groups = groupBySimilarity(typeIssues);

    groups.forEach((group, index) => {
      const severities = group.map(i => i.severity);
      const highestSeverity = getHighestSeverity(severities);

      const avgConfidence = group.reduce((sum, i) => sum + i.confidence, 0) / group.length;

      const affectedCallIds = Array.from(new Set(group.map(i => i.callId)));

      // Extract common pattern from explanations
      const pattern = extractCommonPattern(group.map(i => i.explanation));

      // Get sample evidence (up to 3 unique examples)
      const evidenceSnippets = Array.from(
        new Set(group.map(i => i.evidenceSnippet))
      ).slice(0, 3);

      aggregated.push({
        id: `agg-${type}-${index}`,
        type: type as any,
        pattern,
        severity: highestSeverity,
        avgConfidence: Math.round(avgConfidence),
        occurrences: affectedCallIds.length,
        affectedCallIds,
        instances: group,
        evidenceSnippets
      });
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
 * Group issues by similarity in their explanations
 * Issues with very similar explanations are grouped together
 */
function groupBySimilarity(issues: DetectedIssue[]): DetectedIssue[][] {
  if (issues.length === 0) return [];

  // Simple grouping: if explanations are very similar (>70% overlap), group them
  const groups: DetectedIssue[][] = [];

  for (const issue of issues) {
    let addedToGroup = false;

    for (const group of groups) {
      // Check if this issue is similar to the first issue in the group
      if (isSimilarExplanation(issue.explanation, group[0].explanation)) {
        group.push(issue);
        addedToGroup = true;
        break;
      }
    }

    if (!addedToGroup) {
      groups.push([issue]);
    }
  }

  return groups;
}

/**
 * Check if two explanations are similar
 */
function isSimilarExplanation(exp1: string, exp2: string): boolean {
  // Convert to lowercase and extract key phrases
  const words1 = exp1.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const words2 = exp2.toLowerCase().split(/\W+/).filter(w => w.length > 3);

  const set1 = new Set(words1);
  const set2 = new Set(words2);

  // Count common words
  let commonCount = 0;
  for (const word of set1) {
    if (set2.has(word)) commonCount++;
  }

  // Calculate similarity ratio
  const similarity = (2 * commonCount) / (set1.size + set2.size);

  return similarity > 0.5; // 50% similarity threshold
}

/**
 * Extract a common pattern from multiple explanations
 * Takes the first explanation as the pattern (most representative)
 */
function extractCommonPattern(explanations: string[]): string {
  if (explanations.length === 0) return 'Issue detected';
  if (explanations.length === 1) return explanations[0];

  // Use the first explanation as the pattern
  // In a more sophisticated version, we could extract common themes
  return explanations[0];
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
