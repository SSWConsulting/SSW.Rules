import { Prism } from "tinacms/dist/rich-text/prism";

export const typographyComponents = {
  p: (props: any) => (
    <p className="mb-4" {...props} />
  ),
  blockquote: (props: any) => (
    <blockquote
      className="border-l-2 border-black my-4 pl-4 italic text-[#666]"
      {...props}
    />
  ),
  code: (props: any) => (
    <code className="bg-[#f4f4f4] py-1 px-2 rounded-sm" {...props} />
  ),
  code_block: (props) => {
    if (!props) {
      return <></>;
    }
    return <Prism lang={props.lang} value={props.value} />;
  },
};
