/**
 * People Resolution Utilities
 *
 * Server-side utilities for resolving author slugs to full profile data.
 */

import fs from "fs";
import path from "path";

export interface Person {
  slug: string;
  name: string;
  imageUrl: string;
}

export type PeopleIndex = Record<string, Person>;

// Cache the people index in memory for the duration of the server process
let cachedPeopleIndex: PeopleIndex;

/**
 * Load and cache the people index from the generated JSON file
 */
export function getPeopleIndex(): PeopleIndex {
  if (cachedPeopleIndex) {
    return cachedPeopleIndex;
  }

  try {
    const indexPath = path.join(process.cwd(), "public", "people-index.json");

    if (!fs.existsSync(indexPath)) {
      console.warn("public/people-index.json not found. Run 'npm run generate:people' first.");
      return {};
    }

    const content = fs.readFileSync(indexPath, "utf-8");
    cachedPeopleIndex = JSON.parse(content);
    return cachedPeopleIndex;
  } catch (error) {
    console.error("Failed to load people index:", error);
    return {};
  }
}

/**
 * Resolve a single slug to person data
 *
 * @param slug - The author slug (e.g., "bob-northwind")
 * @returns Person data or null if not found
 */
export function resolvePerson(slug: string): Person | null {
  if (!slug) return null;

  const index = getPeopleIndex();
  return index[slug] || null;
}

/**
 * Resolve multiple slugs to person data
 *
 * @param slugs - Array of author slugs
 * @returns Array of resolved Person objects (excludes unresolved slugs)
 */
export function resolveAuthors(slugs: string[] | null | undefined): Person[] {
  if (!slugs || slugs.length === 0) return [];

  const index = getPeopleIndex();

  return slugs.map((slug) => index[slug]).filter((person): person is Person => person !== undefined);
}

/**
 * Create a fallback person object for unresolved slugs
 * Used when a slug doesn't exist in the index but we still want to display something
 *
 * @param slug - The unresolved slug
 * @returns A Person object with fallback values
 */
export function createFallbackPerson(slug: string): Person {
  // Try to derive a readable name from the slug
  const name = slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return {
    slug,
    name,
    imageUrl: "", // Will fall back to placeholder
  };
}

/**
 * Resolve multiple slugs with fallback for unresolved ones
 *
 * @param slugs - Array of author slugs
 * @returns Array of Person objects (includes fallbacks for unresolved slugs)
 */
export function resolveAuthorsWithFallback(slugs: string[] | null | undefined): Person[] {
  if (!slugs || slugs.length === 0) return [];

  const index = getPeopleIndex();

  return slugs.map((slug) => index[slug] || createFallbackPerson(slug));
}

/**
 * Check if a slug exists in the people index
 *
 * @param slug - The slug to check
 * @returns true if the slug exists in the index
 */
export function personExists(slug: string): boolean {
  const index = getPeopleIndex();
  return slug in index;
}

/**
 * Get all people from the index
 *
 * @returns Array of all Person objects, sorted by name
 */
export function getAllPeople(): Person[] {
  const index = getPeopleIndex();
  return Object.values(index).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Search people by name or slug
 *
 * @param query - Search query
 * @returns Array of matching Person objects
 */
export function searchPeople(query: string): Person[] {
  if (!query) return getAllPeople();

  const queryLower = query.toLowerCase();
  const index = getPeopleIndex();

  return Object.values(index)
    .filter((person) => person.name.toLowerCase().includes(queryLower) || person.slug.includes(queryLower))
    .sort((a, b) => a.name.localeCompare(b.name));
}
