import { defineConfig } from "tinacms";
import Global from "./collection/global";
import nextConfig from "../next.config";
import Category from "./collection/category";
import Rule from "./collection/rule";

const branch = process.env.NEXT_PUBLIC_TINA_BRANCH ?? "main";
const localContentPath = process.env.LOCAL_CONTENT_RELATIVE_PATH ?? undefined;
const clientId = process.env.NEXT_PUBLIC_TINA_CLIENT_ID;
const token = process.env.TINA_TOKEN;
const searchToken = process.env.TINA_SEARCH_TOKEN;
const basePath = process.env.TINA_BASE_PATH ?? undefined;

const config = defineConfig({
  clientId: clientId,
  token: token,
  branch: branch,
  localContentPath: localContentPath,
  media: {
    // If you wanted cloudinary do this
    // loadCustomStore: async () => {
    //   const pack = await import("next-tinacms-cloudinary");
    //   return pack.TinaCloudCloudinaryMediaStore;
    // },
    // this is the config for the tina cloud media store
    tina: {
      publicFolder: "public",
      mediaRoot: "uploads",
    },
  },
  build: {
    publicFolder: "public", // The public asset folder for your framework
    outputFolder: "admin", // within the public folder
    basePath: nextConfig.basePath?.replace(/^\//, "") || "", // The base path of the app (could be /blog)
  },
  schema: {
    collections: [Global, Category, Rule],
  },
  // search: {
  //   tina: {
  //     indexerToken: searchToken,
  //     stopwordLanguages: ['eng'],
  //   },
  //   indexBatchSize: 100,
  //   maxSearchIndexFieldLength: 100,
  // },
});

export default config;
