import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/UserClientProvider";

const ACCESS_URL = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat/access`;

// One check per signed-in user, shared by every component that asks.
let cached: { userId: string; allowed: Promise<boolean> } | null = null;

function checkAccess(userId: string): Promise<boolean> {
  if (cached?.userId !== userId) {
    const allowed = fetch(ACCESS_URL).then(async (response) => {
      if (!response.ok) throw new Error(`Access check returned ${response.status}`);
      const { allowed } = await response.json();
      return allowed === true;
    });
    // A failed check is not remembered, so the next component to ask tries again.
    allowed.catch(() => {
      if (cached?.allowed === allowed) cached = null;
    });
    cached = { userId, allowed };
  }
  return cached.allowed;
}

export function useRulesChatAccess(): boolean {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState(false);
  const userId = user?.sub;

  useEffect(() => {
    if (!userId) {
      setAllowed(false);
      return;
    }
    let alive = true;
    checkAccess(userId)
      .then((result) => {
        if (alive) setAllowed(result);
      })
      .catch((error) => console.error("[RulesChat] access check failed:", error));
    return () => {
      alive = false;
    };
  }, [userId]);

  return allowed;
}
