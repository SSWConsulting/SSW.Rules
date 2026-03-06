"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Unhandled client error:", error);
  }, [error]);

  return (
    <div className="relative z-[1] py-20 max-w-screen-xl mx-auto px-4">
      <div className="flex flex-col items-center text-center">
        {/* Llama AI image */}
        <img
          src="/uploads/authors/llamantha.png"
          alt="Llamantha the AI llama"
          className="w-40 h-40 rounded-full object-cover"
        />

        {/* Error heading */}
        <p className="mt-6 text-lg font-medium text-muted-foreground">Oops! Something went wrong.</p>

        {/* Verdict text */}
        <div className="mt-8 max-w-3xl">
          <p className="text-3xl sm:text-4xl font-light text-gray-500">The verdict is in...</p>
          <p className="mt-2 text-3xl sm:text-4xl font-light text-gray-500">
            SSW Rules has concluded that an unexpected error has occurred.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-12 flex gap-4">
          <Button onClick={reset} variant="default">
            Try again
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go to homepage</Link>
          </Button>
        </div>

        {/* Error details */}
        {error.message && (
          <p className="mt-8 text-sm text-muted-foreground font-mono bg-gray-100 px-4 py-2 rounded max-w-xl break-all">
            {error.message}
          </p>
        )}
      </div>
    </div>
  );
}
