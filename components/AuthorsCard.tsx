"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { useResolveAuthors } from "@/lib/people/usePeople";

/**
 * Legacy author format (object with title and url)
 */
interface LegacyAuthor {
  title?: string | null;
  url?: string | null;
}

/**
 * New reference format (object with person reference path)
 */
interface AuthorReference {
  person?: string | null;
}

type AuthorItem = string | LegacyAuthor | AuthorReference | null;

interface AuthorsCardProps {
  /**
   * Authors - can be:
   * - New reference format: { person: "people/bob-northwind.mdx" }[]
   * - Slug format: string[] of slugs (e.g., ["bob-northwind"])
   * - Legacy format: { title, url }[]
   */
  authors?: AuthorItem[] | null;
}

/**
 * Check if an item is in reference format
 */
function isReferenceFormat(item: AuthorItem): item is AuthorReference {
  return item !== null && typeof item === "object" && "person" in item;
}

/**
 * Check if an item is in legacy format
 */
function isLegacyFormat(item: AuthorItem): item is LegacyAuthor {
  return item !== null && typeof item === "object" && ("title" in item || "url" in item) && !("person" in item);
}

/**
 * Extract slug from reference path
 * e.g., "people/bob-northwind.mdx" -> "bob-northwind"
 */
function extractSlugFromPath(path: string | null | undefined): string | null {
  if (!path) return null;
  const match = path.match(/people\/([^/]+)\.mdx$/);
  return match ? match[1] : null;
}

/**
 * Extract slug from a legacy author URL
 */
function extractSlugFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  if (url.includes("ssw.com.au/people/")) {
    const match = url.match(/people\/([^/?#]+)/);
    return match ? match[1] : null;
  }

  if (url.includes("github.com/")) {
    const username = url.split("github.com/").pop()?.split("/")[0];
    return username ? `gh-${username}` : null;
  }

  return null;
}

/**
 * Get image URL from legacy author format
 */
function getImageUrlFromLegacyAuthor(author: LegacyAuthor, placeholderImg: string): string {
  const { url } = author;

  if (url?.includes("ssw.com.au/people")) {
    const match = url.match(/people\/([^/?#]+)/);
    const slug = match ? match[1] : null;

    if (slug) {
      const formattedTitle = slug
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("-");

      return `https://raw.githubusercontent.com/SSWConsulting/SSW.People.Profiles/main/${formattedTitle}/Images/${formattedTitle}-Profile.jpg`;
    }
  }

  if (url?.includes("github.com/")) {
    const gitHubUsername = url.split("github.com/").pop();
    return `https://avatars.githubusercontent.com/${gitHubUsername}`;
  }

  return placeholderImg;
}

export default function AuthorsCard({ authors }: AuthorsCardProps) {
  const placeholderImg = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/uploads/ssw-employee-profile-placeholder-sketch.jpg`;

  // Determine format and extract slugs
  const { slugs, legacyAuthors, isLegacy } = useMemo(() => {
    if (!authors || authors.length === 0) {
      return { slugs: [], legacyAuthors: [], isLegacy: false };
    }

    const extractedSlugs: string[] = [];
    const legacy: LegacyAuthor[] = [];
    let hasLegacy = false;

    for (const author of authors) {
      if (author === null) continue;

      // New reference format: { person: "people/slug.mdx" }
      if (isReferenceFormat(author)) {
        const slug = extractSlugFromPath(author.person);
        if (slug) extractedSlugs.push(slug);
        continue;
      }

      // String format (just the slug)
      if (typeof author === "string") {
        extractedSlugs.push(author);
        continue;
      }

      // Legacy format: { title, url }
      if (isLegacyFormat(author)) {
        hasLegacy = true;
        legacy.push(author);
        // Also try to extract slug for resolution
        const slug = extractSlugFromUrl(author.url);
        if (slug) extractedSlugs.push(slug);
      }
    }

    return {
      slugs: extractedSlugs,
      legacyAuthors: legacy,
      isLegacy: hasLegacy && extractedSlugs.length === 0,
    };
  }, [authors]);

  // Resolve slugs to full person data
  const { authors: resolvedAuthors, loading } = useResolveAuthors(slugs);

  // Build display authors
  const displayAuthors = useMemo(() => {
    // If we only have legacy authors with no resolvable slugs, use them directly
    if (isLegacy && legacyAuthors.length > 0) {
      return legacyAuthors.map((author) => ({
        name: author.title ?? "Unknown",
        url: author.url ?? undefined,
        imageUrl: getImageUrlFromLegacyAuthor(author, placeholderImg),
      }));
    }

    // Use resolved authors from people index
    return resolvedAuthors.map((person) => ({
      name: person.name,
      url: person.profileUrl,
      imageUrl: person.imageUrl || placeholderImg,
    }));
  }, [isLegacy, legacyAuthors, resolvedAuthors, placeholderImg]);

  const [imgSrcList, setImgSrcList] = useState<string[]>([]);

  useEffect(() => {
    if (displayAuthors.length > 0) {
      setImgSrcList(displayAuthors.map((a) => a.imageUrl || placeholderImg));
    }
  }, [displayAuthors, placeholderImg]);

  const handleImageError = (index: number) => {
    setImgSrcList((prev) => {
      const updated = [...prev];
      if (updated[index] === placeholderImg) {
        updated[index] = "";
        return updated;
      }
      updated[index] = placeholderImg;
      return updated;
    });
  };

  if (displayAuthors.length === 0) {
    return null;
  }

  if (loading && !isLegacy) {
    return (
      <Card title="Authors">
        <div className="flex flex-row flex-wrap p-2">
          <span className="text-gray-400 text-sm">Loading authors...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Authors">
      <div className="flex flex-row flex-wrap">
        {displayAuthors.map((author, index) => {
          const title = author.name;
          const imgSrc = imgSrcList[index];

          return (
            <div className="px-2 flex items-center my-2 justify-center" key={`author_${index}`}>
              <div className="w-12 h-12 overflow-hidden rounded-full relative">
                {author.url ? (
                  <a href={author.url} target="_blank" rel="noopener noreferrer nofollow">
                    {imgSrc?.trim() && (
                      <Image
                        src={imgSrc}
                        alt={title}
                        title={title}
                        fill
                        className="object-cover object-top"
                        onError={() => handleImageError(index)}
                        unoptimized
                      />
                    )}
                  </a>
                ) : (
                  imgSrc?.trim() && (
                    <Image
                      src={imgSrc}
                      alt={title}
                      title={title}
                      fill
                      className="object-cover object-top"
                      onError={() => handleImageError(index)}
                      unoptimized
                    />
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
