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
 * Extract key business entities from agent issue text
 * These are domain-specific terms that identify what the issue is about
 */
function extractBusinessEntities(text: string): Set<string> {
  const normalizedText = text.toLowerCase();
  const entities = new Set<string>();

  // Define key business entities to extract
  const entityPatterns: Record<string, RegExp[]> = {
    'bike': [/\bbike\b/gi, /\bvehicle\b/gi],
    'timeline': [/\btimeline\b/gi, /\btime\s*line\b/gi],
    'pincode': [/\bpincode\b/gi, /\bpin\s*code\b/gi, /\bzip\s*code\b/gi, /\bpostal\s*code\b/gi],
    'showroom': [/\bshowroom\b/gi, /\bdealer\b/gi, /\bbranch\b/gi],
    'customer_name': [/\bcustomer\s+name\b/gi, /\bname\s+capture\b/gi, /\bname\s+verification\b/gi, /\bidentity\b/gi, /\bcustomer\s+(?:info|information|details)\b/gi],
    'qualification': [/\bqualification\b/gi, /\bqualify\b/gi, /\bverification\b/gi, /\bverify\b/gi],
    'flow': [/\bflow\b/gi, /\bprocess\b/gi, /\bworkflow\b/gi],
    'mandatory_step': [/\bmandatory\b/gi, /\brequired\b/gi, /\bessential\b/gi, /\bcore\b/gi],
    'skip_action': [/\bskip(?:ped)?\b/gi, /\bmiss(?:ed)?\b/gi, /\bomit(?:ted)?\b/gi, /\bbypass(?:ed)?\b/gi, /\bjump(?:ed)?\b/gi],
    'fail_action': [/\bfail(?:ed)?\b/gi, /\bdidn'?t\b/gi, /\bnever\b/gi, /\bunable\b/gi],
    'progress': [/\bprogress\b/gi, /\bcomplete\b/gi, /\bfinish\b/gi],
  };

  // Extract each entity type
  for (const [entityName, patterns] of Object.entries(entityPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedText)) {
        entities.add(entityName);
        break; // Found this entity, move to next
      }
    }
  }

  return entities;
}

/**
 * Extract key phrases from text (common multi-word patterns in agent issues)
 */
function extractKeyPhrases(text: string): Set<string> {
  const normalizedText = text.toLowerCase();
  const phrases = new Set<string>();

  // Common multi-word patterns in agent issues
  const phrasePatterns = [
    // Bike & timeline related (most specific)
    /(?:bike|vehicle)\s*(?:&|and|,)?\s*(?:timeline|time\s*line)/gi,
    /bike\s+(?:qualification|verification|check|detail|info|data|step)/gi,
    /timeline\s+(?:qualification|verification|check|detail|info|data|step)/gi,
    /(?:bike|vehicle)\s+(?:&|and)\s+(?:timeline|time)/gi,

    // Customer name & identity patterns (NEW)
    /(?:customer\s+)?name\s+(?:capture|verification|check|collection|identity)/gi,
    /(?:capture|collect|verify|confirm|get|obtain|gather)\s+(?:customer\s+)?(?:name|identity)/gi,
    /(?:skip|miss|omit|bypass|fail)(?:ped|ed)?\s+(?:to\s+)?(?:capture|collect|verify|get)\s+(?:customer\s+)?name/gi,
    /(?:not|never|didn'?t)\s+(?:capture|collect|verify|get|obtain)\s+(?:correct\s+)?(?:customer\s+)?name/gi,
    /name\s+(?:after|when|during)\s+(?:mismatch|confirm|identity)/gi,

    // Core flow patterns
    /core\s+flow\s+(?:steps|process)/gi,
    /(?:qualification|verification)\s+(?:flow|process|step)/gi,
    /(?:mandatory|required|essential)\s+(?:steps|flow|check|process)/gi,

    // Skip/miss/fail patterns - EXPANDED
    /(?:skip|miss|omit|bypass|jump)(?:ped|ed)?\s+(?:steps|flow|process|check|qualification|verification)/gi,
    /(?:skip|miss|omit|bypass|jump)(?:ped|ed)?\s+(?:mandatory|required|core)/gi,
    /(?:fail|unable|didn'?t|never)\s+(?:to\s+)?(?:progress|complete|finish|capture|collect)/gi,
    /(?:not|never)\s+(?:captured|collected|gathered|obtained|completed)/gi,

    // Jump/move/progress patterns
    /jump(?:ed)?\s+(?:directly|straight|immediately)\s+to/gi,
    /moved?\s+(?:directly|straight|immediately)\s+to/gi,
    /bypassed?\s+(?:and|to)/gi,
    /progress(?:ed)?\s+through/gi,

    // Specific location/action combinations
    /(?:to|at|through)\s+(?:pincode|timeline|showroom|bike)/gi,
    /(?:flow|process)\s+(?:deviation|violation)/gi,
  ];

  for (const pattern of phrasePatterns) {
    const matches = normalizedText.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Normalize the matched phrase
        const normalized = match.replace(/\s+/g, '_').replace(/[&,]/g, 'and');
        phrases.add(normalized);
      });
    }
  }

  return phrases;
}

/**
 * Calculate similarity between two strings (0-1 score)
 * Uses token-based comparison with Jaccard similarity
 * Filters stop words and handles common synonyms
 */
function calculateTokenSimilarity(str1: string, str2: string): number {
  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'from', 'by', 'as', 'is', 'was', 'are', 'been', 'be',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those',
    'not', 'no', 'yes'
  ]);

  // Expanded synonym mappings
  const synonymMap: Record<string, string> = {
    'required': 'mandatory',
    'mandatory': 'mandatory',
    'skipped': 'missed',
    'missed': 'missed',
    'omitted': 'missed',
    'jumped': 'missed',
    'moved': 'missed',
    'bypassed': 'missed',
    'flow': 'process',
    'process': 'process',
    'steps': 'process',
    'procedure': 'process',
    'workflow': 'process',
    'qualification': 'verify',
    'verification': 'verify',
    'validate': 'verify',
    'check': 'verify',
    'captured': 'collect',
    'collected': 'collect',
    'gathered': 'collect',
    'obtained': 'collect',
    'name': 'name',
    'identity': 'name',
    'customer': 'customer',
    'timeline': 'timeline',
    'bike': 'bike',
    'core': 'core',
    'directly': 'directly',
    'pincode': 'pincode',
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
 * Uses multiple signals: business entities, phrase matching, title similarity, and description similarity
 */
function calculateScenarioSimilarity(scenario1: Scenario, scenario2: Scenario): number {
  const fullText1 = scenario1.title + ' ' + scenario1.whatHappened;
  const fullText2 = scenario2.title + ' ' + scenario2.whatHappened;

  // Signal 1: Business entity overlap (NEW - highest priority)
  // If they mention the same business concepts (bike, timeline, pincode), they're likely related
  const entities1 = extractBusinessEntities(fullText1);
  const entities2 = extractBusinessEntities(fullText2);

  let entitySimilarity = 0;
  if (entities1.size > 0 || entities2.size > 0) {
    const entityIntersection = new Set([...entities1].filter(x => entities2.has(x)));
    const entityUnion = new Set([...entities1, ...entities2]);
    entitySimilarity = entityUnion.size > 0 ? entityIntersection.size / entityUnion.size : 0;

    // BOOST: If they share multiple critical entities (timeline, pincode, bike, customer_name, etc.),
    // they're very likely the same issue
    const criticalSharedEntities = [...entityIntersection].filter(e =>
      ['bike', 'timeline', 'pincode', 'showroom', 'customer_name'].includes(e)
    );
    if (criticalSharedEntities.length >= 2) {
      // Boost entity similarity if they share 2+ critical business entities
      entitySimilarity = Math.min(1.0, entitySimilarity * 1.5);
    }
  }

  // Signal 2: Key phrase matching
  const phrases1 = extractKeyPhrases(fullText1);
  const phrases2 = extractKeyPhrases(fullText2);

  let phraseSimilarity = 0;
  if (phrases1.size > 0 || phrases2.size > 0) {
    const phraseIntersection = new Set([...phrases1].filter(x => phrases2.has(x)));
    const phraseUnion = new Set([...phrases1, ...phrases2]);
    phraseSimilarity = phraseUnion.size > 0 ? phraseIntersection.size / phraseUnion.size : 0;
  }

  // Signal 3: Title token similarity
  const titleSimilarity = calculateTokenSimilarity(scenario1.title, scenario2.title);

  // Signal 4: Description similarity (what happened)
  const descSimilarity = calculateTokenSimilarity(scenario1.whatHappened, scenario2.whatHappened);

  // Weighted combination with NEW entity-based signal:
  // - Entity similarity: 40% (highest - if they mention same business concepts, likely same issue)
  // - Phrase similarity: 30% (catches action patterns like "skipped" vs "failed to progress")
  // - Title similarity: 20% (important for matching)
  // - Description similarity: 10% (supporting signal)
  const combinedSimilarity =
    (entitySimilarity * 0.4) +
    (phraseSimilarity * 0.3) +
    (titleSimilarity * 0.2) +
    (descSimilarity * 0.1);

  return combinedSimilarity;
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

  // Step 2: Within each primary group, cluster by title similarity
  for (const [primaryKey, groupScenarios] of Object.entries(primaryGroups)) {
    const [dimension, rootCause] = primaryKey.split('||');
    const clusters: Scenario[][] = [];

    // Cluster scenarios with similar titles and descriptions
    for (const scenario of groupScenarios) {
      let addedToCluster = false;

      for (const cluster of clusters) {
        // Check if this scenario is similar to any scenario in the cluster
        // Use comprehensive similarity that considers entities, phrases, title, and description
        const similarityScores = cluster.map(s => calculateScenarioSimilarity(scenario, s));
        const maxSimilarity = Math.max(...similarityScores);

        // Similarity threshold: 0.25 (25% weighted similarity)
        // Lower threshold appropriate for our sophisticated 4-signal weighted similarity:
        // - Business entity overlap: 40% weight (e.g., both mention "timeline" + "pincode")
        // - Key phrase matching: 30% weight (e.g., "skipped steps" vs "failed to progress")
        // - Title token similarity: 20% weight
        // - Description similarity: 10% weight
        // This catches semantically identical issues even with completely different wording
        if (maxSimilarity >= 0.25) {
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
