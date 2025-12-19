import { CodeXml, Info, TriangleAlert } from "lucide-react";
import React from "react";
import { FaLightbulb } from "react-icons/fa6";
import { Template } from "tinacms";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import { toolbarFields } from "@/tina/collection/shared/toolbarFields";
import MarkdownComponentMapping from "../tina-markdown/markdown-component-mapping";
import { Figure, inlineFigureDefaultItem, inlineFigureFields } from "./figure";

type BoxVariant = "greybox" | "info" | "todo" | "china" | "codeauditor" | "highlight" | "warning" | "tips";

type VariantConfig = {
  containerClass: string;
  icon?: JSX.Element;
  textClass?: string;
};

const variantConfig: Record<BoxVariant, VariantConfig> = {
  greybox: {
    containerClass: "bg-gray-100",
  },
  info: {
    containerClass: "bg-white border",
    icon: (
      <div className="w-8 h-8 mr-4 flex items-start justify-center text-ssw-red">
        <Info className="w-8 h-8" />
      </div>
    ),
  },
  todo: {
    containerClass: "bg-white border border-red-500 text-[var(--ssw-red)] font-semibold",
    textClass: "text-[var(--ssw-red)]",
  },
  china: {
    containerClass: "bg-white border",
    icon: (
      <div
        className="w-7 h-6 mt-1 mr-4 shrink-0 rounded"
        style={{
          backgroundImage: 'url("https://raw.githubusercontent.com/SSWConsulting/SSW.Rules/main/static/assets/china-flag-icon.png")',
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    ),
  },
  codeauditor: {
    containerClass: "bg-white border",
    icon: (
      <div className="w-8 h-8 mr-4 flex items-start justify-center text-ssw-red">
        <CodeXml className="w-8 h-8" />
      </div>
    ),
  },
  highlight: {
    containerClass: "bg-yellow-200 text-yellow-900",
  },
  warning: {
    containerClass: "bg-white border",
    icon: (
      <div className="w-8 h-8 mr-4 flex items-start justify-center text-ssw-red">
        <TriangleAlert className="w-8 h-8" />
      </div>
    ),
  },
  tips: {
    containerClass: "bg-white border",
    icon: (
      <div className="w-8 h-8 mr-4 flex items-start justify-center text-ssw-red">
        <FaLightbulb className="w-8 h-8" />
      </div>
    ),
  },
};

export function BoxEmbed(props: any) {
  // Handle both cases: props.data (from BoxEmbedComponent) or props directly (from IntroEmbed)
  const data = props.data || props;

  // Safety check: if data is undefined or null, return null
  if (!data) {
    return null;
  }

  // Support both legacy 'variant' and new 'style' prop names
  const variant: BoxVariant = (data?.style || "greybox") as BoxVariant;
  const config = variantConfig[variant];
  const figure: string = data?.figure || "";
  const figurePrefix: any = data?.figurePrefix || "none";

  const components = {
    ...MarkdownComponentMapping,
    a: ({ children }: any) => <span>{children}</span>,
  };

  return (
    <>
      <div className={`p-4 rounded-sm my-4 ${config.containerClass}`}>
        <div className="flex items-start">
          {config.icon}
          <div className={`[&_p:last-child]:mb-0 ${config.textClass ?? ""}`}>
            <div>
              <TinaMarkdown content={data.body} components={components} />
            </div>
          </div>
        </div>
      </div>
      <Figure prefix={figurePrefix} text={figure} />
    </>
  );
}

export const boxEmbedTemplate: Template = {
  name: "boxEmbed",
  label: "Box",
  ui: {
    defaultItem: {
      body: {
        type: "root",
        children: [
          {
            type: "p",
            children: [{ text: "This is a box." }],
          },
        ],
      },
      ...inlineFigureDefaultItem,
    },
  },
  fields: [
    {
      name: "style",
      label: "Style",
      type: "string",
      options: [
        { value: "greybox", label: "Default (Greybox)" },
        { value: "info", label: "Info" },
        { value: "warning", label: "Warning" },
        { value: "tips", label: "Tip" },
        { value: "highlight", label: "Highlight" },
        { value: "china", label: "China" },
        { value: "codeauditor", label: "Codeauditor" },
        { value: "todo", label: "Todo" },
      ],
    },
    {
      name: "body",
      label: "Body",
      type: "rich-text",
      toolbarOverride: toolbarFields,
    },
    ...(inlineFigureFields as any),
  ],
};

export const boxEmbedComponent = {
  boxEmbed: (props: any) => <BoxEmbed data={props} />,
};
