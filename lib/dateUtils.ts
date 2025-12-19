export function timeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffMin < 1) return "just now";
  if (diffHr < 1) return `${diffMin} minute${diffMin > 1 ? "s" : ""} ago`;
  if (diffDay < 1) return `${diffHr} hour${diffHr > 1 ? "s" : ""} ago`;
  if (diffMonth < 1) return `${diffDay} day${diffDay > 1 ? "s" : ""} ago`;
  if (diffYear < 1) return `${diffMonth} month${diffMonth > 1 ? "s" : ""} ago`;
  return `${diffYear} year${diffYear > 1 ? "s" : ""} ago`;
}

export function formatDateLong(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}