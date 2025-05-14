import RulesSearchClient from "@/components/RulesSearchClient";

export default function RulesSearchPage({
  searchParams,
}: {
  searchParams: { keyword?: string };
}) {
  return <RulesSearchClient keyword={searchParams.keyword ?? ''} />;
}
