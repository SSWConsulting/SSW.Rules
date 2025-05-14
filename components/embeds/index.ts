import { Template } from "tinacms";
import { emailEmbedComponent,  emailEmbedTemplate } from "./emailEmbed";
import { figureEmbedComponent,  figureEmbedTemplate } from "./figureEmbed";
import { imageEmbedComponent,  imageEmbedTemplate } from "./imageEmbed";

export const embedComponents={
    ...emailEmbedComponent,
    ...imageEmbedComponent,
    ...figureEmbedComponent
}

export const embedTemplates:Template[]=[
    emailEmbedTemplate,
    imageEmbedTemplate,
    figureEmbedTemplate
]