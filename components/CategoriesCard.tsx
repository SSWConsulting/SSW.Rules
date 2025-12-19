import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { tinaField } from 'tinacms/dist/react'

interface CategoryItem {
  category?: {
    uri: string
    title?: string
  }
}

interface CategoriesCardProps {
  categories?: CategoryItem[] | null
}

export default function CategoriesCard({ categories }: CategoriesCardProps) {
  const mapped =
    (categories || [])
      .map(c => c?.category)
      .filter((c): c is { uri: string; title?: string } => !!c)

  if (!mapped || mapped.length === 0) {
    return <></>
  }

  return (
    <Card title="Categories">
      <div className="flex flex-wrap gap-4">
        {mapped.map((c, index) => (
          <Link
            key={c.uri}
            href={`/${c.uri}`}
            className="border-2 no-underline border-ssw-red text-ssw-red py-1 px-2 rounded-xs font-semibold hover:text-white hover:bg-ssw-red transition-colors duration-200"
            // @ts-expect-error tinacms types are wrong
            data-tina-field={tinaField(categories?.[index], "category")}
          >
            {c.title?.replace(/^Rules to better\s*/i, "")}
          </Link>
        ))}
      </div>
    </Card>
  )
}


