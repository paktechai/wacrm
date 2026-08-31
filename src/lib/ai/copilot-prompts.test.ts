import { describe, expect, it } from 'vitest';
import { buildCopilotTransformPrompt } from './copilot-prompts';

describe('Copilot language transform prompts', () => {
  it.each(['Urdu', 'French'])(
    'makes Translate use the selected %s target without Rewrite behavior',
    (language) => {
      const prompt = buildCopilotTransformPrompt('translate', language);

      expect(prompt).toContain(`selected target language is "${language}"`);
      expect(prompt).toContain('Translate the supplied text faithfully');
      expect(prompt).toContain(
        'do not summarize, expand, omit, or otherwise rewrite'
      );
      expect(prompt).toContain('entirely in the selected target language');
      expect(prompt).not.toContain('Rewrite the supplied draft so');
    }
  );

  it.each(['Urdu', 'English', 'Spanish'])(
    'makes Rewrite return output in the selected %s language',
    (language) => {
      const prompt = buildCopilotTransformPrompt('rewrite', language);

      expect(prompt).toContain(`selected target language is "${language}"`);
      expect(prompt).toContain('Rewrite the supplied draft');
      expect(prompt).toContain(
        'final output is entirely in the selected target language'
      );
      expect(prompt).not.toContain('Translate the supplied text faithfully');
    }
  );

  it('rejects a missing target language for either transform action', () => {
    expect(() => buildCopilotTransformPrompt('translate', '   ')).toThrow(
      'targetLanguage is required'
    );
    expect(() => buildCopilotTransformPrompt('rewrite', '')).toThrow(
      'targetLanguage is required'
    );
  });
});
