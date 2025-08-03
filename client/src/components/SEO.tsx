import React from 'react'
import { useHelmet } from '../hooks/useHelmet'

interface SEOProps {
  title?: string
  description?: string
  image?: string
  url?: string
  type?: string
}

// 環境変数のデフォルト値
const defaultImage = (import.meta.env?.VITE_DEFAULT_OG_IMAGE as string) || '/og-image.png'
const defaultUrl = (import.meta.env?.VITE_SITE_URL as string) || 'https://igomon.com'
const defaultSiteName = (import.meta.env?.VITE_SITE_NAME as string) || 'いごもん'

export const SEO: React.FC<SEOProps> = ({
  title = 'いごもん - 囲碁アンケートサイト',
  description = '次の一手と理由を投稿し、考えを共有する囲碁サイト',
  image = defaultImage,
  url = defaultUrl,
  type = 'website',
}) => {
  const siteName = defaultSiteName
  const siteTitle = title === 'いごもん - 囲碁アンケートサイト' ? title : `${title} | ${siteName}`

  // カスタムフックを使用してメタタグを設定
  useHelmet({
    title: siteTitle,
    description: description,
    ogTitle: siteTitle,
    ogDescription: description,
    ogImage: image,
    ogUrl: url,
    ogType: type,
    ogSiteName: siteName,
    twitterCard: 'summary_large_image',
    twitterTitle: siteTitle,
    twitterDescription: description,
    twitterImage: image,
    canonical: url,
  })

  return null
}
