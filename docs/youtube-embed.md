# YouTubeEmbed Component Documentation

## Overview

The `YouTubeEmbed` component is a reusable React block designed for use with TinaCMS. It allows editors to embed responsive YouTube videos by providing either a full video URL or just the video ID. An optional description can be displayed below the video.

## Fields

| Field         | Type     | Required | Description                                      |
|---------------|----------|----------|--------------------------------------------------|
| `url`         | `string` | Yes      | A full YouTube video URL or an 11-character video ID |
| `description` | `string` | No       | Optional text displayed below the video           |

## Supported URL Formats

The component accepts the following formats for the `url` field:

- Direct video ID:  
  `dQw4w9WgXcQ`

- Standard URL:  
  `https://www.youtube.com/watch?v=dQw4w9WgXcQ`

- Embed URL:  
  `https://www.youtube.com/embed/dQw4w9WgXcQ`

- Short URL:  
  `https://youtu.be/dQw4w9WgXcQ`

If the input does not match any of these formats, the component displays the message:  
`Please add Video URL/ID`

## Start time

A start time in the URL is passed to the embed as `?start=<seconds>`.
It is read from the `t`, `start` or `time_continue` parameter, in the query or the `#` fragment.

- Seconds: `https://youtu.be/dQw4w9WgXcQ?t=93`
- Seconds with suffix: `https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=93s`
- Hours, minutes, seconds: `https://youtu.be/dQw4w9WgXcQ?t=1h2m3s`
- Embed `start`: `https://www.youtube.com/embed/dQw4w9WgXcQ?start=93`
- Fragment: `https://youtu.be/dQw4w9WgXcQ#t=93`

Missing, zero or invalid times start the video at 0:00. A bare video ID has no start time.

## How to Get a YouTube URL or Video ID

1. Open the video on YouTube.
2. Copy the link from the browser address bar, e.g.:  
   `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
3. You can either:
   - Use the full URL, or  
   - Copy only the 11-character ID after `v=`, e.g., `dQw4w9WgXcQ`
