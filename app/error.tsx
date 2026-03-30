"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import useAppInsights from "@/app/(home)/components/hooks/useAppInsights";
import { Button } from "@/app/(home)/components/ui/button";

export default function Error({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  const { trackException } = useAppInsights();

  useEffect(() => {
    console.error("Unhandled client error:", error);
    trackException(error);
  }, [error, trackException]);

  return (
    <div className="relative z-[1] py-20 max-w-screen-xl mx-auto px-4">
      <div className="flex flex-col items-center text-center">
        <Image src={`${process.env.NEXT_PUBLIC_BASE_PATH}/tina-llama-error.webp`} alt="Error illustration" width={400} height={400} unoptimized />

        <p className="mt-6 text-lg font-medium text-muted-foreground">Oops! Something went wrong.</p>

        <div className="mt-8 max-w-3xl">
          <p className="text-3xl sm:text-4xl font-light text-gray-500">An unexpected error occurred while loading this page.</p>
        </div>

        <div className="mt-12">
          <Button asChild>
            <Link href="/">Go to homepage</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
