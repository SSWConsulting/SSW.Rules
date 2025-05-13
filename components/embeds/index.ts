import { Template } from "tinacms";
import { emailEmbedComponent,  emailEmbedTemplate } from "./emailEmbed";
import { figureEmbedComponent,  figureEmbedTemplate } from "./figureEmbed";

export const embedComponents={
    ...emailEmbedComponent,
    ...figureEmbedComponent
}

export const embedTemplates:Template[]=[
    emailEmbedTemplate,
    figureEmbedTemplate
]