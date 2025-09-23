import { Card } from "@/components/ui/card";
import { LatestRule } from "@/models/LatestRule";
import Link from "next/link";
import { timeAgo } from "@/lib/dateUtils";
import { RiTimeFill } from "react-icons/ri";

interface LatestRulesProps {
  rules: LatestRule[];
}

export default function LatestRulesCard({ rules }: LatestRulesProps) {
  return (
    <Card title="Latest Rules">
      {rules.map((rule, index) => (
        <ul key={index}>
          <li>
            <Link href={`/${rule?.uri}`}>{rule?.title}</Link>
            {rule?.lastUpdated && (
              <p className="text-gray-500 mt-1">
                <RiTimeFill className="inline mr-2"></RiTimeFill>
                {timeAgo(rule?.lastUpdated)}
              </p>
            )}
          </li>
        </ul>
      ))}

      <Link href="/latest-rules/?size=50">
        <button className="px-4 py-2 text-[var(--ssw-red)] rounded-md cursor-pointer hover:underline">
          See More
        </button>
      </Link>
    </Card>
  );
}
