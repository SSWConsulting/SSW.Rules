"use client";

import Link from "next/link";
import { RiTimeFill } from "react-icons/ri";
import { Card } from "@/components/ui/card";
import { timeAgo } from "@/lib/dateUtils";
import { LatestRule } from "@/models/LatestRule";

interface LatestRulesProps {
  rules: LatestRule[];
}

export default function LatestRulesCard({ rules }: LatestRulesProps) {
  return (
    <Card title="Latest Rules">
      <ul>
        {rules.map((rule, index) => (
          <li key={index} className="relative mb-2">
            <Link href={`/${rule?.uri}`}>{rule?.title}</Link>
            {rule?.lastUpdated && (
              <p className="text-sm text-gray-400 mt-1 flex items-center">
                <RiTimeFill className="inline mr-1"></RiTimeFill>
                {timeAgo(rule?.lastUpdated)}
              </p>
            )}
          </li>
        ))}
      </ul>

      <Link href="/latest-rules/?size=50" className="px-4 py-2 rounded-md inline-flex items-center text-ssw-red hover:underline">
        See more
      </Link>
    </Card>
  );
}
