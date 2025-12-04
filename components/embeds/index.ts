import { Template } from "tinacms";
import { boxEmbedComponent, boxEmbedTemplate } from "./boxEmbed";
import { emailEmbedComponent, emailEmbedTemplate } from "./emailEmbed";
import { endIntroComponent, endIntroTemplate } from "./endIntro";
import { imageEmbedComponent, imageEmbedTemplate } from "./imageEmbed";
import { youtubeEmbedComponent, youtubeEmbedTemplate } from "./youtubeEmbed";

export const embedComponents = {
  ...endIntroComponent,
  ...emailEmbedComponent,
  ...imageEmbedComponent,
  ...boxEmbedComponent,
  ...youtubeEmbedComponent,
};

export const embedTemplates: Template[] = [endIntroTemplate, emailEmbedTemplate, imageEmbedTemplate, boxEmbedTemplate, youtubeEmbedTemplate];
