import type { ReactNode } from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type AiConfigLoadStatus = 'loading' | 'success' | 'error';

interface AiConfigLoadStateProps {
  status: AiConfigLoadStatus;
  loadingLabel: string;
  errorTitle: string;
  errorMessage?: string | null;
  retryLabel: string;
  onRetry: () => void;
  children: ReactNode;
}

/**
 * Keeps the provider form mutually exclusive with its loading/error states.
 * In particular, a loading request must never reuse the error copy.
 */
export function AiConfigLoadState({
  status,
  loadingLabel,
  errorTitle,
  errorMessage,
  retryLabel,
  onRetry,
  children,
}: AiConfigLoadStateProps) {
  if (status === 'loading') {
    return (
      <div
        data-testid="ai-config-loading"
        className="flex items-center justify-center py-16 text-muted-foreground"
      >
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {loadingLabel}
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        data-testid="ai-config-error"
        role="alert"
        className="flex flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-12 text-center"
      >
        <AlertCircle className="h-6 w-6 text-destructive" />
        <div>
          <p className="font-medium text-foreground">{errorTitle}</p>
          {errorMessage && errorMessage !== errorTitle && (
            <p className="mt-1 text-sm text-muted-foreground">{errorMessage}</p>
          )}
        </div>
        <Button type="button" variant="outline" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {retryLabel}
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
