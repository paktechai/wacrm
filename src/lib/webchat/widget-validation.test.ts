import { describe, expect, it } from 'vitest';
import { validateWidgetDraft } from './widget-validation';

describe('validateWidgetDraft', () => {
  it('normalizes valid origins and removes duplicates', () => {
    expect(
      validateWidgetDraft({
        name: 'Sales chat',
        welcomeMessage: 'How can we help?',
        allowedOrigins: ['https://example.com/path', 'https://example.com'],
      })
    ).toEqual({
      ok: true,
      value: {
        name: 'Sales chat',
        welcomeMessage: 'How can we help?',
        allowedOrigins: ['https://example.com'],
      },
    });
  });

  it('returns inline errors for missing required fields', () => {
    const result = validateWidgetDraft({
      name: '',
      welcomeMessage: '',
      allowedOrigins: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual({
        name: 'Enter a widget name.',
        welcomeMessage: 'Enter a greeting message.',
        allowedOrigins: 'Enter at least one allowed website origin.',
      });
    }
  });

  it.each([
    ['host without protocol', ['example.com']],
    ['unsupported protocol', ['ftp://example.com']],
    ['credential-bearing URL', ['https://user:pass@example.com']],
    ['mixed valid and invalid origins', ['https://example.com', 'invalid']],
  ])('rejects %s', (_label, allowedOrigins) => {
    const result = validateWidgetDraft({
      name: 'Support',
      welcomeMessage: 'Hello',
      allowedOrigins,
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors.allowedOrigins).toContain(
        'complete http:// or https://'
      );
  });
});
