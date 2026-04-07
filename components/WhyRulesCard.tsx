import React from "react";
import { tinaField } from "tinacms/dist/react";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import { Card } from "@/components/ui/card";

interface WhyRulesCardProps {
  data?: any;
}

export default function WhyRulesCard({ data }: WhyRulesCardProps) {
  return (
    <Card title={data?.title || "Why All These Rules?"}>
      <div data-tina-field={tinaField(data, "body")}>
        {data?.body ? (
          <TinaMarkdown
            content={data.body}
            components={{
              a: (props?: { url: string; children: React.ReactNode }) => (
                <a className="underline" href={props?.url} target="_blank" rel="noopener noreferrer nofollow">
                  {props?.children}
                </a>
              ),
            }}
          />
        ) : (
          <p>
            Read about the{" "}
            <a className="underline" href="https://www.codemag.com/article/0605091" target="_blank" rel="noopener noreferrer nofollow">
              History of SSW Rules
            </a>
            , published in CoDe Magazine.
          </p>
        )}
      </div>
    </Card>
  );
}
