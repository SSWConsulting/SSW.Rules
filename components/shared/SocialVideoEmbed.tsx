import React from "react";
import { YouTubeShorts } from "@/components/shared/Youtube";

type Platform = "youtube" | "instagram" | "tiktok" | "facebook" | "unknown";

function detectPlatform(url: string): Platform {
  if (/youtube\.com|youtu\.be/.test(url)) return "youtube";
  if (/instagram\.com/.test(url)) return "instagram";
  if (/tiktok\.com/.test(url)) return "tiktok";
  if (/facebook\.com|fb\.watch/.test(url)) return "facebook";
  return "unknown";
}

function extractInstagramId(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

function extractTikTokId(url: string): string | null {
  const match = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  return match ? match[1] : null;
}

// Instagram's embed renders at a fixed width. We cap at 290px to safely fit inside the
// sidebar Card (inner width ≈ 276–308px depending on viewport).
// The header/footer pixel values clip the Instagram chrome (avatar row + action buttons).
// If the video appears slightly cut, tweak INSTAGRAM_HEADER_PX / INSTAGRAM_FOOTER_PX by ±10px.
const INSTAGRAM_FIXED_WIDTH = 290;
const INSTAGRAM_HEADER_PX = 88; // avatar + name + Follow button + close icon row
const INSTAGRAM_FOOTER_PX = 230; // ❤️💬✈️ row + view count + comments + "View more on Instagram" + logo
const INSTAGRAM_VIDEO_HEIGHT = Math.round((INSTAGRAM_FIXED_WIDTH * 16) / 9); // ~517px for a 9:16 reel
const INSTAGRAM_IFRAME_HEIGHT = INSTAGRAM_VIDEO_HEIGHT + INSTAGRAM_HEADER_PX + INSTAGRAM_FOOTER_PX;

function InstagramEmbed({ url }: { url: string }) {
  const id = extractInstagramId(url);
  if (!id) {
    return <EmbedFallback message="Invalid Instagram URL. Use a Reel or post link (e.g. instagram.com/reel/XXXXX/)." />;
  }

  return (
    <div className="my-0 flex justify-center">
      {/* Fixed-width container: predictable clip regardless of sidebar width */}
      <div
        className="relative overflow-hidden rounded-xs"
        style={{ width: INSTAGRAM_FIXED_WIDTH, height: INSTAGRAM_VIDEO_HEIGHT }}
      >
        <iframe
          src={`https://www.instagram.com/reel/${id}/embed/`}
          title="Instagram Reel"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          scrolling="no"
          className="absolute left-0 border-0"
          style={{
            top: -INSTAGRAM_HEADER_PX,
            width: INSTAGRAM_FIXED_WIDTH,
            height: INSTAGRAM_IFRAME_HEIGHT,
          }}
        />
      </div>
    </div>
  );
}

function TikTokEmbed({ url }: { url: string }) {
  const id = extractTikTokId(url);
  if (!id) {
    return <EmbedFallback message="Invalid TikTok URL. Use a video link (e.g. tiktok.com/@user/video/12345)." />;
  }

  // TikTok embed/v2 has ~180px of chrome (top bar with author/caption + bottom controls/CTA).
  // Using aspect-[9/22] instead of aspect-9/16 adds the extra height so the video
  // portion fills the player without being zoomed/cropped. Width is capped at 290px
  // to match the Instagram embed and stay within the sidebar Card.
  return (
    <div className="my-0">
      <div className="relative w-full max-w-[290px] mx-auto aspect-[9/22] rounded-xs">
        <iframe
          src={`https://www.tiktok.com/embed/v2/${id}`}
          title="TikTok video"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          scrolling="no"
          className="absolute left-0 top-0 h-full w-full border-0 rounded-xs"
        />
      </div>
    </div>
  );
}

function FacebookEmbed({ url }: { url: string }) {
  const encodedUrl = encodeURIComponent(url);

  return (
    <div className="my-0 rounded-xs">
      <div className="relative w-full max-w-md mx-auto aspect-9/16">
        <iframe
          src={`https://www.facebook.com/plugins/video.php?href=${encodedUrl}&show_text=false&autoplay=false`}
          title="Facebook video"
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          scrolling="no"
          className="absolute left-0 top-0 h-full w-full border-0 rounded-xs"
        />
      </div>
    </div>
  );
}

function EmbedFallback({ message }: { message: string }) {
  return (
    <div className="my-4 rounded-lg border-2 border-dashed p-4 text-sm text-gray-500">
      {message}
    </div>
  );
}

export function SocialVideoEmbed({ url = "" }: { url?: string }) {
  if (!url.trim()) {
    return <EmbedFallback message="Please add a video URL." />;
  }

  const platform = detectPlatform(url);

  switch (platform) {
    case "youtube":
      return <YouTubeShorts url={url} />;
    case "instagram":
      return <InstagramEmbed url={url} />;
    case "tiktok":
      return <TikTokEmbed url={url} />;
    case "facebook":
      return <FacebookEmbed url={url} />;
    default:
      return <EmbedFallback message="Unsupported video URL. Supported platforms: YouTube, Instagram, TikTok, Facebook." />;
  }
}
