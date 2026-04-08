"use client";

import { tinaField } from "tinacms/dist/react";
import ViewToggle from "@/components/ViewToggle";

const FALLBACK_TAGLINE = "Best Practices for Better Software & Better Teams";

interface HomepageHeaderProps {
  homepage: any;
  ruleCount: number;
}

export default function HomepageHeader({ homepage, ruleCount }: HomepageHeaderProps) {
  const tagline = homepage?.tagline ?? FALLBACK_TAGLINE;

  return (
    <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-2 m-4">
      <h1 className="m-0 flex items-end max-sm:flex-col max-sm:items-start">
        <span className="text-ssw-red font-bold text-[2rem]">{ruleCount.toLocaleString("en-US")}&nbsp;</span>
        <span className="text-gray-600 text-base md:text-lg font-normal" data-tina-field={tinaField(homepage, "tagline")}>
          {tagline}
        </span>
      </h1>
      <ViewToggle />
    </div>
  );
}
