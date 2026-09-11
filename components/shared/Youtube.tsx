import Link from "next/link";
import React from "react";

function renderMarkdownDescription(description: string): React.ReactNode {
  if (!description) return null;
  
  // Split by markdown links [text](url)
  const parts = description.split(/(\[[^\]]+\]\([^)]+\))/g);
  
  // Then process each part for bold markdown **text**
  return parts.map((part, index) => {
    // Check if this part is a markdown link
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, url] = linkMatch;
      if (url.startsWith("/")) {
        return <Link key={index} href={url} className="underline">{label}</Link>;
      }
      return <a key={index} href={url} className="underline" target="_blank" rel="noopener noreferrer">{label}</a>;
    }
    
    // Process bold markdown **text** in non-link parts
    const boldParts = part.split(/(\*\*[^\*]+\*\*)/g);
    return boldParts.map((boldPart, boldIndex) => {
      const boldMatch = boldPart.match(/^\*\*([^\*]+)\*\*$/);
      if (boldMatch) {
        return <strong key={`${index}-${boldIndex}`}>{boldMatch[1]}</strong>;
      }
      return <span key={`${index}-${boldIndex}`}>{boldPart}</span>;
    });
  });
}

export function extractYoutubeId(input?: string | null): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;
  const match = value.match(/(?:youtube\.com\/(?:.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export function YouTubePlayer({ url = "", description = "" }: { url?: string; description?: string }) {
  const videoId = extractYoutubeId(url);

  if (!videoId) {
    return (
      <div className="my-4 rounded-lg border-2 border-dashed p-4 text-sm text-gray-500">
        Please add <strong>Video URL/ID</strong>
      </div>
    );
  }

  return (
    <div className="my-4 space-y-2">
      <div className="relative w-full aspect-video">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={description || "YouTube video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute left-0 top-0 h-full w-full border-0"
        />
      </div>
      {description ? <div className="text-base font-bold">{renderMarkdownDescription(description)}</div> : null}
    </div>
  );
}

function isYouTubeShort(url?: string): boolean {
  if (!url) return false;
  return url.includes("/shorts/");
}

export function YouTubeShorts({ url = "", description = "" }: { url?: string; description?: string }) {
  const videoId = extractYoutubeId(url);
  const isShort = isYouTubeShort(url);

  if (!videoId) {
    return (
      <div className="my-4 rounded-lg border-2 border-dashed p-4 text-sm text-gray-500">
        Please add <strong>Video URL/ID</strong>
      </div>
    );
  }

  return (
    <div className="my-0 rounded-xs">
      <div className={`relative w-full ${isShort ? "max-w-md mx-auto aspect-9/16" : "aspect-video"}`}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={description || (isShort ? "YouTube Shorts video" : "YouTube video")}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute left-0 top-0 h-full w-full border-0 rounded-xs"
        />
      </div>
      {description ? <div className="text-sm sm:text-base font-bold px-2 sm:px-0">{renderMarkdownDescription(description)}</div> : null}
    </div>
  );
}
