/**
 * Derives an SSW People profile photo URL from an author's profile link.
 *
 * Profile images live in SSW.People.Profiles under a Title-Cased directory name, e.g.
 * https://www.ssw.com.au/people/adam-cogan
 *   -> .../main/Adam-Cogan/Images/Adam-Cogan-Profile.jpg
 *
 * Shared by the authors card and the Open Graph image route so the convention only
 * lives in one place.
 */
const PROFILES_REPO = "https://raw.githubusercontent.com/SSWConsulting/SSW.People.Profiles/main";

export const profileImageUrl = (peopleUrl?: string): string | null => {
  // Host-scoped on purpose: a bare /people/ match would also claim URLs like
  // github.com/some-people/x, which belong to the GitHub avatar fallback.
  if (!peopleUrl?.includes("ssw.com.au/people")) return null;

  const slug = peopleUrl.match(/people\/([^/?#]+)/)?.[1];
  if (!slug) return null;

  const dir = slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("-");

  return `${PROFILES_REPO}/${dir}/Images/${dir}-Profile.jpg`;
};

export const githubAvatarUrl = (url?: string): string | null => {
  if (!url?.includes("github.com/")) return null;
  const username = url.split("github.com/").pop();
  return username ? `https://avatars.githubusercontent.com/${username}` : null;
};
