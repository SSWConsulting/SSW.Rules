import React from "react";

export function extractYoutubeId(input?: string | null): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;
  const match = value.match(/(?:youtube\.com\/(?:.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export function extractYoutubeStartTime(input?: string | null): number | null {
  const value = (input ?? "").trim();
  if (!value) return null;

  // Check for 'start' parameter (used in watch and embed URLs)
  const startMatch = value.match(/[?&]start=(\d+)/);
  if (startMatch) return parseInt(startMatch[1], 10);

  // Check for 't' parameter (used in watch and short URLs)
  const tMatch = value.match(/[?&]t=(\d+)s?/);
  if (tMatch) return parseInt(tMatch[1], 10);

  return null;
}

export function YouTubePlayer({ url = "", description = "" }: { url?: string; description?: string }) {
  const videoId = extractYoutubeId(url);
  const startTime = extractYoutubeStartTime(url);

  if (!videoId) {
    return (
      <div className="my-4 rounded-lg border-2 border-dashed p-4 text-sm text-gray-500">
        Please add <strong>Video URL/ID</strong>
      </div>
    );
  }

  const embedUrl = startTime ? `https://www.youtube.com/embed/${videoId}?start=${startTime}` : `https://www.youtube.com/embed/${videoId}`;
  const youtubeWatchUrl = `https://www.youtube.com/watch?v=${videoId}${startTime ? `&t=${startTime}s` : ""}`;

  return (
    <div className="my-4 space-y-2">
      <div className="relative w-full aspect-video">
        <iframe
          src={embedUrl}
          title={description || "YouTube video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute left-0 top-0 h-full w-full border-0"
        />
      </div>
      <div className="flex flex-col gap-2">
        {description ? <div className="text-base font-bold">{description}</div> : null}
        <a
          href={youtubeWatchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ssw-red hover:underline text-sm font-medium"
        >
          Watch on YouTube →
        </a>
      </div>
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
  const startTime = extractYoutubeStartTime(url);

  if (!videoId) {
    return (
      <div className="my-4 rounded-lg border-2 border-dashed p-4 text-sm text-gray-500">
        Please add <strong>Video URL/ID</strong>
      </div>
    );
  }

  const embedUrl = startTime ? `https://www.youtube.com/embed/${videoId}?start=${startTime}` : `https://www.youtube.com/embed/${videoId}`;
  const youtubeWatchUrl = `https://www.youtube.com/watch?v=${videoId}${startTime ? `&t=${startTime}s` : ""}`;

  return (
    <div className="my-0 rounded-xs">
      <div className={`relative w-full ${isShort ? "max-w-md mx-auto aspect-9/16" : "aspect-video"}`}>
        <iframe
          src={embedUrl}
          title={description || (isShort ? "YouTube Shorts video" : "YouTube video")}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute left-0 top-0 h-full w-full border-0 rounded-xs"
        />
      </div>
      <div className="flex flex-col gap-2 px-2 sm:px-0">
        {description ? <div className="text-sm sm:text-base font-bold">{description}</div> : null}
        <a
          href={youtubeWatchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ssw-red hover:underline text-sm font-medium w-fit"
        >
          Watch on YouTube →
        </a>
      </div>
    </div>
  );
}
