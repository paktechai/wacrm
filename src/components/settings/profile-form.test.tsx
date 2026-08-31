import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const labels: Record<string, string> = {
      'Settings.profile.title': 'Your profile',
      'Settings.profile.description': 'Profile description',
      'Settings.profile.accountDetails': 'Account details',
      'Settings.profile.workspaceRole': 'Workspace role',
      'Settings.profile.joined': 'Joined',
      'Settings.profile.userId': 'User ID',
      'Settings.profile.displayName': 'Display name',
      'Settings.profile.email': 'Email',
      'Settings.profile.photoHint': 'Photo hint',
      'Settings.profile.uploadPhoto': 'Upload photo',
      'Settings.profile.saveChanges': 'Save changes',
      'Settings.roles.owner': 'Owner',
    };
    return (key: string) => labels[`${namespace}.${key}`] ?? key;
  },
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({}),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: 'owner-user-id',
      created_at: '2026-07-05T00:00:00.000Z',
    },
    profile: {
      id: 'profile-id',
      full_name: 'Workspace Owner',
      email: 'owner@example.com',
      avatar_url: null,
      role: 'user',
      beta_features: [],
      account_id: 'account-id',
      account_role: 'owner',
    },
    accountRole: 'owner',
    refreshProfile: vi.fn(),
  }),
}));

import { ProfileForm } from './profile-form';

describe('Profile workspace role display', () => {
  it('shows the authoritative workspace role instead of the legacy profile role', () => {
    const html = renderToStaticMarkup(<ProfileForm />);

    expect(html).toContain('Workspace role');
    expect(html).toContain('Owner');
    expect(html).not.toContain('>user<');
  });
});
