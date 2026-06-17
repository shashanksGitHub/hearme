/**
 * Maps raw Firebase / API errors to friendly, on-brand messages for the UI.
 * HearMe's voice: warm, calm, human, never blaming. Always say what happened
 * and a gentle next step. Never surface raw codes like "auth/invalid-credential".
 */

const AUTH_MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'That email and password don’t match. Mind trying again?',
  'auth/wrong-password': 'That email and password don’t match. Mind trying again?',
  'auth/user-not-found': 'We couldn’t find an account with that email. Want to create one?',
  'auth/invalid-email': 'That doesn’t look like a valid email — could you check it?',
  'auth/missing-password': 'Just need your password to continue.',
  'auth/email-already-in-use': 'You already have an account with this email. Try signing in instead.',
  'auth/weak-password': 'Let’s make that password a little stronger — at least 6 characters.',
  'auth/too-many-requests': 'That’s a lot of tries. Take a breath and give it another go in a moment.',
  'auth/network-request-failed': 'We’re having trouble connecting. Check your internet and try again.',
  'auth/popup-closed-by-user': 'The sign-in window closed. Try again whenever you’re ready.',
  'auth/cancelled-popup-request': 'The sign-in window closed. Try again whenever you’re ready.',
  'auth/popup-blocked': 'Your browser blocked the sign-in window — allow pop-ups and try again.',
  'auth/account-exists-with-different-credential':
    'You’ve signed in before with a different method. Try that one instead.',
  'auth/unauthorized-domain': 'Sign-in isn’t available from here just yet.',
  'auth/operation-not-allowed': 'That sign-in option isn’t available right now.',
  'auth/user-disabled': 'This account is currently inactive. Reach out and we’ll help.',
  'auth/requires-recent-login': 'For your security, please sign in again to continue.',
};

/** Friendly message for a Firebase Auth error. */
export function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  return AUTH_MESSAGES[code] ?? 'Something didn’t go through on our side. Mind trying again?';
}

const API_TOKEN_MESSAGES: Record<string, string> = {
  out_of_minutes:
    'You’ve used today’s minutes — they’ll be back tomorrow. Be kind to yourself until then. 💜',
  no_voice_selected: 'Let’s pick a voice first so HearMe can talk back — just head to setup.',
};

/**
 * Friendly message for an error thrown by apiFetch/apiUpload
 * (which look like `API 403: {"message":"out_of_minutes"}`).
 */
export function friendlyApiError(err: unknown): string {
  const raw = (err as Error)?.message ?? '';

  for (const [token, msg] of Object.entries(API_TOKEN_MESSAGES)) {
    if (raw.includes(token)) return msg;
  }

  const status = Number(raw.match(/API (\d{3})/)?.[1]);
  if (status === 401 || status === 403)
    return 'Your session timed out. Please sign in again to pick up where you left off.';
  if (status === 404) return 'We couldn’t find that — it may have moved or been removed.';
  if (status === 429) return 'You’re moving a little fast — give it a second and try again.';
  if (status >= 500) return 'Something went wrong on our side. We’re on it — please try again shortly.';
  if (raw.toLowerCase().includes('failed to fetch'))
    return 'We can’t reach HearMe right now. Check your connection and try again.';

  return 'Something didn’t go through. Mind trying again?';
}
