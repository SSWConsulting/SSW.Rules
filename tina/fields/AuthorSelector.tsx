"use client";

import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react";
import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BiChevronDown, BiRefresh, BiSearch, BiUser } from "react-icons/bi";

interface Author {
  slug: string;
  name: string;
  imageUrl: string;
}

interface AuthorResponse {
  people: Author[];
  total: number;
}

const MIN_SEARCH_LENGTH = 2;
const INITIAL_PEOPLE_COUNT = 30;

interface AuthorSelectorProps {
  input: any;
  showRefresh?: boolean;
}

/**
 * AuthorSelector - TinaCMS custom field component for selecting people
 *
 * Stores authors as plain slugs (e.g., "bob-northwind") for consistency
 * with the migration script. Also handles reading legacy reference path
 * format ("people/slug.mdx") for backward compatibility.
 *
 * @param showRefresh - Whether to show the refresh button (default: false)
 */
export const AuthorSelector: React.FC<AuthorSelectorProps> = ({ input, showRefresh = false }) => {
  const [filter, setFilter] = useState("");
  const [allAuthors, setAllAuthors] = useState<Author[]>([]);
  const [filteredAuthors, setFilteredAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedAuthorLabel, setSelectedAuthorLabel] = useState<string | null>(null);

  // Get the slug from input.value - should be a plain string slug
  const selectedSlug = useMemo(() => {
    const value = input.value;
    // Handle null/undefined
    if (!value) return null;
    // If it's already a plain string slug, return it
    if (typeof value === "string") return value;
    // Unexpected format - return null
    return null;
  }, [input.value]);

  const placeholderImg = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/uploads/ssw-employee-profile-placeholder-sketch.jpg`;

  // Fetch all people on mount
  const fetchAuthors = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/people`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data: AuthorResponse = await res.json();
      setAllAuthors(data.people || []);
    } catch (e) {
      console.error("Failed to load people:", e);
      setError("Failed to load people. Try refreshing.");
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      await fetchAuthors();
      setLoading(false);
    };
    run();
  }, [fetchAuthors]);

  // Initialize selected person label from input.value when people are loaded
  useEffect(() => {
    if (allAuthors.length === 0 || !selectedSlug) {
      setSelectedAuthorLabel(null);
      return;
    }

    const matchingPerson = allAuthors.find((p) => p.slug === selectedSlug);

    if (matchingPerson) {
      setSelectedAuthorLabel(matchingPerson.name);
    } else {
      // Show the slug if person not found in index
      setSelectedAuthorLabel(selectedSlug);
    }
  }, [allAuthors, selectedSlug]);

  // Filter people based on search query
  useEffect(() => {
    const q = filter.trim().toLowerCase();
    const isSearch = q.length >= MIN_SEARCH_LENGTH;

    if (!isSearch) {
      // Show first N people alphabetically when no search query
      // Ensure selected person is always included if they exist
      const selectedAuthor = selectedSlug ? allAuthors.find((p) => p.slug === selectedSlug) : null;
      const sorted = [...allAuthors].slice(0, INITIAL_PEOPLE_COUNT);

      if (selectedAuthor && !sorted.find((p) => p.slug === selectedSlug)) {
        sorted.unshift(selectedAuthor);
        sorted.pop();
      }

      setFilteredAuthors(sorted);
      return;
    }

    // Filter when searching - show ALL matching results
    const matches = allAuthors.filter((p) => {
      const name = p.name.toLowerCase();
      const slug = p.slug.toLowerCase();
      return name.includes(q) || slug.includes(q);
    });

    setFilteredAuthors(matches);
  }, [filter, allAuthors, selectedSlug]);

  const handleAuthorSelect = (author: Author) => {
    setSelectedAuthorLabel(author.name);
    input.onChange(author.slug);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAuthors();
    setRefreshing(false);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = placeholderImg;
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Loading authors...</div>;
  }

  return (
    <div className="relative z-1000">
      <input type="hidden" id={input.name} {...input} />
      <Popover>
        {({ open }) => (
          <>
            <PopoverButton className="text-sm h-11 px-4 justify-between w-full bg-white border border-gray-200 rounded-full hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors flex items-center">
              <span className="flex items-center gap-2 truncate">
                <BiUser className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate" title={selectedAuthorLabel || undefined}>
                  {selectedAuthorLabel || "Select an author"}
                </span>
              </span>
              <BiChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
            </PopoverButton>
            <div className="absolute inset-x-0 -bottom-2 translate-y-full z-1000">
              <Transition
                enter="transition duration-150 ease-out"
                enterFrom="transform opacity-0 -translate-y-2"
                enterTo="transform opacity-100 translate-y-0"
                leave="transition duration-75 ease-in"
                leaveFrom="transform opacity-100 translate-y-0"
                leaveTo="transform opacity-0 -translate-y-2"
              >
                <PopoverPanel className="relative overflow-hidden rounded-lg shadow-lg bg-white border border-gray-150 z-50">
                  {({ close }) => (
                    <div className="max-h-[70vh] flex flex-col w-full">
                      {/* Search header */}
                      <div className="bg-gray-50 p-2 border-b border-gray-100 z-10 shadow-sm">
                        <div className="relative">
                          <BiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            className="bg-white text-sm rounded-sm border border-gray-100 shadow-inner py-1.5 pl-10 pr-3 w-full block placeholder-gray-400"
                            onClick={(event) => {
                              event.stopPropagation();
                              event.preventDefault();
                            }}
                            value={filter}
                            onChange={(event) => {
                              setFilter(event.target.value);
                            }}
                            placeholder="Search by name..."
                          />
                        </div>
                        {showRefresh && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              handleRefresh();
                            }}
                            disabled={refreshing}
                            className="w-full text-xs px-3 py-1.5 mt-2 bg-blue-500 text-white rounded-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                            title="Refresh the people list"
                          >
                            <BiRefresh className={`w-4.5 h-4.5 ${refreshing ? "animate-spin" : ""}`} />
                            {refreshing ? "Refreshing..." : "Refresh People"}
                          </button>
                        )}
                      </div>

                      {/* Error state */}
                      {error && <div className="p-2 bg-red-50 border-b border-red-200 text-xs text-red-700 text-center">{error}</div>}

                      {/* Refreshing indicator */}
                      {showRefresh && refreshing && (
                        <div className="p-2 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 text-center">Refreshing people...</div>
                      )}

                      {/* Empty state */}
                      {!loading && filteredAuthors.length === 0 && filter.length >= MIN_SEARCH_LENGTH && (
                        <div className="p-4 text-center text-gray-400">No people found matching "{filter}"</div>
                      )}

                      {/* People list */}
                      {!loading && filteredAuthors.length > 0 && (
                        <div className={`flex-1 overflow-y-auto ${refreshing ? "opacity-50 pointer-events-none" : ""}`}>
                          {filteredAuthors.map((person) => {
                            const isSelected = selectedSlug === person.slug;

                            return (
                              <button
                                key={person.slug}
                                className={`w-full text-left py-2 px-3 hover:bg-gray-50 border-b border-gray-100 transition-colors block ${
                                  isSelected ? "bg-blue-50 border-blue-200" : ""
                                }`}
                                onClick={() => {
                                  handleAuthorSelect(person);
                                  close();
                                }}
                                title={person.name}
                              >
                                <div className="flex items-center gap-3 w-full">
                                  {/* Avatar */}
                                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 shrink-0 relative">
                                    <Image
                                      src={person.imageUrl || placeholderImg}
                                      alt={person.name}
                                      fill
                                      className="object-cover object-top"
                                      onError={handleImageError}
                                      unoptimized
                                    />
                                  </div>

                                  {/* Name */}
                                  <div className="flex-1 min-w-0 overflow-hidden">
                                    <div className="font-medium text-gray-900 text-sm leading-5 truncate">{person.name}</div>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </PopoverPanel>
              </Transition>
            </div>
          </>
        )}
      </Popover>
    </div>
  );
};

export default AuthorSelector;
