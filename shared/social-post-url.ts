/** 공유 설명에 다른 URL이 있어도 실제 Threads 게시물 경로만 사용합니다. */
export function normalizeThreadsUrl(input: string): string | null {
  const match = String(input ?? "").match(/(?:^|[\s(<「])(?:https?:\/\/)?(?:www\.)?threads\.(?:net|com)\/(share\/[A-Za-z0-9_-]+|@[A-Za-z0-9_.]+\/post\/[A-Za-z0-9_-]+)(?=[/?#\s)>」.,!]|$)/i)
  return match ? `https://www.threads.com/${match[1]}/` : null
}
