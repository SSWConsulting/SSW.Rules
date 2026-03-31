import Breadcrumbs from "@/app/(home)/components/Breadcrumbs";
import { Section } from "@/app/(home)/components/layout/section";
import SearchBar from "@/app/(home)/components/SearchBarWrapper";

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
