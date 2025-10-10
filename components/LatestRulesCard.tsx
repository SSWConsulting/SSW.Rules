"use client";

import { Card } from "@/components/ui/card";
import { LatestRule } from "@/models/LatestRule";
import { timeAgo } from "@/lib/dateUtils";
import { RiTimeFill } from "react-icons/ri";
import Link from "next/link";

interface LatestRulesProps {
  rules: LatestRule[];
}

export default function LatestRulesCard({ rules }: LatestRulesProps) {
  return (
    <Card title="Latest Rules">
      {rules.map((rule, index) => (
        <ul key={index} className="ps-4 p-0 m-0">
          <li className="relative mb-2">
            <Link href={`/${rule?.uri}`}>{rule?.title}</Link>
            {rule?.lastUpdated && (
              <p className="text-xs text-gray-400 mt-1 flex items-center">
                <RiTimeFill className="inline mr-2"></RiTimeFill>
                {timeAgo(rule?.lastUpdated)}
              </p>
            )}
          </li>
        </ul>
      ))}

      <div>
        <Link
          href="/latest-rules/?size=50"
          className="px-4 py-2 rounded-md inline-flex items-center text-ssw-red hover:underline"
        >
          See More
        </Link>
      </div>
    </Card>
  );
}
