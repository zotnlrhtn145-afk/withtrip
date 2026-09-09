import type { MetadataRoute } from "next"

/**
 * 검색 봇 + AI 봇(GPTBot·ClaudeBot·PerplexityBot)에게 템플릿 길을 열어 준다.
 * ⚠️ /share(사적 링크)·/api·관리자 쪽은 막는다.
 */
export default function robots(): MetadataRoute.Robots {
  const disallow = ["/share/", "/api/", "/%5Fadmin", "/mypage", "/notifications", "/settlement"]
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      { userAgent: "GPTBot", allow: ["/templates", "/llms.txt"], disallow },
      { userAgent: "ClaudeBot", allow: ["/templates", "/llms.txt"], disallow },
      { userAgent: "PerplexityBot", allow: ["/templates", "/llms.txt"], disallow },
      { userAgent: "Google-Extended", allow: ["/templates", "/llms.txt"], disallow },
    ],
    sitemap: "https://www.withtrip.co.kr/sitemap.xml",
  }
}
