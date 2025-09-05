import Link from "next/link";
import { RiTimeFill } from "react-icons/ri";
import { timeAgo } from "@/lib/dateUtils";
import { Card } from "./ui/card";

interface RuleCardProps {
  title: string;
  slug: string;
  lastUpdatedBy?: string | null;
  lastUpdated?: string | null;
  index?: number;
}

export default function RuleCard({
  title,
  slug,
  lastUpdatedBy,
  lastUpdated,
  index
}: RuleCardProps) {
  return (
    <Card className="mb-4">
      <div className="flex">
        {index !== undefined && (
          <span className="text-gray-500 mr-2">#{index + 1}</span>
        )}
        <div className="flex flex-col">
          <Link href={`/${slug}`} className="no-underline">
            <h2 className="m-0 mb-2 text-2xl max-sm:text-lg hover:text-ssw-red">
              {title}
            </h2>
          </Link>
          <h4 className="flex m-0 text-lg max-sm:text-md">
            <span className="font-medium">
              {lastUpdatedBy || 'Unknown'}
            </span>
            {lastUpdated && (
              <div className="flex items-center ml-4 text-gray-500 font-light">
                <RiTimeFill className="inline mr-1" />
                <span>{timeAgo(lastUpdated)}</span>
              </div>
            )}
          </h4>
        </div>
      </div>
    </Card>
  );
}