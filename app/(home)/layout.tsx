import Breadcrumbs from "@/components/Breadcrumbs";
import { Section } from "@/components/layout/section";
import SearchBar from "@/components/SearchBarWrapper";

export const revalidate = 21600; // 6 hours

export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <Section>
      <Breadcrumbs isHomePage />
      <SearchBar />
      {children}
    </Section>
  );
}
