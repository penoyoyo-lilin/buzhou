export interface PublishDateSource {
  createdAt: string
  publishedAt: string | null
}

export function getPublishedDisplayDate(article: PublishDateSource): string {
  return article.publishedAt || article.createdAt
}
