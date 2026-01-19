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

  // For each type, create ONE aggregated entry with all issues of that type
  for (const [type, typeIssues] of Object.entries(issuesByType)) {
    const severities = typeIssues.map(i => i.severity);
    const highestSeverity = getHighestSeverity(severities);

    const avgConfidence = typeIssues.reduce((sum, i) => sum + i.confidence, 0) / typeIssues.length;

    const affectedCallIds = Array.from(new Set(typeIssues.map(i => i.callId)));

    // Collect all unique patterns/explanations
    const allPatterns = Array.from(new Set(typeIssues.map(i => i.explanation)));

    // Create a summary pattern showing how many different patterns exist
    const pattern = allPatterns.length > 1
      ? `${allPatterns.length} different patterns identified across ${affectedCallIds.length} call${affectedCallIds.length !== 1 ? 's' : ''}`
      : allPatterns[0];

    // Get sample evidence (up to 3 unique examples)
    const evidenceSnippets = Array.from(
      new Set(typeIssues.map(i => i.evidenceSnippet))
    ).slice(0, 3);

    aggregated.push({
      id: `agg-${type}`,
      type: type as any,
      pattern,
      severity: highestSeverity,
      avgConfidence: Math.round(avgConfidence),
      occurrences: affectedCallIds.length,
      affectedCallIds,
      instances: typeIssues, // All issues of this type
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
