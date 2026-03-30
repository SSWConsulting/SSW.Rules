"use client";

import Script from "next/script";
import { useEffect } from "react";
import { YouTubeShorts } from "@/app/(home)/components/shared/Youtube";

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

function InstagramEmbed({ url }: { url: string }) {
  const id = extractInstagramId(url);

  // On SPA navigation the script is already loaded but won't re-scan new blockquotes.
  // Call process() manually whenever the reel ID changes.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).instgrm?.Embeds?.process();
  }, [id]);

  if (!id) {
    return <EmbedFallback message="Invalid Instagram URL. Use a Reel or post link (e.g. instagram.com/reel/XXXXX/)." />;
  }

  return (
    <div className="my-0 flex justify-center">
      {/*
        Official Instagram blockquote embed. Instagram's embed.js transforms this
        into a fully responsive player — no manual chrome clipping needed.
        max-width keeps the widget within the sidebar Card (~290px inner width).
      */}
      <blockquote
        className="instagram-media"
        data-instgrm-permalink={`https://www.instagram.com/reel/${id}/`}
        data-instgrm-version="14"
        style={{ maxWidth: "290px", width: "100%", margin: "0 auto", border: "none" }}
      >
        <a href={`https://www.instagram.com/reel/${id}/`}>View on Instagram</a>
      </blockquote>
      {/* onReady fires on initial load and after every SPA re-mount */}
      <Script
        src="https://www.instagram.com/embed.js"
        strategy="lazyOnload"
        onReady={() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).instgrm?.Embeds?.process();
        }}
      />
    </div>
  );
}

function TikTokEmbed({ url }: { url: string }) {
  const id = extractTikTokId(url);

  if (!id) {
    return <EmbedFallback message="Invalid TikTok URL. Use a video link (e.g. tiktok.com/@user/video/12345)." />;
  }

  return (
    <div className="my-0 flex justify-center overflow-x-hidden">
      {/*
        Official TikTok blockquote embed. TikTok's embed.js handles responsive sizing.
        Setting min/max-width to 290px fits the sidebar. TikTok may internally enforce
        a 325px minimum — overflow-x-hidden on the wrapper clips any slight overflow.
      */}
      <blockquote className="tiktok-embed" cite={url} data-video-id={id} data-embed-from="oembed" style={{ maxWidth: "290px", minWidth: "290px" }}>
        <section>
          <a href={url}>View on TikTok</a>
        </section>
      </blockquote>
      <Script src="https://www.tiktok.com/embed.js" strategy="lazyOnload" />
    </div>
  );
}

function FacebookEmbed({ url }: { url: string }) {
  // On SPA navigation the SDK is already loaded but won't re-scan new fb-video divs.
  // Call FB.XFBML.parse() manually whenever the URL changes.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).FB?.XFBML?.parse();
  }, [url]);

  return (
    <div className="my-0 flex justify-center overflow-x-hidden">
      {/*
        Official Facebook video embed. The SDK transforms <div class="fb-video"> into
        a fully rendered player — no manual sizing or chrome clipping needed.
        data-width caps the player at 290px to match the sidebar Card inner width.
      */}
      <div id="fb-root" />
      <div className="fb-video" data-href={url} data-width="290" data-show-text="false" data-autoplay="false" />
      <Script
        src="https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v25.0"
        strategy="lazyOnload"
        onReady={() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).FB?.XFBML?.parse();
        }}
      />
    </div>
  );
}

function EmbedFallback({ message }: { message: string }) {
  return <div className="my-4 rounded-lg border-2 border-dashed p-4 text-sm text-gray-500">{message}</div>;
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
