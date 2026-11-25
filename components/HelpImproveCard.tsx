import React from "react";
import { RiDoubleQuotesL, RiDoubleQuotesR } from "react-icons/ri";
import { tinaField } from "tinacms/dist/react";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import { Card } from "@/components/ui/card";

interface HelpImproveCardProps {
  data?: any;
}

// TinaMarkdown renders nothing for a plain string, so the fallback is JSX, not markdown
const fallbackQuote = (
  <span>
    The SSW Rules website works just like Wikipedia. If you think something should be changed, hit the pencil icon and make an edit! Or if you are cool{" "}
    <a className="underline" href="https://twitter.com/adamcogan" target="_blank" rel="noopener noreferrer nofollow">
      tweet me
    </a>
  </span>
);

export default function HelpImproveCard({ data }: HelpImproveCardProps) {
  const personName = data?.personName || "Adam Cogan";
  const personTitle = data?.personTitle || "Chief Software Architect at SSW";
  const personImage = data?.personImage || "https://adamcogan.com/wp-content/uploads/2018/07/adam-bw.jpg";
  const personProfileUrl = data?.personProfileUrl || "https://www.ssw.com.au/people/adam-cogan";

  return (
    <Card title={data?.title || "Help Improve Our Rules"}>
      <blockquote data-tina-field={tinaField(data, "quote")}>
        <RiDoubleQuotesL className="inline" />
        {data?.quote ? (
          <TinaMarkdown
            content={data.quote}
            components={{
              p: (props?: { children: React.ReactNode }) => <span>{props?.children}</span>,
              a: (props?: { url: string; children: React.ReactNode }) => (
                <a className="underline" href={props?.url} target="_blank" rel="noopener noreferrer nofollow">
                  {props?.children}
                </a>
              ),
            }}
          />
        ) : (
          fallbackQuote
        )}
        <RiDoubleQuotesR className="inline ml-1" />
      </blockquote>
      <div className="flex flex-col gap-4 items-center mt-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={personImage} alt="" className="rounded-full" width={96} height={96} />
        <a className="underline text-xl" href={personProfileUrl} target="_blank" rel="noopener noreferrer" data-tina-field={tinaField(data, "personName")}>
          {personName}
        </a>
        <p className="font-light" data-tina-field={tinaField(data, "personTitle")}>
          {personTitle}
        </p>
      </div>
    </Card>
  );
}
