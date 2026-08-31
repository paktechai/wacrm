import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AgentsPage from './page';

describe('AI Agents initial shell', () => {
  it('renders the heading and tabs without waiting for configuration data', () => {
    const html = renderToStaticMarkup(<AgentsPage />);

    expect(html).toContain('AI Relationship Agents &amp; Copilot');
    expect(html).toContain('Agent profiles');
    expect(html).toContain('Copilot');
    expect(html).toContain('Playground');
    expect(html).toContain('Provider setup');
    expect(html).toContain('Loading AI agents');
    expect(html).not.toContain('Failed to load AI configuration');
  });
});
