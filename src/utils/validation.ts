export const MAX_POST_LENGTH = 1000;
export const MAX_COMMENT_LENGTH = 400;
export const MAX_MESSAGE_LENGTH = 1500;
export const MAX_BIO_LENGTH = 240;
export const MAX_DISPLAY_NAME_LENGTH = 50;
export const MAX_USERNAME_LENGTH = 30;
export const MAX_HASHTAGS = 10;
export const USERNAME_PATTERN = '^[a-z0-9_]{3,30}$';
export const USERNAME_REGEX = new RegExp(USERNAME_PATTERN);

export function sanitizeLocalText(input: string, maxLength: number): string {
  return input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#([a-zA-Z0-9_]{2,30})/g) || [];
  return Array.from(new Set(matches.map((tag) => tag.slice(1).toLowerCase()))).slice(0, MAX_HASHTAGS);
}

export async function validateWithServerOrFallback(
  payload:
    | { type: 'post'; content: string; hasImage: boolean }
    | { type: 'comment'; content: string }
    | { type: 'message'; content: string; hasImage: boolean }
    | { type: 'profile'; displayName: string; username: string; bio: string }
): Promise<{
  valid: boolean;
  error?: string;
  sanitizedContent?: string;
  hashtags?: string[];
  sanitizedProfile?: { displayName: string; username: string; bio: string };
}> {
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('/api/validate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (res.ok || res.status === 400) {
        return data;
      }
    } catch {
      // Fallback to local validation on slow 2G/3G timeouts
    }
  }

  if (payload.type === 'post') {
    const clean = sanitizeLocalText(payload.content, MAX_POST_LENGTH);
    if (!clean && !payload.hasImage) {
      return { valid: false, error: 'Write something or attach an image to share.' };
    }
    return { valid: true, sanitizedContent: clean, hashtags: extractHashtags(clean) };
  }

  if (payload.type === 'comment') {
    const clean = sanitizeLocalText(payload.content, MAX_COMMENT_LENGTH);
    if (!clean) {
      return { valid: false, error: 'Comment cannot be empty.' };
    }
    return { valid: true, sanitizedContent: clean };
  }

  if (payload.type === 'message') {
    const clean = sanitizeLocalText(payload.content, MAX_MESSAGE_LENGTH);
    if (!clean && !payload.hasImage) {
      return { valid: false, error: 'Enter a message or select an image.' };
    }
    return { valid: true, sanitizedContent: clean };
  }

  const cleanName = sanitizeLocalText(payload.displayName, MAX_DISPLAY_NAME_LENGTH);
  const cleanUsername = sanitizeLocalText(payload.username, MAX_USERNAME_LENGTH)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  const cleanBio = sanitizeLocalText(payload.bio, MAX_BIO_LENGTH);

  if (cleanName.length < 2) {
    return { valid: false, error: 'Display name must be at least 2 characters.' };
  }
  if (!USERNAME_REGEX.test(cleanUsername)) {
    return {
      valid: false,
      error: 'Username must be 3–30 characters (lowercase letters, numbers, underscores).',
    };
  }
  return {
    valid: true,
    sanitizedProfile: { displayName: cleanName, username: cleanUsername, bio: cleanBio },
  };
}
