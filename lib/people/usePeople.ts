"use client";

/**
 * People Resolution Hooks
 *
 * Client-side React hooks for resolving author slugs to full profile data.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

export interface Person {
  slug: string;
  name: string;
  imageUrl: string;
}

export type PeopleIndex = Record<string, Person>;

// Global cache for the people index
let globalPeopleCache: PeopleIndex | null = null;
let globalPeoplePromise: Promise<PeopleIndex> | null = null;

/**
 * Fetch the people index from the API
 */
async function fetchPeopleIndex(): Promise<PeopleIndex> {
  // Return cached data if available
  if (globalPeopleCache) {
    return globalPeopleCache;
  }

  // Return existing promise if fetch is in progress
  if (globalPeoplePromise) {
    return globalPeoplePromise;
  }

  // Start a new fetch
  globalPeoplePromise = fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/people`)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`Failed to fetch people index: ${res.status}`);
      }
      const data = await res.json();
      // Convert array response to index
      const index: PeopleIndex = {};
      for (const person of data.people || []) {
        index[person.slug] = person;
      }
      globalPeopleCache = index;
      return index;
    })
    .catch((error) => {
      console.error("Failed to fetch people index:", error);
      globalPeoplePromise = null; // Allow retry on error
      return {};
    });

  return globalPeoplePromise;
}

/**
 * Create a fallback person object for unresolved slugs
 */
function createFallbackPerson(slug: string): Person {
  const name = slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return {
    slug,
    name,
    imageUrl: "",
  };
}

/**
 * Hook to access the full people index
 *
 * @returns Object with people index, loading state, and error
 */
export function usePeopleIndex(): {
  people: PeopleIndex;
  peopleList: Person[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const [people, setPeople] = useState<PeopleIndex>(globalPeopleCache || {});
  const [loading, setLoading] = useState(!globalPeopleCache);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const index = await fetchPeopleIndex();
      setPeople(index);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!globalPeopleCache) {
      fetchData();
    }
  }, [fetchData]);

  const peopleList = useMemo(() => {
    return Object.values(people).sort((a, b) => a.name.localeCompare(b.name));
  }, [people]);

  const refetch = useCallback(() => {
    globalPeopleCache = null;
    globalPeoplePromise = null;
    fetchData();
  }, [fetchData]);

  return { people, peopleList, loading, error, refetch };
}

/**
 * Hook to resolve a single author slug to person data
 *
 * @param slug - The author slug to resolve
 * @returns Object with resolved person and loading state
 */
export function useResolvePerson(slug: string | null | undefined): {
  person: Person | null;
  loading: boolean;
} {
  const { people, loading } = usePeopleIndex();

  const person = useMemo(() => {
    if (!slug) return null;
    return people[slug] || null;
  }, [slug, people]);

  return { person, loading };
}

/**
 * Hook to resolve multiple author slugs to person data
 *
 * @param slugs - Array of author slugs to resolve
 * @returns Object with resolved authors array and loading state
 */
export function useResolveAuthors(slugs: string[] | null | undefined): {
  authors: Person[];
  loading: boolean;
} {
  const { people, loading } = usePeopleIndex();

  const authors = useMemo(() => {
    if (!slugs || slugs.length === 0) return [];

    return slugs
      .map((slug) => people[slug] || createFallbackPerson(slug))
      .filter((person): person is Person => person !== null);
  }, [slugs, people]);

  return { authors, loading };
}

/**
 * Hook to search people by name or slug
 *
 * @param query - Search query
 * @returns Object with matching people and loading state
 */
export function useSearchPeople(query: string): {
  results: Person[];
  loading: boolean;
} {
  const { peopleList, loading } = usePeopleIndex();

  const results = useMemo(() => {
    if (!query) return peopleList;

    const queryLower = query.toLowerCase();
    return peopleList.filter(
      (person) =>
        person.name.toLowerCase().includes(queryLower) ||
        person.slug.includes(queryLower)
    );
  }, [query, peopleList]);

  return { results, loading };
}
