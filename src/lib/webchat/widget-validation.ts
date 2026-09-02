export type WidgetFieldErrors = Partial<
  Record<'name' | 'welcomeMessage' | 'allowedOrigins' | 'form', string>
>;

type WidgetDraft = {
  name: unknown;
  welcomeMessage: unknown;
  allowedOrigins: unknown;
};

type ValidWidgetDraft = {
  name: string;
  welcomeMessage: string;
  allowedOrigins: string[];
};

export function validateWidgetDraft(
  draft: WidgetDraft
):
  | { ok: true; value: ValidWidgetDraft }
  | { ok: false; errors: WidgetFieldErrors } {
  const errors: WidgetFieldErrors = {};
  const name = typeof draft.name === 'string' ? draft.name.trim() : '';
  const welcomeMessage =
    typeof draft.welcomeMessage === 'string' ? draft.welcomeMessage.trim() : '';

  if (!name) errors.name = 'Enter a widget name.';
  else if (name.length > 120)
    errors.name = 'Widget name must be 120 characters or fewer.';

  if (!welcomeMessage) errors.welcomeMessage = 'Enter a greeting message.';
  else if (welcomeMessage.length > 500) {
    errors.welcomeMessage = 'Greeting message must be 500 characters or fewer.';
  }

  const rawOrigins = Array.isArray(draft.allowedOrigins)
    ? draft.allowedOrigins
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean)
    : [];
  const allowedOrigins = new Set<string>();
  let invalidOrigin = false;

  for (const rawOrigin of rawOrigins) {
    try {
      const parsed = new URL(rawOrigin);
      if (
        !['http:', 'https:'].includes(parsed.protocol) ||
        parsed.username ||
        parsed.password ||
        parsed.origin === 'null'
      ) {
        invalidOrigin = true;
        continue;
      }
      allowedOrigins.add(parsed.origin);
    } catch {
      invalidOrigin = true;
    }
  }

  if (rawOrigins.length === 0) {
    errors.allowedOrigins = 'Enter at least one allowed website origin.';
  } else if (invalidOrigin) {
    errors.allowedOrigins =
      'Use complete http:// or https:// origins separated by commas.';
  } else if (allowedOrigins.size > 25) {
    errors.allowedOrigins = 'A widget can have up to 25 allowed origins.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: { name, welcomeMessage, allowedOrigins: [...allowedOrigins] },
  };
}
