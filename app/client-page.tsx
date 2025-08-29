"use client";

import { Card } from "@/components/ui/card";
import { Category } from "@/tina/__generated__/types";
import { LatestRule } from "@/models/LatestRule";
import Link from "next/link";
import { timeAgo } from "@/lib/dateUtils";
import { RiTimeFill } from "react-icons/ri";

export interface HomeClientPageProps {
  categories: Category[];
  latestRules: LatestRule[];
}

export default function HomeClientPage(props: HomeClientPageProps) {
  const { categories,latestRules } = props;

  return (
    <>
      <div className="layout-two-columns">
        <Card dropShadow className="layout-main-section">
          <h1 className="font-bold mb-4">Categories</h1>

          {categories.map((category, index) =>
            category.__typename === "CategoryTop_category" ? (
              <h3 key={index} className="font-bold">
                {category.title}
              </h3>
            ) : (
              <ul key={index}>
                <li>
                  <Link href={`/${category._sys.filename}`}>
                    {category.title}
                  </Link>
                </li>
              </ul>
            )
          )}
        </Card>
        <div className="layout-sidebar">
          <Card title="Latest Rules">

          {latestRules.map((rule, index) => (
            <ul key={index}>
              <li>
                <Link href={`/${rule?.uri}`}>
                  {rule?.title}
                </Link>
                {rule?.lastUpdated && 
                <p className="text-gray-500 mt-1">
                  <RiTimeFill className="inline mr-2"></RiTimeFill>
                  {timeAgo(rule?.lastUpdated)}
                </p>}
              </li>
            </ul>
          ))}

            <Link href="/rules/latest-rules/?size=50">
              <button className="px-4 py-2 text-red-600 rounded-md cursor-pointer hover:underline">
                See More
              </button>
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}
