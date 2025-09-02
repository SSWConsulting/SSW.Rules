"use client";

import { Card } from "@/components/ui/card";
import { Category } from "@/tina/__generated__/types";
import { LatestRule } from "@/models/LatestRule";
import Link from "next/link";
import { timeAgo } from "@/lib/dateUtils";
import {
  RiDoubleQuotesL,
  RiDoubleQuotesR,
  RiTimeFill,
  RiTwitterXLine,
} from "react-icons/ri";
import { PiGavelFill } from "react-icons/pi";
import SearchBar from "@/components/SearchBar";
import HelpCard from "@/components/HelpCard";
import Image from "next/image";

export interface HomeClientPageProps {
  topCategories: any[];
  latestRules: LatestRule[];
  ruleCount: number;
  categoryRuleCounts: Record<string, number>;
}

export default function HomeClientPage(props: HomeClientPageProps) {
  const { topCategories, latestRules, ruleCount, categoryRuleCounts } = props;

  const getTopCategoryTotal = (subCategories: any[]) => {
    return subCategories.reduce((total, category) => {
      return total + (categoryRuleCounts[category._sys.filename] || 0);
    }, 0);
  };

  return (
    <>
      <div className="layout-two-columns">
        <div className="layout-main-section">
          <SearchBar showSort={false} />

            <h2 className="m-0 mb-4 text-ssw-red font-bold">Categories</h2>
            {topCategories.map((topCategory, index) => (
              <Card key={index} className="mb-4">
                <h2 className="flex justify-between m-0 mb-4 text-2xl max-sm:text-lg">
                  <span>{topCategory.title}</span>
                  <span className="text-gray-500 text-lg">
                    {getTopCategoryTotal(topCategory.index?.map((item: any) => item.category).filter(Boolean) || [])} Rules
                  </span>
                </h2>

                <ol>
                  {topCategory.index?.map((item: any, subIndex: number) => 
                    item.category ? (
                      <li key={subIndex} className="mb-4">
                        <div className=" flex justify-between">
                          <Link href={`/${item.category._sys.filename}`}>
                            {item.category.title}
                          </Link>
                          <span className="text-gray-300">
                            {categoryRuleCounts[item.category._sys.filename] || 0}
                          </span>
                        </div>
                      </li>
                    ) : null
                  )}
                </ol>
              </Card>
            ))}
        </div>

        <div className="layout-sidebar">
          <div className="flex justify-center">
            {ruleCount && (
              <div className="flex">
                <PiGavelFill
                  size={48}
                  className="transform rotate-270 text-[var(--ssw-red)]"
                />
                <div className="flex flex-col justify-center items-center ml-2 ">
                  <span className="text-3xl font-semibold text-[var(--ssw-red)]">
                    {ruleCount.toLocaleString("en-US")}
                  </span>
                  <span className="font-light">SSW Rules</span>
                </div>
              </div>
            )}
          </div>

          <Card title="Latest Rules">
            {latestRules.map((rule, index) => (
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

            <Link href="/rules/latest-rules/?size=50">
              <button className="px-4 py-2 text-red-600 rounded-md cursor-pointer hover:underline">
                See More
              </button>
            </Link>
          </Card>

          <Card title="Why All These Rules?">
            <p className="text-justify">
              Read about the{" "}
              <a
                className="underline"
                href="https://www.codemag.com/article/0605091"
                target="_blank"
                rel="noopener noreferrer"
              >
                History of SSW Rules
              </a>
              , published in CoDe Magazine.
            </p>
          </Card>

          <Card title="Help Improve Our Rules">
            <blockquote>
              <RiDoubleQuotesL className="inline" />
              The SSW Rules website works just like Wikipedia. If you think
              something should be changed, hit the pencil icon and make an edit!
              Or if you are cool{" "}
              <a
                className="underline"
                href="https://twitter.com/adamcogan"
                target="_blank"
                rel="noopener noreferrer"
              >
                tweet me
              </a>
              <RiDoubleQuotesR className="inline ml-1" />
            </blockquote>
            <div className="flex flex-col gap-4 items-center mt-4">
              <Image
                src="https://adamcogan.com/wp-content/uploads/2018/07/adam-bw.jpg"
                alt=""
                className="rounded-full"
                width={96}
                height={96}
              />
              <a
                className="underline text-xl"
                href="https://www.ssw.com.au/people/adam-cogan"
                target="_blank"
                rel="noopener noreferrer"
              >
                Adam Cogan
              </a>
              <p className="font-light">Chief Software Architect as SSW</p>
            </div>
          </Card>
          <HelpCard />
          <Card title="About SSW">
            <p className="text-justify">
              SSW Consulting has over 30 years of experience developing awesome
              Microsoft solutions that today build on top of Angular, React,
              Azure, Azure DevOps, SharePoint, Office 365, .NET Core, WebAPI,
              Dynamics 365, and SQL Server. With 40+ consultants in 5 countries,
              we have delivered the best in the business to more than 1,000
              clients in 15 countries.
            </p>
          </Card>
          <Card title="Join The Conversation">
            <div className="flex justify-center">
              <a className="flex items-center text-white bg-gray-800 hover:bg-gray-700 rounded-full px-4 py-2">
                <RiTwitterXLine className="inline mr-2" size={24} />
                Post #SSWRules
              </a>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
