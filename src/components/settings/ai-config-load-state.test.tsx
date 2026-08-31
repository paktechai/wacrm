import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AiConfigLoadState } from './ai-config-load-state';

function render(status: 'loading' | 'success' | 'error', errorMessage?: string) {
  return renderToStaticMarkup(
    <AiConfigLoadState
      status={status}
      loadingLabel="Loading AI configuration..."
      errorTitle="Failed to load AI configuration"
      errorMessage={errorMessage}
      retryLabel="Retry"
      onRetry={vi.fn()}
    >
      <div data-testid="provider-form">Saved provider configuration</div>
    </AiConfigLoadState>,
  );
}

describe('AiConfigLoadState', () => {
  it('shows loading copy and spinner without flashing the failure message', () => {
    const html = render('loading');

    expect(html).toContain('data-testid="ai-config-loading"');
    expect(html).toContain('Loading AI configuration...');
    expect(html).not.toContain('Failed to load AI configuration');
    expect(html).not.toContain('provider-form');
  });

  it('renders saved configuration content after a successful load', () => {
    const html = render('success');

    expect(html).toContain('data-testid="provider-form"');
    expect(html).not.toContain('ai-config-loading');
    expect(html).not.toContain('ai-config-error');
  });

  it('shows a meaningful error and retry action only in the error state', () => {
    const html = render('error', 'The server returned status 500.');

    expect(html).toContain('data-testid="ai-config-error"');
    expect(html).toContain('Failed to load AI configuration');
    expect(html).toContain('The server returned status 500.');
    expect(html).toContain('Retry');
    expect(html).not.toContain('provider-form');
  });
});
