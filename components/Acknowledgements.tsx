import Image from 'next/image'
import { useEffect, useState } from 'react'

interface Author {
  title?: string
  url?: string
  img?: string
  noimage?: boolean
}

interface AcknowledgementsProps {
  authors: Author[]
}

export default function Acknowledgements({ authors }: AcknowledgementsProps) {
  const placeholderImg = '/uploads/ssw-employee-profile-placeholder-sketch.jpg'

  function getImgSource(author: Author): string {
    const { noimage, img, title, url } = author

    if (noimage) return placeholderImg

    if (img?.includes('http')) return img

    if (url?.includes('ssw.com.au/people') && title) {
      const formattedTitle = title.replace(/ /g, '-')
      return `https://raw.githubusercontent.com/SSWConsulting/SSW.People.Profiles/main/${formattedTitle}/Images/${formattedTitle}-Profile.jpg`
    }

    if (url?.includes('github.com/')) {
      const gitHubUsername = url.split('github.com/').pop()
      return `https://avatars.githubusercontent.com/${gitHubUsername}`
    }

    return placeholderImg
  }

  const [imgSrcList, setImgSrcList] = useState<string[]>(
    authors.map(getImgSource)
  )

  useEffect(() => {
    authors.forEach((author) => {
      if (!author.title) {
        console.warn(`Profile title is missing for author with URL: ${author.url}`)
      }
    })
  }, [authors])

  const handleImageError = (index: number) => {
    setImgSrcList((prev) => {
      const updated = [...prev]
      updated[index] = placeholderImg
      return updated
    })
  }

  return (
    <div className="flex flex-row flex-wrap">
      {authors.map((author, index) => {
        const title = author.title ?? 'Unknown'
        const imgSrc = imgSrcList[index]

        return (
          <div
            className="px-2 flex items-center my-2 justify-center"
            key={`author_${index}`}
          >
            <div className="w-12 h-12 overflow-hidden rounded-full relative">
              <a href={author.url} target="_blank" rel="noopener noreferrer">
                <Image
                  src={imgSrc}
                  alt={title}
                  title={title}
                  fill
                  className="object-cover object-top"
                  onError={() => handleImageError(index)}
                  unoptimized
                />
              </a>
            </div>
          </div>
        )
      })}
    </div>
  )
}
