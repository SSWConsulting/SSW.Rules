import { CodeXml, Info, TriangleAlert } from "lucide-react";
import React from "react";
import { FaLightbulb } from "react-icons/fa6";
import { Template } from "tinacms";
import { TinaMarkdown } from "tinacms/dist/rich-text";
import MarkdownComponentMapping from "../tina-markdown/markdown-component-mapping";
import { ComponentWithFigure, withFigureEmbedTemplateFields } from "./componentWithFigure";
import { toolbarFields } from "@/tina/collection/shared/toolbarFields";

type AsideVariant = "greybox" | "info" | "todo" | "china" | "codeauditor" | "highlight" | "warning" | "tips";

type VariantConfig = {
  containerClass: string;
  icon?: JSX.Element;
  textClass?: string;
};

const variantConfig: Record<AsideVariant, VariantConfig> = {
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

export function AsideEmbed(props: any) {
  // Handle both cases: props.data (from asideEmbedComponent) or props directly (from IntroEmbed)
  const data = props.data || props;

  // Safety check: if data is undefined or null, return null
  if (!data) {
    return null;
  }

  const variant: AsideVariant = data?.variant || "info";
  const config = variantConfig[variant];

  return (
    <ComponentWithFigure data={data}>
      <div className={`p-4 rounded-sm my-4 ${config.containerClass}`}>
        <div className="flex items-start">
          {config.icon}
          <div className={`${config.textClass ?? ""}`}>
            <div>
              <TinaMarkdown content={data.body} components={MarkdownComponentMapping} />
            </div>
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
        { value: "warning", label: "Warning" },
        { value: "tips", label: "Tips" },
      ],
    },
    {
      name: "body",
      label: "Body",
      type: "rich-text",
      toolbarOverride: toolbarFields,
    },
  ],
});

export const asideEmbedComponent = {
  asideEmbed: (props: any) => <AsideEmbed data={props} />,
};
