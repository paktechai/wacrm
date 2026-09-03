const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
};

export const env = {
  supabaseUrl: required('SUPABASE_URL').replace(/\/$/, ''),
  serviceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  publishableKey: required('SUPABASE_PUBLISHABLE_KEY'),
};

export async function supabaseRest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('apikey', env.serviceKey);
  headers.set('Authorization', `Bearer ${env.serviceKey}`);
  if (options.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  const response = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers,
    body: options.body === undefined
      ? undefined
      : typeof options.body === 'string' ? options.body : JSON.stringify(options.body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.message || `Supabase REST failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function authenticateUser(authorization) {
  if (!authorization?.startsWith('Bearer ')) {
    const error = new Error('Authentication required');
    error.status = 401;
    throw error;
  }
  const response = await fetch(`${env.supabaseUrl}/auth/v1/user`, {
    headers: { apikey: env.publishableKey, Authorization: authorization },
  });
  if (!response.ok) {
    const error = new Error('Invalid or expired session');
    error.status = 401;
    throw error;
  }
  return response.json();
}

export async function requireMembership(userId, accountId) {
  const rows = await supabaseRest(
    `profiles?select=account_id&account_id=eq.${encodeURIComponent(accountId)}` +
    `&user_id=eq.${encodeURIComponent(userId)}&limit=1`
  );
  if (!rows?.length) {
    const error = new Error('Account membership required');
    error.status = 403;
    throw error;
  }
}
