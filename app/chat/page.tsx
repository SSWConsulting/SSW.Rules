import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChatConversation, ChatTitle } from "@/components/chat/ChatConversation";
import { getAuth0 } from "@/lib/auth0";
import { getRulesChatTier } from "@/lib/rulesChatAccess";

export const metadata: Metadata = {
  title: "The Rulekeeper",
  robots: { index: false },
};

export default async function ChatPopOutPage() {
  const session = await getAuth0().getSession();
  if (!(await getRulesChatTier(session?.user))) notFound();

  return (
    // Fills the window over the site layout's padding. The layout leaves out its header and footer on this route.
    <div className="fixed inset-0 z-[1100] flex flex-col bg-white">
      <header className="flex shrink-0 items-center bg-ssw-black px-4 py-3">
        <ChatTitle />
      </header>
      <ChatConversation openLinksInNewTab />
    </div>
  );
}
