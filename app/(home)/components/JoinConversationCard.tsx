import { tinaField } from "tinacms/dist/react";
import { RiTwitterXLine } from "react-icons/ri";

interface JoinConversationCardProps {
  data?: any;
}

export default function JoinConversationCard({ data }: JoinConversationCardProps) {
  const hashtag = data?.hashtag || "SSWRules";
  const platformUrl =
    data?.platformUrl ||
    "https://twitter.com/intent/tweet?hashtags=SSWRules%2C&original_referer=https%3A%2F%2Fwww.ssw.com.au%2F&ref_src=twsrc%5Etfw%7Ctwcamp%5Ebuttonembed%7Ctwterm%5Ehashtag%7Ctwgr%5ESSWRules";

  return (
    <div className="flex justify-center">
      <a
        href={platformUrl}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="flex items-center text-white bg-gray-800 hover:bg-gray-700 rounded-full px-4 py-2"
        data-tina-field={tinaField(data, "hashtag")}
      >
        <RiTwitterXLine className="inline mr-2" size={24} />
        Post #{hashtag}
      </a>
    </div>
  );
}
