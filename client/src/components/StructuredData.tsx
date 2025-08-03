import React from 'react'

interface StructuredDataProps {
  type: 'WebApplication' | 'Article' | 'BreadcrumbList' | 'FAQPage'
  data: Record<string, any>
}

export const StructuredData: React.FC<StructuredDataProps> = ({ type, data }) => {
  const baseData = {
    '@context': 'https://schema.org',
    '@type': type,
  }

  const jsonLd = { ...baseData, ...data }

  React.useEffect(() => {
    // script要素を作成して追加
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.innerHTML = JSON.stringify(jsonLd)
    document.head.appendChild(script)

    // クリーンアップ
    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [jsonLd])

  return null
}

// Webアプリケーション全体の構造化データ
export const WebApplicationStructuredData: React.FC = () => {
  return (
    <StructuredData
      type="WebApplication"
      data={{
        name: 'いごもん',
        description: '次の一手と理由を投稿し、考えを共有する囲碁サイト',
        applicationCategory: 'GameApplication',
        operatingSystem: 'Any',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'JPY',
        },
        aggregateRating: {
          '@type': 'AggregateRating',
          ratingValue: '4.5',
          ratingCount: '100',
        },
      }}
    />
  )
}

// パンくずリストの構造化データ
interface BreadcrumbItem {
  name: string
  url: string
}

export const BreadcrumbStructuredData: React.FC<{ items: BreadcrumbItem[] }> = ({ items }) => {
  const itemListElement = items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url,
  }))

  return (
    <StructuredData
      type="BreadcrumbList"
      data={{
        itemListElement,
      }}
    />
  )
}
