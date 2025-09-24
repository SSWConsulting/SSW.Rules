import { Template } from "tinacms";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import React from "react";
import {
  ComponentWithFigure,
  withFigureEmbedTemplateFields,
} from "./componentWithFigure";
import { CodeXml, Info } from "lucide-react";
import MarkdownComponentMapping from "../tina-markdown/markdown-component-mapping";

type AsideVariant =
  | "greybox"
  | "info"
  | "todo"
  | "china"
  | "codeauditor"
  | "highlight";

type VariantConfig = {
    containerClass: string;
    icon?: JSX.Element;
    textClass?: string;
};

const variantConfig: Record<AsideVariant, VariantConfig> = {
    greybox: {
      containerClass: "bg-gray-100 text-gray-800",
    },
    info: {
      containerClass: "bg-white border text-gray-800",
      icon: (
        <div className="w-8 h-8 mr-4 flex items-center justify-center text-[var(--ssw-red)]">
          <Info className="w-8 h-8" />
        </div>
      ),
    },
    todo: {
      containerClass: "bg-white border border-red-500 text-[var(--ssw-red)] font-semibold",
      textClass: "text-[var(--ssw-red)]",
    },
    china: {
      containerClass: "bg-white border text-gray-800",
      icon: (
        <div
          className="w-7 h-6 mt-1 mr-4 flex-shrink-0 rounded"
          style={{
            backgroundImage:
              'url("https://raw.githubusercontent.com/SSWConsulting/SSW.Rules/main/static/assets/china-flag-icon.png")',
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      ),
    },
    codeauditor: {
      containerClass: "bg-white border text-gray-800",
      icon: (
        <div className="w-8 h-8 mr-4 flex items-center justify-center text-[var(--ssw-red)]">
          <CodeXml className="w-8 h-8" />
        </div>
      ),
    },
    highlight: {
      containerClass: "bg-yellow-200 text-yellow-900",
    },
  };

export function AsideEmbed({ data }: { data: any }) {
    const variant: AsideVariant = data.variant || "info";
    const config = variantConfig[variant];
  
    return (
      <ComponentWithFigure data={data}>
        <div className={`p-4 rounded-sm my-4 ${config.containerClass}`}>
            <div className="flex items-start">
            {config.icon}
            <div className={`prose prose-sm max-w-none text-base ${config.textClass ?? ""}`}>
                <TinaMarkdown content={data.body} components={MarkdownComponentMapping} />
            </div>
            </div>
        </div>
      </ComponentWithFigure>
    );
}
  

export const asideEmbedTemplate: Template = withFigureEmbedTemplateFields({
  name: "asideEmbed",
  label: "Aside Box",
  ui: {
    defaultItem: {
      variant: "info",
      body: {
        type: "root",
        children: [
          {
            type: "p",
            children: [{ text: "This is a box." }],
          },
        ],
      },
    },
  },
  fields: [
    {
      name: "variant",
      label: "Variant",
      type: "string",
      options: [
        { value: "greybox", label: "Greybox" },
        { value: "info", label: "Info" },
        { value: "todo", label: "Todo" },
        { value: "china", label: "China" },
        { value: "codeauditor", label: "Codeauditor" },
        { value: "highlight", label: "Highlight" },
      ],
    },
    {
      name: "body",
      label: "Body",
      type: "rich-text",
    },
  ],
});

export const asideEmbedComponent = {
    asideEmbed: (props: any) => <AsideEmbed data={props} />,
};