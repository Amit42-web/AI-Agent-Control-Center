import { formatWhatHappenedText, parseFormattedText } from '../textFormatting';

describe('formatWhatHappenedText', () => {
  it('should format text with lettered enumeration (a), (b), (c)', () => {
    const input = 'The agent: (a) skipped the required identity confirmation, (b) did not perform Step 2, and (c) asked the customer to enter the pincode via dial pad';
    const result = formatWhatHappenedText(input);

    expect(result).toContain('The agent:');
    expect(result).toContain('• skipped the required identity confirmation');
    expect(result).toContain('• did not perform Step 2');
    expect(result).toContain('• asked the customer to enter the pincode via dial pad');
  });

  it('should format text with numbered enumeration (1), (2), (3)', () => {
    const input = 'The process failed because: (1) invalid credentials were provided, (2) the server timed out, and (3) no fallback was configured';
    const result = formatWhatHappenedText(input);

    expect(result).toContain('The process failed because:');
    expect(result).toContain('• invalid credentials were provided');
    expect(result).toContain('• the server timed out');
    expect(result).toContain('• no fallback was configured');
  });

  it('should return original text if no enumeration is found', () => {
    const input = 'The agent did not follow the script properly.';
    const result = formatWhatHappenedText(input);

    expect(result).toBe(input);
  });

  it('should handle text with only one enumeration item', () => {
    const input = 'The agent: (a) failed to verify identity';
    const result = formatWhatHappenedText(input);

    // With only 1 item, should return original
    expect(result).toBe(input);
  });

  it('should handle complex nested clauses', () => {
    const input = 'The customer did not confirm identity but instead said they wanted to give their pincode. The agent: (a) skipped the required identity confirmation fallback (asking for first/last name if not confirmed), (b) did not perform Step 2 (bike confirmation), Step 3 (purchase timeline), or Step 4 (dealership visit), and (c) after hearing the pincode was wrong, asked the customer to enter the pincode via dial pad';
    const result = formatWhatHappenedText(input);

    expect(result).toContain('• skipped the required identity confirmation fallback');
    expect(result).toContain('• did not perform Step 2');
    expect(result).toContain('• after hearing the pincode was wrong');
  });
});

describe('parseFormattedText', () => {
  it('should parse text with bullet points', () => {
    const input = 'The agent:\n• First issue\n• Second issue\n• Third issue';
    const result = parseFormattedText(input);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ type: 'text', content: 'The agent:' });
    expect(result[1]).toEqual({ type: 'bullet', content: 'First issue' });
    expect(result[2]).toEqual({ type: 'bullet', content: 'Second issue' });
    expect(result[3]).toEqual({ type: 'bullet', content: 'Third issue' });
  });

  it('should parse plain text without bullets', () => {
    const input = 'Simple text without bullets';
    const result = parseFormattedText(input);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'text', content: 'Simple text without bullets' });
  });

  it('should handle empty lines', () => {
    const input = 'Line 1\n\nLine 2';
    const result = parseFormattedText(input);

    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('Line 1');
    expect(result[1].content).toBe('Line 2');
  });
});
