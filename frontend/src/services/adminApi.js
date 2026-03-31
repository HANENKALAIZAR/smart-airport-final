/**
 * Admin API Service
 * =================
 * Central HTTP client for the admin/super-admin interface.
 * - Automatically attaches the JWT from localStorage to every request.
 * - Returns { data, error } so callers can handle both cases cleanly.
 * - On 401 → clears token and reloads to force re-login.
 */

const BASE = '/api';

/** Parse JSON safely - servers may return plain text or HTML on 5xx. */
function parseResponseBody(text) {
  if (text == null || !String(text).trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Human-readable API error (FastAPI detail string, array, or raw body snippet). */
function errorMessageFromBody(data, text, status) {
  if (data?.detail != null) {
    const d = data.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d) && d.length) {
      const parts = d.map((e) => e.msg || e.detail || JSON.stringify(e)).filter(Boolean);
      if (parts.length) return parts.join('; ');
    }
    return `Error ${status}`;
  }
  const t = (text || '').trim();
  if (t && t.length < 400 && !t.startsWith('<')) return t;
  return `Error ${status}`;
}

function getToken() {
  return localStorage.getItem('admin_token') || '';
}

function authHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
    ...extra,
  };
}

async function request(method, path, body) {
  try {
    const opts = {
      method,
      headers: authHeaders(),
    };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(`${BASE}${path}`, opts);

    // Expired / invalid token → force logout
    if (res.status === 401) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_role');
      localStorage.removeItem('admin_airport');
      window.location.reload();
      return { data: null, error: 'Session expired' };
    }

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

export async function apiPatchSuperAdminProfile(payload) {
  return request('PATCH', '/users/me/super-admin-profile', payload);
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

export async function apiPostIdReview(userId, action, reason) {
  return request('POST', `/users/admins/${userId}/id-review`, { action, reason });
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

export async function apiDeactivateAdmin(userId) {
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

export async function apiResolveMessage(messageId) {
  return request('PATCH', `/messages/${messageId}/resolve`);
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
