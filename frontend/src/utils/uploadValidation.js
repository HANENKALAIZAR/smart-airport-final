/** Client-side upload rules (keep in sync with backend validators). */

export const ID_DOC_ACCEPT = '.jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf';
export const PHOTO_ACCEPT = '.jpg,.jpeg,.png,image/jpeg,image/png';

export const ERR_ID_FORMAT = 'Only JPG, PNG or PDF files are accepted.';
export const ERR_ID_SIZE = 'File size must be under 5MB.';
export const ERR_PHOTO_FORMAT = 'Only JPG, PNG or JPEG files are accepted.';
export const ERR_PHOTO_SIZE = 'File size must be under 2MB.';

const ID_MAX = 5 * 1024 * 1024;
const PHOTO_MAX = 2 * 1024 * 1024;

const ID_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']);
const PHOTO_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png']);

function extMime(name) {
  const n = (name || '').toLowerCase();
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.pdf')) return 'application/pdf';
  return '';
}

export function validateIdDocumentFile(file) {
  if (!file) return ERR_ID_FORMAT;
  const mime = (file.type || extMime(file.name)).toLowerCase();
  const effective = mime === 'image/jpg' ? 'image/jpeg' : mime;
  if (!ID_MIME.has(effective)) return ERR_ID_FORMAT;
  if (file.size > ID_MAX) return ERR_ID_SIZE;
  return null;
}

export function validateProfilePhotoFile(file) {
  if (!file) return ERR_PHOTO_FORMAT;
  const mime = (file.type || extMime(file.name)).toLowerCase();
  const effective = mime === 'image/jpg' ? 'image/jpeg' : mime;
  if (!PHOTO_MIME.has(effective)) return ERR_PHOTO_FORMAT;
  if (file.size > PHOTO_MAX) return ERR_PHOTO_SIZE;
  return null;
}
