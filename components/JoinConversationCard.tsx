import { Card } from "@/components/ui/card";
import { RiTwitterXLine } from "react-icons/ri";

export default function JoinConversationCard() {
  return (
    <Card title="Join The Conversation">
      <div className="flex justify-center">
        <a className="flex items-center text-white bg-gray-800 hover:bg-gray-700 rounded-full px-4 py-2">
          <RiTwitterXLine className="inline mr-2" size={24} />
          Post #SSWRules
        </a>
      </div>
    </Card>
  );
}