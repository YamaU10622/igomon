import { useEffect } from 'react'

interface HelmetProps {
  title?: string
  description?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  ogUrl?: string
  ogType?: string
  ogSiteName?: string
  twitterCard?: string
  twitterTitle?: string
  twitterDescription?: string
  twitterImage?: string
  canonical?: string
}

export const useHelmet = (props: HelmetProps) => {
  useEffect(() => {
    // タイトルの更新
    if (props.title) {
      document.title = props.title
    }

    // メタタグの更新または作成
    const updateMetaTag = (selector: string, attribute: string, content: string) => {
      let element = document.querySelector(selector) as HTMLMetaElement
      if (!element) {
        element = document.createElement('meta')
        if (selector.includes('property=')) {
          element.setAttribute('property', attribute.split('=')[1].replace(/['"]/g, ''))
        } else if (selector.includes('name=')) {
          element.setAttribute('name', attribute.split('=')[1].replace(/['"]/g, ''))
        }
        document.head.appendChild(element)
      }
      element.content = content
    }

    // descriptionメタタグ
    if (props.description) {
      updateMetaTag('meta[name="description"]', 'name="description"', props.description)
    }

    // OGPメタタグ
    if (props.ogTitle) {
      updateMetaTag('meta[property="og:title"]', 'property="og:title"', props.ogTitle)
    }
    if (props.ogDescription) {
      updateMetaTag('meta[property="og:description"]', 'property="og:description"', props.ogDescription)
    }
    if (props.ogImage) {
      updateMetaTag('meta[property="og:image"]', 'property="og:image"', props.ogImage)
    }
    if (props.ogUrl) {
      updateMetaTag('meta[property="og:url"]', 'property="og:url"', props.ogUrl)
    }
    if (props.ogType) {
      updateMetaTag('meta[property="og:type"]', 'property="og:type"', props.ogType)
    }
    if (props.ogSiteName) {
      updateMetaTag('meta[property="og:site_name"]', 'property="og:site_name"', props.ogSiteName)
    }

    // Twitter Cardメタタグ
    if (props.twitterCard) {
      updateMetaTag('meta[name="twitter:card"]', 'name="twitter:card"', props.twitterCard)
    }
    if (props.twitterTitle) {
      updateMetaTag('meta[name="twitter:title"]', 'name="twitter:title"', props.twitterTitle)
    }
    if (props.twitterDescription) {
      updateMetaTag('meta[name="twitter:description"]', 'name="twitter:description"', props.twitterDescription)
    }
    if (props.twitterImage) {
      updateMetaTag('meta[name="twitter:image"]', 'name="twitter:image"', props.twitterImage)
    }

    // canonical link
    if (props.canonical) {
      let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement
      if (!canonicalLink) {
        canonicalLink = document.createElement('link')
        canonicalLink.setAttribute('rel', 'canonical')
        document.head.appendChild(canonicalLink)
      }
      canonicalLink.href = props.canonical
    }

    // ロケールメタタグ（常に設定）
    updateMetaTag('meta[property="og:locale"]', 'property="og:locale"', 'ja_JP')
  }, [props])
}