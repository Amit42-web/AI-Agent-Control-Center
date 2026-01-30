/**
 * Utility functions for formatting text content
 */

/**
 * Formats long "whatHappened" descriptions by extracting enumerated lists
 * and converting them to bullet points for better readability.
 *
 * Handles patterns like:
 * - "The agent: (a) did X, (b) did Y, and (c) did Z"
 * - "The agent did X: (1) step one, (2) step two"
 * - Nested clauses with enumeration
 *
 * @param text - The whatHappened description text
 * @returns Formatted text with bullet points or original text if no pattern found
 */
export function formatWhatHappenedText(text: string): string {
  if (!text) return text;

  // Pattern 1: Detect "(a), (b), (c)" or "(1), (2), (3)" style enumerations
  // This handles both lettered and numbered lists
  const enumerationPattern = /\(([a-z]|\d+)\)\s+/gi;

  // Check if text contains enumerated items
  const matches = text.match(enumerationPattern);

  if (!matches || matches.length < 2) {
    // Not enough enumeration to warrant reformatting
    return text;
  }

  // Find the preamble text before the first enumeration
  const firstEnumIndex = text.search(enumerationPattern);
  let preamble = text.substring(0, firstEnumIndex).trim();

  // Remove trailing colon or "and" from preamble if present
  preamble = preamble.replace(/[,:]\s*$/, '').trim();
  preamble = preamble.replace(/\s+and\s*$/, '').trim();

  // Split by enumeration markers
  const parts = text.substring(firstEnumIndex).split(enumerationPattern);

  // Filter out the enum markers themselves (a, b, c, 1, 2, 3)
  const items: string[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const content = parts[i + 1];
    if (content) {
      // Clean up the content - remove trailing commas, "and", etc.
      let cleaned = content.trim();
      cleaned = cleaned.replace(/^,\s*/, ''); // Remove leading comma
      cleaned = cleaned.replace(/,?\s+(and|or)\s*$/i, ''); // Remove trailing "and" or "or"
      cleaned = cleaned.replace(/,\s*$/, ''); // Remove trailing comma

      if (cleaned) {
        items.push(cleaned);
      }
    }
  }

  if (items.length === 0) {
    return text; // Fall back to original if parsing failed
  }

  // Construct formatted output with bullet points
  let formatted = preamble;
  if (formatted) {
    formatted += ':\n';
  }

  items.forEach(item => {
    formatted += `• ${item}\n`;
  });

  return formatted.trim();
}

/**
 * Converts formatted text with bullet points to JSX-friendly structure
 * @param text - Text that may contain bullet points
 * @returns Array of text segments with indicators for bullets
 */
export function parseFormattedText(text: string): Array<{ type: 'text' | 'bullet', content: string }> {
  const lines = text.split('\n');
  const segments: Array<{ type: 'text' | 'bullet', content: string }> = [];

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('•')) {
      segments.push({ type: 'bullet', content: trimmed.substring(1).trim() });
    } else if (trimmed) {
      segments.push({ type: 'text', content: trimmed });
    }
  });

  return segments;
}
