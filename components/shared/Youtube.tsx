import React from "react";

export function extractYoutubeId(input?: string | null): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;
  const match = value.match(/(?:youtube\.com\/(?:.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function parseYoutubeTime(raw: string): number | null {
  const match = raw.toLowerCase().match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!match || (!match[1] && !match[2] && !match[3])) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}

/** Reads a start time (seconds) from `t`, `start` or `time_continue` in the query or fragment. Returns null when absent or not > 0. */
export function extractYoutubeStart(url: string): number | null {
  const match = url.match(/[?&#](?:t|start|time_continue)=([^&#?]*)/);
  if (!match) return null;
  const seconds = parseYoutubeTime(match[1]);
  return seconds !== null && seconds > 0 ? seconds : null;
}

export function buildYoutubeEmbedUrl(videoId: string, start: number | null): string {
  const base = `https://www.youtube.com/embed/${videoId}`;
  return start ? `${base}?start=${start}` : base;
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
          src={buildYoutubeEmbedUrl(videoId, extractYoutubeStart(url))}
          title={description || "YouTube video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute left-0 top-0 h-full w-full border-0"
        />
      </div>
      {description ? <div className="text-base font-bold">{description}</div> : null}
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
          src={buildYoutubeEmbedUrl(videoId, extractYoutubeStart(url))}
          title={description || (isShort ? "YouTube Shorts video" : "YouTube video")}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute left-0 top-0 h-full w-full border-0 rounded-xs"
        />
      </div>
      {description ? <div className="text-sm sm:text-base font-bold px-2 sm:px-0">{description}</div> : null}
    </div>
  );
}
