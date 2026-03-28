/**
 * Tunisian mobile/phone: +216 then 8 digits, first digit 2,4,5, or 9.
 * Display format: +216 XX XXX XXX
 */

export const TUNISIAN_PHONE_REGEX = /^\+216[2459]\d{7}$/;

export const PHONE_INLINE_ERROR =
  'Please enter a valid Tunisian phone number (e.g. +216 9X XXX XXX)';

/** Subscriber digits only (max 8), stripping leading 216 if present. */
export function tunisiaSubscriberDigits(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('216')) d = d.slice(3);
  return d.slice(0, 8);
}

/** Canonical value for API: +216 + 8 digits (may be incomplete while typing). */
export function tunisiaPhoneCanonical(raw) {
  const sub = tunisiaSubscriberDigits(raw);
  return sub.length ? `+216${sub}` : '';
}

/** Formatted input for controlled field while typing. */
export function formatTunisiaPhoneInput(raw) {
  const sub = tunisiaSubscriberDigits(raw);
  if (!sub.length) return '+216 ';
  const a = sub.slice(0, 2);
  const b = sub.slice(2, 5);
  const c = sub.slice(5, 8);
  let out = `+216 ${a}`;
  if (b) out += ` ${b}`;
  if (c) out += ` ${c}`;
  return out;
}

/** True when 8 subscriber digits form a valid Tunisian number. */
export function isValidTunisiaPhone(raw) {
  const sub = tunisiaSubscriberDigits(raw);
  if (sub.length !== 8) return false;
  return TUNISIAN_PHONE_REGEX.test(`+216${sub}`);
}

/**
 * For inline errors while typing: show error only once we have a full 8-digit subscriber
 * and it fails validation (or first digit invalid early).
 */
export function tunisiaPhoneFieldError(displayValue) {
  const sub = tunisiaSubscriberDigits(displayValue);
  if (sub.length === 0) return null;
  if (sub.length < 8) {
    if (sub.length >= 1 && !'2459'.includes(sub[0])) return PHONE_INLINE_ERROR;
    return null;
  }
  return isValidTunisiaPhone(displayValue) ? null : PHONE_INLINE_ERROR;
}
