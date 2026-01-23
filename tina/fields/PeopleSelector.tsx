"use client";

import { Popover, PopoverButton, PopoverPanel, Transition } from "@headlessui/react";
import Image from "next/image";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BiChevronDown, BiRefresh, BiSearch, BiUser } from "react-icons/bi";

interface Person {
  slug: string;
  name: string;
  role: string | null;
  imageUrl: string;
  profileUrl: string;
}

interface PeopleResponse {
  people: Person[];
  total: number;
}

const MIN_SEARCH_LENGTH = 2;
const INITIAL_PEOPLE_COUNT = 30;

/**
 * PeopleSelector - TinaCMS custom field component for selecting people
 *
 * Works with TinaCMS reference fields. Stores the reference path in format:
 * "people/{slug}.mdx" (e.g., "people/bob-northwind.mdx")
 */
export const PeopleSelector: React.FC<any> = ({ input }) => {
  const [filter, setFilter] = useState("");
  const [allPeople, setAllPeople] = useState<Person[]>([]);
  const [filteredPeople, setFilteredPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedPersonLabel, setSelectedPersonLabel] = useState<string | null>(null);

  // Extract slug from reference path (e.g., "people/bob-northwind.mdx" -> "bob-northwind")
  const extractSlugFromPath = (path: string | null): string | null => {
    if (!path) return null;
    // Handle both "people/slug.mdx" and "public/uploads/people/slug.mdx" formats
    const match = path.match(/people\/([^/]+)\.mdx$/);
    return match ? match[1] : null;
  };

  // Convert slug to reference path
  const slugToReferencePath = (slug: string): string => {
    return `people/${slug}.mdx`;
  };

  const selectedSlug = useMemo(() => {
    return extractSlugFromPath(input.value);
  }, [input.value]);

  const placeholderImg = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/uploads/ssw-employee-profile-placeholder-sketch.jpg`;

  // Fetch all people on mount
  const fetchPeople = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ""}/api/people`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data: PeopleResponse = await res.json();
      setAllPeople(data.people || []);
    } catch (e) {
      console.error("Failed to load people:", e);
      setError("Failed to load people. Try refreshing.");
    }
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      await fetchPeople();
      setLoading(false);
    };
    run();
  }, [fetchPeople]);

  // Initialize selected person label from input.value when people are loaded
  useEffect(() => {
    if (allPeople.length === 0 || !selectedSlug) {
      setSelectedPersonLabel(null);
      return;
    }

    const matchingPerson = allPeople.find((p) => p.slug === selectedSlug);

    if (matchingPerson) {
      setSelectedPersonLabel(matchingPerson.name);
    } else {
      // Show the slug if person not found in index
      setSelectedPersonLabel(selectedSlug);
    }
  }, [allPeople, selectedSlug]);

  // Filter people based on search query
  useEffect(() => {
    const q = filter.trim().toLowerCase();
    const isSearch = q.length >= MIN_SEARCH_LENGTH;

    if (!isSearch) {
      // Show first N people alphabetically when no search query
      // Ensure selected person is always included if they exist
      const selectedPerson = selectedSlug ? allPeople.find((p) => p.slug === selectedSlug) : null;
      const sorted = [...allPeople].slice(0, INITIAL_PEOPLE_COUNT);

      if (selectedPerson && !sorted.find((p) => p.slug === selectedSlug)) {
        sorted.unshift(selectedPerson);
        sorted.pop();
      }

      setFilteredPeople(sorted);
      return;
    }

    // Filter when searching - show ALL matching results
    const matches = allPeople.filter((p) => {
      const name = p.name.toLowerCase();
      const slug = p.slug.toLowerCase();
      const role = p.role?.toLowerCase() || "";
      return name.includes(q) || slug.includes(q) || role.includes(q);
    });

    setFilteredPeople(matches);
  }, [filter, allPeople, selectedSlug]);

  const handlePersonSelect = (person: Person) => {
    setSelectedPersonLabel(person.name);
    // Store as reference path format
    const referencePath = slugToReferencePath(person.slug);
    input.onChange(referencePath);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchPeople();
    setRefreshing(false);
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.src = placeholderImg;
  };

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Loading people...</div>;
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
                <span className="truncate" title={selectedPersonLabel || undefined}>
                  {selectedPersonLabel || "Select a person"}
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
                        <div className="relative mb-2">
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
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleRefresh();
                          }}
                          disabled={refreshing}
                          className="w-full text-xs px-3 py-1.5 bg-blue-500 text-white rounded-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                          title="Refresh the people list"
                        >
                          <BiRefresh className={`w-4.5 h-4.5 ${refreshing ? "animate-spin" : ""}`} />
                          {refreshing ? "Refreshing..." : "Refresh People"}
                        </button>
                      </div>

                      {/* Error state */}
                      {error && (
                        <div className="p-2 bg-red-50 border-b border-red-200 text-xs text-red-700 text-center">{error}</div>
                      )}

                      {/* Refreshing indicator */}
                      {refreshing && (
                        <div className="p-2 bg-blue-50 border-b border-blue-200 text-xs text-blue-700 text-center">
                          Refreshing people...
                        </div>
                      )}

                      {/* Empty state */}
                      {!loading && filteredPeople.length === 0 && filter.length >= MIN_SEARCH_LENGTH && (
                        <div className="p-4 text-center text-gray-400">No people found matching "{filter}"</div>
                      )}

                      {/* People list */}
                      {!loading && filteredPeople.length > 0 && (
                        <div className={`flex-1 overflow-y-auto ${refreshing ? "opacity-50 pointer-events-none" : ""}`}>
                          {filteredPeople.map((person) => {
                            const isSelected = selectedSlug === person.slug;

                            return (
                              <button
                                key={person.slug}
                                className={`w-full text-left py-2 px-3 hover:bg-gray-50 border-b border-gray-100 transition-colors block ${
                                  isSelected ? "bg-blue-50 border-blue-200" : ""
                                }`}
                                onClick={() => {
                                  handlePersonSelect(person);
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

                                  {/* Name and role */}
                                  <div className="flex-1 min-w-0 overflow-hidden">
                                    <div className="font-medium text-gray-900 text-sm leading-5 truncate">{person.name}</div>
                                    {person.role && (
                                      <div className="text-xs text-gray-500 leading-4 truncate">{person.role}</div>
                                    )}
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

export default PeopleSelector;
