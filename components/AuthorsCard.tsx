"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { usePeopleIndex, useResolveAuthors } from "@/lib/people/usePeople";

interface Author {
  author?: string | null;
}

interface AuthorsCardProps {
  authors?: Author[] | null;
}

export default function AuthorsCard({ authors }: AuthorsCardProps) {
  const placeholderImg = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/uploads/ssw-employee-profile-placeholder-sketch.jpg`;

  // Extract slugs from authors array
  const slugs = useMemo(() => {
    if (!authors || authors.length === 0) return [];
    return authors.filter((a) => a?.author).map((a) => a.author as string);
  }, [authors]);

  // Resolve slugs to full person data
  const { people: peopleIndex } = usePeopleIndex();
  const { authors: resolvedAuthors, loading } = useResolveAuthors(slugs);

  // Build display authors - only link to indexed people
  const displayAuthors = useMemo(() => {
    return resolvedAuthors.map((person) => ({
      name: person.name,
      url: person.slug in peopleIndex ? `https://ssw.com.au/people/${person.slug}` : null,
      imageUrl: person.imageUrl || placeholderImg,
    }));
  }, [resolvedAuthors, placeholderImg, peopleIndex]);

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

  if (loading) {
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
