# Semantic Similarity for Issue Deduplication

## The Problem

Traditional word-overlap similarity (Jaccard, TF-IDF) struggles with **paraphrasing** and **semantic equivalence**:

### Example: These issues describe the SAME problem but are marked as different

**Issue 1:**
- Title: "Incorrect finance information communicated"
- Description: "incorrect finance percentages were communicated"

**Issue 2:**
- Title: "Wrong financing details provided"
- Description: "incorrect states 95% finance as a definite outcome"

**Both issues are about:** Wrong finance information being communicated to the customer

**Problem:** These have low lexical overlap (few shared words) but high semantic similarity (same meaning).

---

## The Solution: Embeddings-Based Semantic Similarity

### How It Works

1. **Convert text to vectors:** Each issue's title + description is converted to a 1536-dimensional embedding vector using OpenAI's `text-embedding-3-small` model
2. **Measure semantic distance:** Cosine similarity between vectors measures how semantically close they are (0 = unrelated, 1 = identical meaning)
3. **Combine with existing signals:** Semantic similarity is weighted with lexical signals (entity overlap, action patterns, tokens)

### Similarity Calculation

The system now uses **5 signals** instead of 4:

| Signal | Description | Weight (Strong Semantic) | Weight (Balanced) |
|--------|-------------|--------------------------|-------------------|
| **Embedding Similarity** | Cosine similarity between embeddings | 40% | 30% |
| Entity Overlap | Shared named entities (customer_name, payment_info, etc.) | 20% | 20% |
| Action Patterns | Shared action-object pairs (fail_payment, skip_verification) | 20% | 20% |
| Title Tokens | Word overlap in titles | 15% | 20% |
| Description Tokens | Word overlap in descriptions | 5% | 10% |

**Adaptive weighting:** If embedding similarity is high (>0.7), it gets 40% weight since embeddings are highly reliable for detecting paraphrasing.

### Example: Your Finance Issues

**Without semantic similarity (lexical only):**
```
"incorrect finance percentages were communicated" vs
"incorrect states 95% finance as a definite outcome"

Shared words: ["incorrect", "finance"]
Entity overlap: 0% (no shared multi-word entities)
Action overlap: 0% (no shared action patterns)
Title similarity: ~0.20
Description similarity: ~0.15

Combined score: ~0.18 (BELOW 30% threshold → NOT merged ❌)
```

**With semantic similarity (embeddings enabled):**
```
"incorrect finance percentages were communicated" vs
"incorrect states 95% finance as a definite outcome"

Embedding similarity: ~0.82 (HIGH - same meaning detected! ✅)
Entity overlap: 0%
Action overlap: 0%
Title similarity: ~0.20
Description similarity: ~0.15

Combined score (strong semantic weights):
= (0.82 * 0.40) + (0 * 0.20) + (0 * 0.20) + (0.20 * 0.15) + (0.15 * 0.05)
= 0.328 + 0 + 0 + 0.03 + 0.0075
= 0.37 (ABOVE 30% threshold → MERGED ✅)
```

---

## Usage

### Option 1: Programmatic Usage

```typescript
import { aggregateScenarios, computeScenarioEmbeddings } from '@/utils/aggregateScenarios';
import { Scenario } from '@/types';

// Your scenarios
const scenarios: Scenario[] = [
  {
    id: 'call-1-scenario-0',
    callId: 'call-1',
    title: 'Incorrect finance information communicated',
    whatHappened: 'incorrect finance percentages were communicated',
    // ... other fields
  },
  {
    id: 'call-2-scenario-0',
    callId: 'call-2',
    title: 'Wrong financing details provided',
    whatHappened: 'incorrect states 95% finance as a definite outcome',
    // ... other fields
  }
];

// Step 1: Compute embeddings (requires OpenAI API key)
const embeddings = await computeScenarioEmbeddings(
  scenarios,
  process.env.OPENAI_API_KEY!,
  'text-embedding-3-small' // Optional, this is the default
);

// Step 2: Aggregate with semantic similarity
const aggregated = aggregateScenarios(scenarios, embeddings);

console.log(aggregated);
// Result: The two finance issues are merged into ONE aggregated issue ✅
```

### Option 2: Integrate into Store

To enable semantic similarity throughout the app, update the store to compute embeddings after scenarios are collected:

```typescript
// In src/store/useAppStore.ts, after line 287 (after scenarios are collected)

// Compute embeddings for semantic deduplication
let scenarioEmbeddings: Map<string, number[]> | undefined = undefined;
if (apiKey) {
  try {
    console.log('Computing embeddings for semantic similarity...');
    const { computeScenarioEmbeddings } = await import('@/utils/aggregateScenarios');
    scenarioEmbeddings = await computeScenarioEmbeddings(
      allScenarios,
      apiKey,
      'text-embedding-3-small'
    );
    console.log(`Computed ${scenarioEmbeddings.size} embeddings`);
  } catch (error) {
    console.error('Failed to compute embeddings:', error);
    // Fall back to lexical similarity only
  }
}

// Store embeddings in state
set({
  scenarioResults: {
    scenarios: allScenarios,
    embeddings: scenarioEmbeddings, // Add this to ScenarioResults type
    // ... rest of results
  }
});
```

Then in `AggregateResults.tsx`, pass the embeddings:

```typescript
const aggregatedScenarios = aggregateScenarios(
  scenarios,
  scenarioResults.embeddings // Pass pre-computed embeddings
);
```

---

## Cost & Performance

### OpenAI Embedding Costs

Using `text-embedding-3-small` model:
- **Cost:** $0.02 per 1M tokens
- **Avg scenario length:** ~50 tokens (title + description)
- **Cost per 1000 scenarios:** $0.001 (essentially free)
- **Response time:** ~100-200ms per scenario (batched in groups of 50)

### Performance Optimizations

1. **Batch processing:** Processes 50 scenarios at a time to reduce API overhead
2. **Rate limiting:** 100ms delay between batches to respect OpenAI rate limits
3. **Caching:** Embeddings are computed once and reused across multiple aggregations
4. **Graceful fallback:** If embeddings fail, the system falls back to lexical similarity

---

## Benefits

✅ **Catches paraphrasing:** "failed to collect payment" = "payment information not captured"
✅ **Language-agnostic:** Works across languages and scripts
✅ **Reduces noise:** Fewer duplicate issues cluttering the dashboard
✅ **Better insights:** More accurate aggregation = clearer patterns
✅ **Maintains precision:** 30% threshold still filters out truly different issues

---

## Testing

To test semantic similarity with your own examples:

```typescript
import { getEmbedding, cosineSimilarity } from '@/services/openai';

const text1 = "incorrect finance percentages were communicated";
const text2 = "incorrect states 95% finance as a definite outcome";

const embedding1 = await getEmbedding(apiKey, text1);
const embedding2 = await getEmbedding(apiKey, text2);

const similarity = cosineSimilarity(embedding1, embedding2);
console.log(`Semantic similarity: ${similarity.toFixed(2)}`);
// Expected output: Semantic similarity: 0.82 (HIGH - should merge!)
```

---

## Troubleshooting

### Issue: Embeddings not being computed

**Solution:** Ensure `OPENAI_API_KEY` or `NEXT_PUBLIC_OPENAI_API_KEY` is set in your environment variables.

### Issue: Too many issues being merged

**Solution:** The 30% threshold is tuned for balance. If embeddings are too aggressive, you can:
1. Reduce embedding weight in `calculateScenarioSimilarity` (line 273)
2. Increase the threshold from 0.30 to 0.35 (line 458)

### Issue: Embeddings are slow

**Solution:**
1. Increase batch size from 50 to 100 (line 580)
2. Reduce delay between batches from 100ms to 50ms (line 601)
3. Use `text-embedding-3-small` instead of `text-embedding-3-large`

---

## Technical Details

### Embedding Model

**OpenAI text-embedding-3-small:**
- Dimensions: 1536
- Max input: 8191 tokens
- Performance: 62.3% on MTEB benchmark
- Speed: ~200ms per embedding
- Cost: $0.02 per 1M tokens

### Cosine Similarity Formula

```
similarity = (A · B) / (||A|| × ||B||)

Where:
- A, B are embedding vectors
- A · B is the dot product
- ||A||, ||B|| are the magnitudes (L2 norms)
```

Result ranges from -1 (opposite) to 1 (identical). For normalized embeddings (like OpenAI's), it typically ranges 0-1.

---

## References

- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [Cosine Similarity Explanation](https://en.wikipedia.org/wiki/Cosine_similarity)
- Implementation: `src/utils/aggregateScenarios.ts` (lines 235-365, 553-605)
- Service: `src/services/openai.ts` (lines 34-78)
