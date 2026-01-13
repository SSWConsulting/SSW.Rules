"use client";

import { formatDate } from "date-fns";
import { useEffect, useState } from "react";
import { FaHistory } from "react-icons/fa";
import { getRelativeTime } from "./get-relative-time";
import type { GitHubMetadataProps, GitHubMetadataResponse } from "./types";

export default function GitHubMetadata({ owner = "tinacms", repo = "tina.io", path, className = "" }: GitHubMetadataProps) {
  const [data, setData] = useState<GitHubMetadataResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGitHubMetadata = async () => {
      try {
        setLoading(true);

        const params = new URLSearchParams({
          owner,
          repo,
        });

        if (path) {
          params.append("path", path);
        }

        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH}/api/github-history?${params.toString()}`);
        const result: GitHubMetadataResponse = await response.json();

        // Log errors for debugging but don't show them to users
        if (!response.ok) {
          console.error("GitHub history API error:", {
            status: response.status,
            error: result.error,
            hasHistoryUrl: !!result.historyUrl,
          });
        }

        // Always use the result if it has historyUrl (even on errors)
        // This ensures historyUrl is always shown
        if (result.historyUrl) {
          setData(result);
        } else {
          setData(null);
        }
      } catch (err) {
        // Log error but don't show it to users
        console.error("Error fetching GitHub metadata:", err);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchGitHubMetadata();
  }, [owner, repo, path]);

  if (loading) {
    return <div className={`text-slate-500 text-sm mb-2 ${className}`}>Loading last updated info...</div>;
  }

  // If we have data with historyUrl, show it even if there's an error
  if (data?.historyUrl) {
    const { latestCommit, firstCommit, historyUrl, otherCoAuthorName } = data;

    // If we have commit data, show the full info
    if (latestCommit) {
      const lastUpdatedDate = latestCommit.commit.author.date;
      const lastUpdateInRelativeTime = getRelativeTime(lastUpdatedDate);
      const lastUpdateInAbsoluteTime = formatDate(lastUpdatedDate, "dd MMM yyyy");
      const createdDate = firstCommit?.commit.author.date;
      const createdTime = createdDate ? formatDate(createdDate, "d MMM yyyy") : null;
      const displayAuthorName = otherCoAuthorName ?? latestCommit.commit.author.name;
      const shouldShowLink = !otherCoAuthorName && Boolean(latestCommit.author?.login);

      const tooltipContent = createdTime ? `Created ${createdTime}\nLast updated ${lastUpdateInAbsoluteTime}` : `Last updated ${lastUpdateInAbsoluteTime}`;

      return (
        <div className={`text-slate-500 text-sm ${className}`}>
          <div className="flex md:flex-row flex-col md:items-center gap-2">
            <span>
              Last updated by{" "}
              <span className="font-bold text-black">
                {shouldShowLink ? (
                  <a href={`https://github.com/${latestCommit.author?.login}`} target="_blank" rel="noopener noreferrer">
                    {displayAuthorName}
                  </a>
                ) : (
                  displayAuthorName
                )}
              </span>
              {` ${lastUpdateInRelativeTime}.`}
            </span>
            <div className="relative group text-black">
              <a
                href={historyUrl}
                target="_blank"
                title={tooltipContent}
                rel="noopener noreferrer"
                className="underline flex flex-row items-center gap-1.5 mb-2 md:mb-0"
              >
                See history
                <FaHistory className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      );
    }

    // If we only have historyUrl but no commit data (error case), just show the history link
    return (
      <div className={`text-slate-500 text-sm ${className}`}>
        <div className="flex md:flex-row flex-col md:items-center gap-2">
          <div className="relative group text-black">
            <a
              href={historyUrl}
              target="_blank"
              title="View commit history on GitHub"
              rel="noopener noreferrer"
              className="underline flex flex-row items-center gap-1.5 mb-2 md:mb-0"
            >
              See history
              <FaHistory className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // No data at all - silently return nothing (don't show error to users)
  return null;
}
