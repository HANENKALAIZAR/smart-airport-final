/**
 * Admin API Service
 * =================
 * Central HTTP client for the admin/super-admin interface.
 * - Automatically attaches the JWT from localStorage to every request.
 * - Returns { data, error } so callers can handle both cases cleanly.
 * - On 401 → clears token and redirects to /admin/login.
 * - Retries up to 2× on network errors or 5xx (not on 4xx).
 * - Times out after 12 seconds.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000') + '/api';
const TIMEOUT_MS = 12_000;
const MAX_RETRIES = 2;

/** Parse JSON safely — servers may return plain text or HTML on 5xx. */
function parseResponseBody(text) {
  if (text == null || !String(text).trim()) return null;
  try { return JSON.parse(text); } catch { return null; }
}

/** Extract also the standardized { data, error } envelope if present. */
function unwrapEnvelope(parsed) {
  if (parsed && typeof parsed === 'object' && 'data' in parsed && 'error' in parsed) {
    return parsed.data;
  }
  return parsed;
}

/** Human-readable error from FastAPI detail, array, or raw snippet. */
function errorMessageFromBody(data, text, status) {
  // Handle standardized { data, error } envelope from our backend
  if (data?.error) return String(data.error);
  if (data?.detail != null) {
    const d = data.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d) && d.length) {
      const parts = d.map(e => e.msg || e.detail || JSON.stringify(e)).filter(Boolean);
      if (parts.length) return parts.join('; ');
    }
    return `Error ${status}`;
  }
  const t = (text || '').trim();
  if (t && t.length < 400 && !t.startsWith('<')) return t;
  return `Error ${status}`;
}

function getToken() {
  try { return localStorage.getItem('admin_token') || ''; }
  catch { return ''; }
}

function authHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
    ...extra,
  };
}

/** Fetch with AbortController timeout. */
async function fetchWithTimeout(url, opts) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Returns true for errors worth retrying (network, 429, 5xx). */
function isRetryable(err, status) {
  if (err?.name === 'AbortError') return false; // timeout — don't retry
  if (!status) return true; // network error
  return status === 429 || status >= 500;
}

async function request(method, path, body, _retry = 0) {
  const opts = { method, headers: authHeaders() };
  if (body !== undefined) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetchWithTimeout(`${BASE}${path}`, opts);
  } catch (err) {
    // Network / timeout error
    if (_retry < MAX_RETRIES && isRetryable(err, null)) {
      await new Promise(r => setTimeout(r, 500 * (_retry + 1)));
      return request(method, path, body, _retry + 1);
    }
    const msg = err?.name === 'AbortError'
      ? 'Request timed out. Please check your connection.'
      : (err?.message || 'Network error — check your connection.');
    return { data: null, error: msg };
  }

  // 401 → expired/invalid token, force logout
  if (res.status === 401) {
    import('./adminAuth.js')
      .then(m => m.clearAuthAndRedirect())
      .catch(() => window.location.replace('/admin/login'));
    return { data: null, error: 'Session expired. Please log in again.' };
  }

  const text = await res.text();
  const parsed = parseResponseBody(text);

  // Retry 5xx automatically
  if (res.status >= 500 && _retry < MAX_RETRIES) {
    await new Promise(r => setTimeout(r, 500 * (_retry + 1)));
    return request(method, path, body, _retry + 1);
  }

  if (!res.ok) {
    return { data: null, error: errorMessageFromBody(parsed, text, res.status) };
  }

  // Unwrap { data, error } envelope if backend returns it
  return { data: unwrapEnvelope(parsed), error: null };
}


// ── Auth ──────────────────────────────────────────────────────────────────

export async function apiLogin(email, password) {
  try {
    const res = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const text = await res.text();
    const data = parseResponseBody(text);
    if (!res.ok) {
      return { data: null, error: errorMessageFromBody(data, text, res.status) || 'Login failed' };
    }
    return { data, error: null };
  } catch {
    return { data: null, error: 'Cannot connect to server. Is the backend running?' };
  }
}

export async function apiChangePassword(currentPassword, newPassword) {
  const body = { new_password: newPassword };
  if (currentPassword != null && String(currentPassword).trim() !== '') {
    body.current_password = String(currentPassword).trim();
  }
  return request('POST', '/auth/change-password', body);
}

export async function apiGetMe() {
  return request('GET', '/auth/me');
}

export async function apiGetNotificationSummary() {
  return request('GET', '/notifications/summary');
}

export async function apiMarkNotificationRead(id) {
  return request('PATCH', `/notifications/${id}/read`, {});
}

export async function apiMarkAllNotificationsRead() {
  return request('POST', '/notifications/mark-all-read', {});
}

export async function apiForgotPassword(workEmail) {
  try {
    const res = await fetch(`${BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ work_email: workEmail.trim() }),
    });
    const text = await res.text();
    const data = parseResponseBody(text);
    if (!res.ok) {
      return { data: null, error: errorMessageFromBody(data, text, res.status) };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function apiValidateResetToken(token) {
  try {
    const params = new URLSearchParams({ token: token || '' });
    const res = await fetch(`${BASE}/auth/reset-password/validate?${params}`);
    const text = await res.text();
    const data = parseResponseBody(text);
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export async function apiResetPassword(token, newPassword, confirmPassword) {
  try {
    const res = await fetch(`${BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      }),
    });
    const text = await res.text();
    const data = parseResponseBody(text);
    if (!res.ok) {
      return { data: null, error: errorMessageFromBody(data, text, res.status) };
    }
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

// ── User Management (super_admin only) ───────────────────────────────────

export async function apiCreateAdmin(payload) {
  // payload: { full_name, airport_iata, work_email, personal_email, bypass_duplicate? }
  return request('POST', '/users/admins', payload);
}

export async function apiListAdmins() {
  return request('GET', '/users/admins');
}

export async function apiCheckEmail(email) {
  const params = new URLSearchParams({ email });
  return request('GET', `/users/admins/check-email?${params}`);
}

export async function apiSuggestEmail(fullName, airportIata) {
  const params = new URLSearchParams({ full_name: fullName, airport_iata: airportIata });
  return request('GET', `/users/admins/suggest-email?${params}`);
}

export async function apiCheckDuplicate(fullName, airportCode) {
  return request('POST', '/users/admins/check-duplicate', { full_name: fullName, airport_code: airportCode });
}

export async function apiCompleteProfile(payload) {
  return request('POST', '/users/me/profile', payload);
}

export async function apiPatchSettings(payload) {
  return request('PATCH', '/users/me/settings', payload);
}


export async function apiReuploadIdDocument(cinDocumentUrl, passportDocumentUrl) {
  const body = {};
  if (cinDocumentUrl) body.cin_document_url = cinDocumentUrl;
  if (passportDocumentUrl) body.passport_document_url = passportDocumentUrl;
  return request('POST', '/users/me/id-document', body);
}

export async function apiPatchAdminProfile(userId, payload) {
  return request('PATCH', `/users/admins/${userId}/profile`, payload);
}

export async function apiGetAdminReview(userId) {
  return request('GET', `/users/admins/${userId}/review`);
}

export async function apiPostIdReview(userId, action, reason, rejected_fields = []) {
  return request('POST', `/users/admins/${userId}/id-review`, { action, reason, rejected_fields });
}

export async function apiSubmitCorrectionRequest(reason, fields) {
  return request('POST', '/users/me/correction-request', { reason, fields });
}

export async function apiAiAlertGenerated(payload) {
  return request('POST', '/notifications/ai-alert-generated', payload);
}

export async function apiAiAlertAction(payload) {
  return request('POST', '/notifications/ai-alert-action', payload);
}

export async function apiGetAiAlerts(airportIata, decision = 'all') {
  const params = new URLSearchParams();
  if (airportIata) params.set('airport_iata', airportIata);
  if (decision && decision !== 'all') params.set('decision', decision);
  const qs = params.toString();
  return request('GET', `/notifications/ai-alerts${qs ? `?${qs}` : ''}`);
}

export async function apiResubmitIdProfile(payload) {
  return request('POST', '/users/me/id-profile-resubmit', payload);
}

export async function apiUnlockAdminCorrection(userId) {
  return request('POST', `/users/admins/${userId}/correction/unlock`, {});
}

export async function apiDismissAdminCorrection(userId, note) {
  return request('POST', `/users/admins/${userId}/correction/dismiss`, { note: note || null });
}

export async function apiDeleteAdmin(userId) {
  return request('DELETE', `/users/admins/${userId}`);
}

export async function apiToggleAdminStatus(userId) {
  return request('PATCH', `/users/admins/${userId}/activate`);
}

// ── Messaging ─────────────────────────────────────────────────────────────

export async function apiListMessages(tab = 'inbox', status = null) {
  const params = new URLSearchParams({ tab });
  if (status && status !== 'all') params.set('status', status);
  return request('GET', `/messages?${params}`);
}

export async function apiSendMessage(payload) {
  return request('POST', '/messages', payload);
}

export async function apiReplyToMessage(messageId, body) {
  return request('POST', `/messages/${messageId}/reply`, { body });
}

export async function apiUpdateMessageStatus(messageId, status) {
  return request('PATCH', `/messages/${messageId}/status`, { status });
}

export async function apiGetMessageUnreadCount() {
  return request('GET', '/messages/unread-count');
}

export async function apiMarkMessagesInboxRead() {
  return request('POST', '/messages/mark-inbox-read', {});
}

export async function apiDeleteMessage(messageId) {
  return request('DELETE', `/messages/${messageId}`);
}

// ── Dashboard ─────────────────────────────────────────────────────────────

export async function apiGetDashboardOverview() {
  return request('GET', '/dashboard/overview');
}

export async function apiGetDelayCauses() {
  return request('GET', '/dashboard/delay-causes');
}

export async function apiGetDelayHistory() {
  return request('GET', '/dashboard/history');
}

export async function apiGetAirlinesPerformance() {
  return request('GET', '/dashboard/airlines-performance');
}

export async function apiGetAtRiskFlights() {
  return request('GET', '/dashboard/at-risk');
}

// ── Flights ───────────────────────────────────────────────────────────────

export async function apiGetFlights(params = {}) {
  const q = new URLSearchParams(params).toString();
  return request('GET', `/flights?${q}`);
}

export async function apiGetFlight(id) {
  return request('GET', `/flights/${id}`);
}

export async function apiCreateFlight(payload) {
  return request('POST', '/flights', payload);
}

export async function apiUpdateFlight(id, payload) {
  return request('PUT', `/flights/${id}`, payload);
}

export async function apiDeleteFlight(id) {
  return request('DELETE', `/flights/${id}`);
}

// ── Predictions ───────────────────────────────────────────────────────────

export async function apiPredict(features) {
  return request('POST', '/predictions', features);
}

export async function apiBatchPredict(flightIds) {
  return request('POST', '/predictions/batch', flightIds);
}
