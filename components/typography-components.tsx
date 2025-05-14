import { Prism } from "tinacms/dist/rich-text/prism";

export const typographyComponents = {
  h1: (props) => <h1 className="text-4xl font-bold my-4" {...props} />,
  h2: (props) => <h2 className="mt-8 text-[#333] text-3xl leading-[1.2] mb-4 font-semibold" {...props} />,
  h3: (props) => <h3 className="mt-8 text-[#333] text-2xl leading-[1.2] mb-4 font-semibold" {...props} />,
  h4: (props) => <h4 className="mt-8 text-[#333] text-xl leading-[1.2] mb-4 font-semibold" {...props} />,
  h5: (props) => <h5 className="mt-8 text-[#333] text-lg leading-[1.2] mb-4 font-semibold" {...props} />,
  h6: (props) => <h6 className="mt-8 text-[#333] text-base leading-[1.2] mb-4 font-semibold" {...props} />,
  p: (props: any) => (
    <p className="mb-4" {...props} />
  ),
  ul: (props: any) => <ul className="mb-4 ps-8 list-none m-0 p-0" {...props} />,
  ol: (props: any) => <ol className="mb-4 ps-8 list-decimal m-0 p-0" {...props} />,
  a: (props: any) => (
    <a
      className="underline hover:cursor-pointer hover:text-[#CC4141]"
      {...props}
    />
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
