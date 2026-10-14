export async function signInAndConnectTelegram(request, { state, session, email, password }) {
  if (!state) throw new Error('Open a fresh sign-in link by sending /login to the Telegram bot.');
  const authenticated = session || await request('/api/auth/login', {
    method: 'POST', body: { email: email.trim(), username: email.trim(), password },
  });
  if (authenticated.user?.role !== 'Hiring Manager') {
    throw new Error('Sign in with a Hiring Manager account to connect this bot.');
  }
  if (!authenticated.access_token) throw new Error('Sign-in did not return a valid session. Please try again.');
  await request('/api/integrations/telegram/complete-login', {
    method: 'POST', token: authenticated.access_token, body: { state }, timeout: 45000,
  });
  return authenticated;
}
