export function extractUsernameFromUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  try {
    if (trimmed.toLowerCase().startsWith('http')) {
      const u = new URL(trimmed);
      const segments = u.pathname.split('/').filter(Boolean);
      if (segments.length > 0) return segments[0].replace(/^@/, '');
    }
  } catch {
    // Ignore URL parsing errors and try regex-based cleanup
  }
  const cleaned = trimmed
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^@/, '')
    .replace(/^\//, '');
  const username = cleaned.split('/')[0].trim();
  return username || null;
}


