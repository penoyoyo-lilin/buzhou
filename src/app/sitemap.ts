import type { MetadataRoute } from 'next'
import prisma from '@/core/db/client'

const SITE_URL = 'https://www.buzhou.io'

function asDate(input: Date | string | null | undefined): Date {
  if (!input) return new Date()
  return input instanceof Date ? input : new Date(input)
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/zh`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/en`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/zh/api-docs`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/en/api-docs`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.6,
    },
  ]

  try {
    const articles = await prisma.article.findMany({
      where: { status: 'published' },
      select: {
        slug: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    })

    const articleRoutes: MetadataRoute.Sitemap = articles.flatMap((article) => {
      const lastModified = asDate(article.updatedAt || article.createdAt)
      return [
        {
          url: `${SITE_URL}/zh/articles/${article.slug}`,
          lastModified,
          changeFrequency: 'weekly',
          priority: 0.8,
        },
        {
          url: `${SITE_URL}/en/articles/${article.slug}`,
          lastModified,
          changeFrequency: 'weekly',
          priority: 0.8,
        },
      ]
    })

    return [...staticRoutes, ...articleRoutes]
  } catch (error) {
    console.error('[sitemap] failed to query published articles:', error)
    return staticRoutes
  }
}
