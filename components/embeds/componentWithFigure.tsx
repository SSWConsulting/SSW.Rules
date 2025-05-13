import { Template } from "tinacms";
import { FigureEmbed, figureEmbedFields, figureEmbedFieldsDefaultValue } from "./figureEmbed";

export function ComponentWithFigure({
  data,
  children,
}: {
  data: { figureEmbed?: any };
  children: React.ReactNode;
}) {
  return (
    <div>
      {children}
      <FigureEmbed data={data.figureEmbed} />
    </div>
  );
}

export function withFigureEmbedTemplateFields(template: Template): Template {
    return {
      ...template,
      ui: {
        ...template.ui,
        defaultItem: {
          ...template.ui?.defaultItem,
          figureEmbed: figureEmbedFieldsDefaultValue,
        },
      },
      fields: [...template.fields, figureEmbedFields as any],
    };
  }