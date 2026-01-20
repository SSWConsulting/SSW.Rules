"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { tinaField } from "tinacms/dist/react";
import { Card } from "@/components/ui/card";

interface Author {
  title?: string;
  url?: string;
  img?: string;
  noimage?: boolean;
}

interface AuthorsCardProps {
  authors?: Author[];
}

export default function AuthorsCard({ authors }: AuthorsCardProps) {
  const resolvedAuthors: Author[] = useMemo(() => authors || [], [authors]);
  const placeholderImg = `${process.env.NEXT_PUBLIC_BASE_PATH}/uploads/ssw-employee-profile-placeholder-sketch.jpg`;

  const getImgSource = useCallback(
    (author: Author): string => {
      const { noimage, img, url } = author;

      if (noimage) return placeholderImg;

      if (img?.includes("http")) return img;

      if (url?.includes("ssw.com.au/people")) {
        // Extract the part after '/people/'
        const match = url.match(/people\/([^/?#]+)/);
        const slug = match ? match[1] : null;

        if (slug) {
          // Capitalize each word
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
    },
    [placeholderImg]
  );

  const [imgSrcList, setImgSrcList] = useState<string[]>([]);

  useEffect(() => {
    if (resolvedAuthors.length > 0) {
      setImgSrcList(resolvedAuthors.map(getImgSource));
    }
  }, [resolvedAuthors, getImgSource]);

  useEffect(() => {
    if (resolvedAuthors.length > 0) {
      resolvedAuthors.forEach((author) => {
        if (!author.title) {
          console.warn(`Profile title is missing for author with URL: ${author.url}`);
        }
      });
    }
  }, [resolvedAuthors]);

  const handleImageError = (index: number) => {
    setImgSrcList((prev) => {
      const updated = [...prev];
      // If the placeholder image also fails, set to empty string to prevent infinite loop
      if (updated[index] === placeholderImg) {
        updated[index] = "";
        return updated;
      }
      updated[index] = placeholderImg;
      return updated;
    });
  };

  if (!authors || authors.length === 0) {
    return <></>;
  }

  return (
    <Card title="Authors">
      <div className="flex flex-row flex-wrap">
        {resolvedAuthors.map((author, index) => {
          const title = author.title ?? "Unknown";
          const imgSrc = imgSrcList[index];

          return (
            <div className="px-2 flex items-center my-2 justify-center" key={`author_${index}`}>
              {/* @ts-expect-error tinacms types are wrong */}
              <div className="w-12 h-12 overflow-hidden rounded-full relative" data-tina-field={tinaField(authors?.[index], "title")}>
                <a href={author.url} target="_blank" rel="noopener noreferrer">
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
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
