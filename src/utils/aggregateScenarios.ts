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
 * Calculate similarity between two strings (0-1 score)
 * Uses token-based comparison with Jaccard similarity
 */
function calculateSimilarity(str1: string, str2: string): number {
  const normalize = (s: string) => s.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  const tokens1 = new Set(normalize(str1));
  const tokens2 = new Set(normalize(str2));

  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
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
export function aggregateScenarios(scenarios: Scenario[]): AggregatedScenario[] {
  if (scenarios.length === 0) return [];

  // Step 1: Group by dimension and root cause
  const primaryGroups = scenarios.reduce((acc, scenario) => {
    const dimension = scenario.dimension || 'Uncategorized';
    const rootCause = scenario.rootCauseType || 'unknown';
    const key = `${dimension}||${rootCause}`;

    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(scenario);
    return acc;
  }, {} as Record<string, Scenario[]>);

  const aggregated: AggregatedScenario[] = [];

  // Step 2: Within each primary group, cluster by title similarity
  for (const [primaryKey, groupScenarios] of Object.entries(primaryGroups)) {
    const [dimension, rootCause] = primaryKey.split('||');
    const clusters: Scenario[][] = [];

    // Cluster scenarios with similar titles
    for (const scenario of groupScenarios) {
      let addedToCluster = false;

      for (const cluster of clusters) {
        // Check if this scenario is similar to any scenario in the cluster
        const similarityScores = cluster.map(s => calculateSimilarity(scenario.title, s.title));
        const maxSimilarity = Math.max(...similarityScores);

        // Similarity threshold: 0.6 (60% similar)
        if (maxSimilarity >= 0.6) {
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
