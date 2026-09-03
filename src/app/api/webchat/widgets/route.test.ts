import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
}));

vi.mock('@/lib/auth/account', () => ({
  requireRole: mocks.requireRole,
  toErrorResponse: vi.fn(() =>
    Response.json({ error: 'failed' }, { status: 500 })
  ),
}));

vi.mock('@/lib/audit/tenant', () => ({ writeTenantAudit: vi.fn() }));

import { POST } from './route';

function request(body: unknown) {
  return new Request('http://localhost/api/webchat/widgets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.from.mockReset();
  mocks.insert.mockReset();
  mocks.select.mockReset();
  mocks.single.mockReset();
  mocks.requireRole.mockReset();
  mocks.requireRole.mockResolvedValue({
    supabase: { from: mocks.from },
    accountId: 'account-1',
    userId: 'user-1',
  });
  mocks.from.mockReturnValue({ insert: mocks.insert });
  mocks.insert.mockReturnValue({ select: mocks.select });
  mocks.select.mockReturnValue({ single: mocks.single });
});

describe('POST /api/webchat/widgets validation', () => {
  it('rejects missing widget fields before querying the database', async () => {
    const response = await POST(
      request({ name: '', welcomeMessage: '', allowedOrigins: [] })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.fields).toMatchObject({
      name: expect.any(String),
      welcomeMessage: expect.any(String),
      allowedOrigins: expect.any(String),
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('rejects malformed origins instead of silently discarding them', async () => {
    const response = await POST(
      request({
        name: 'Sales chat',
        welcomeMessage: 'Hello',
        allowedOrigins: ['example.com'],
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.fields.allowedOrigins).toContain('http:// or https://');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('persists a valid widget with normalized origins', async () => {
    const widget = {
      id: 'widget-1',
      public_key: 'public-1',
      name: 'Sales chat',
      welcome_message: 'Hello',
      allowed_origins: ['https://example.com'],
      is_active: true,
    };
    mocks.single.mockResolvedValue({ data: widget, error: null });

    const response = await POST(
      request({
        name: ' Sales chat ',
        welcomeMessage: ' Hello ',
        allowedOrigins: ['https://example.com/path', 'https://example.com'],
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.requireRole).toHaveBeenCalledWith('admin');
    expect(mocks.from).toHaveBeenCalledWith('webchat_widgets');
    expect(mocks.insert).toHaveBeenCalledWith({
      account_id: 'account-1',
      created_by: 'user-1',
      name: 'Sales chat',
      welcome_message: 'Hello',
      allowed_origins: ['https://example.com'],
    });
    expect(payload.widget).toEqual(widget);
  });
});
