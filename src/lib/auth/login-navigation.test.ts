import { describe, expect, it, vi } from 'vitest';
import {
  getPostLoginDestination,
  navigateAfterLogin,
} from './login-navigation';

describe('post-login navigation', () => {
  it('uses the dashboard for a normal successful login', () => {
    expect(getPostLoginDestination(null)).toBe('/dashboard');
  });

  it('preserves and encodes an invitation destination', () => {
    expect(getPostLoginDestination('invite/a b')).toBe('/join/invite%2Fa%20b');
  });

  it('performs exactly one full-page navigation', () => {
    const assign = vi.fn();

    navigateAfterLogin('/dashboard', { assign });

    expect(assign).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith('/dashboard');
  });
});
