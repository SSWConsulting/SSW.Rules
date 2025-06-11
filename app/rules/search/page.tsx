import Layout from '@/components/layout/layout';
import { Section } from '@/components/layout/section';
import RulesSearchClientPage from './client-page';

export const revalidate = 300;

export default function RulesSearchPage() {
    return (
        <Layout>
            <Section>
                <RulesSearchClientPage />
            </Section>
        </Layout>
    );
}
