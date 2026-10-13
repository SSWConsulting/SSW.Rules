"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CHAT_POPOUT_PATH } from "@/components/chat/chatPopOut";

// The pop-out chat window shows only the chat, so the site's header and footer are left out of the page, not just hidden.
export function HiddenOnChatPopOut({ children }: { children: ReactNode }) {
  return usePathname() === CHAT_POPOUT_PATH ? null : children;
}
