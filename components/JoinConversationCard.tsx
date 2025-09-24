import { Card } from "@/components/ui/card";
import { RiTwitterXLine } from "react-icons/ri";

export default function JoinConversationCard() {
  return (
    <Card title="Join The Conversation">
      <div className="flex justify-center">
        <a href="https://twitter.com/intent/tweet?hashtags=SSWRules%2C&original_referer=https%3A%2F%2Fwww.ssw.com.au%2F&ref_src=twsrc%5Etfw%7Ctwcamp%5Ebuttonembed%7Ctwterm%5Ehashtag%7Ctwgr%5ESSWRules" className="flex items-center text-white bg-gray-800 hover:bg-gray-700 rounded-full px-4 py-2">
          <RiTwitterXLine className="inline mr-2" size={24} />
          Post #SSWRules
        </a>
      </div>
    </Card>
  );
}