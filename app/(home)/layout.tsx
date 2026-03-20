import Breadcrumbs from "@/components/Breadcrumbs";
import { Section } from "@/components/layout/section";
import SearchBar from "@/components/SearchBarWrapper";
import ViewToggle from "@/components/ViewToggle";
import { fetchRuleCount } from "@/lib/services/rules";

export const revalidate = 21600; // 6 hours

export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  const ruleCount = await fetchRuleCount();

  return (
    <Section>
      <Breadcrumbs isHomePage />
      <SearchBar />
      <div className="flex items-center justify-between flex-wrap gap-x-4 gap-y-2 m-4">
        <h1 className="m-0 flex items-end max-sm:flex-col max-sm:items-start">
          <span className="text-ssw-red font-bold text-[2rem]">{ruleCount.toLocaleString("en-US")}&nbsp;</span>
          <span className="text-gray-600 text-lg font-normal">Best Practices for Better Software & Better Teams</span>
        </h1>
        <ViewToggle />
      </div>
      {children}
    </Section>
  );
}
