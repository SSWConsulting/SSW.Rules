"use client";

import React from "react";
import { wrapFieldsWithMeta } from "tinacms";

/**
 * Custom TinaCMS field component for the author `url` field.
 *
 * - Renders as **readonly** when the URL is an SSW People link (auto-filled by the AuthorSelector).
 * - Renders as a normal editable input when the URL is empty or a non-SSW link.
 */
const AuthorUrlFieldInner: React.FC<any> = (props) => {
  const { input } = props;
  const value: string = input.value || "";
  const isSswUrl = value.includes("ssw.com.au/people");

  return (
    <div>
      <input
        type="text"
        id={input.name}
        className={`w-full text-sm rounded-full border shadow-inner py-2 px-4 focus:outline-none transition-colors ${
          isSswUrl
            ? "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
            : "bg-white border-gray-200 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        }`}
        value={value}
        onChange={(e) => input.onChange(e.target.value)}
        readOnly={isSswUrl}
        placeholder="https://example.com/author-profile"
      />
      {isSswUrl && <p className="mt-1 text-xs text-gray-400">Auto-filled from SSW people selection</p>}
    </div>
  );
};

export const AuthorUrlField = wrapFieldsWithMeta(AuthorUrlFieldInner);
