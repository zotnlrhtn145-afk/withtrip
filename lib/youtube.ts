/**
 * 유튜브에서 장소를 읽을 재료를 캔다.
 *
 * ## ⚠️ 왜 유튜브가 인스타보다 쉬운가
 *
 * 인스타는 로그인 없이 영상을 안 준다. `/embed/captioned/` 로 우회하던 길도
 * 막혔다(실측 2026-08-25: `contextJSON` 사라짐, `video_url` 0건). 그래서
 * 표지 사진 한 장만 남고, 캡션에 이름이 없으면 거기서 끝이다.
 *
 * 유튜브는 **공개로 열려 있다.**
 *
 *     제목    oEmbed — 키가 필요 없다
 *     설명란  페이지의 `shortDescription` — 전문이 온다 (인스타는 잘린다)
 *     자막    `captionTracks` — ⚠️ **말한 내용이 그대로 글로 온다**
 *
 * 자막이 있으면 **영상을 프레임으로 자를 필요가 없다.** 인스타에서 그렇게
 * 애를 먹던 일이 여기서는 글 한 덩이로 해결된다.
 *
 * ## 비용
 *
 * 여기서 쓰는 건 전부 공개 페이지라 **0원**이다. 유튜브 Data API 를 쓰면
 * 할당량을 먹는데, 제목·설명·자막은 API 없이도 다 얻을 수 있어서 안 쓴다.
 * 늘어나는 비용은 뒤에 붙는 Gemini 호출 1회뿐이고, 그건 인스타와 같다.
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * 주소에서 영상 id 를 뽑는다. 유튜브가 아니면 `null`.
 *
 * ⚠️ 쇼츠·일반·단축 주소가 전부 다르게 생겼다. 공유 버튼이 어느 걸 줄지
 *    모르므로 셋 다 받는다. `?si=…` 같은 추적 꼬리는 무시된다.
 */
export function youtubeVideoId(input: string): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const m = raw.match(
    /(?:youtube\.com\/(?:shorts\/|watch\?(?:[^&]*&)*v=|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/,
  );
  return m ? m[1] : null;
}

export function isYoutubeUrl(input: string): boolean {
  return youtubeVideoId(input) !== null;
}

/**
 * JS 문자열 이스케이프(`\uXXXX`, `\n`)를 푼다.
 *
 * ⚠️ 페이지 안의 `shortDescription` 은 **JSON 문자열 조각**이다. 그대로 쓰면
 *    한글이 `ìì¸` 처럼 깨진다. `JSON.parse` 에 큰따옴표를 씌워 맡기면
 *    유니코드도 줄바꿈도 정확히 풀린다 — 직접 치환하면 반드시 빠뜨린다.
 */
function unescapeJsString(s: string): string {
  try {
    return JSON.parse(`"${s}"`) as string;
  } catch {
    return s;
  }
}

export type YoutubeMaterial = {
  videoId: string;
  title: string;
  description: string;
  transcript: string;
  thumbnails: string[];
  channel: string;
  /** 왜 비었는지 알려면 필요하다 — 배포 서버와 내 맥은 유튜브가 다르게 대한다 */
  diag?: string;
};

/**
 * 자막을 글로 받는다. 없으면 빈 문자열.
 *
 * ⚠️ **한국어를 먼저 고른다.** 자동 번역 트랙이 여러 개 딸려 오는데, 영어
 *    번역본을 집으면 가게 이름이 음역돼서(`안집면장` → `Anjip Myeonjang`)
 *    구글에서 못 찾는다. 원본 언어가 가장 정확하다.
 */
async function fetchTranscript(html: string): Promise<string> {
  const tracks = [
    ...html.matchAll(
      /\{"baseUrl":"(https:\/\/www\.youtube\.com\/api\/timedtext[^"]+)"(.*?)\}/g,
    ),
  ];
  if (tracks.length === 0) return "";

  const score = (meta: string): number => {
    if (/"languageCode":"ko"/.test(meta)) return 0;
    if (/"kind":"asr"/.test(meta)) return 1; // 자동 생성 — 원본 언어일 가능성이 높다
    return 2;
  };
  const best = tracks.slice().sort((a, b) => score(a[2]) - score(b[2]))[0];
  return fetchTrack(unescapeJsString(best[1]).replace(/\\u0026/g, "&"));
}

/** 자막 주소 하나를 글로 바꾼다 */
export async function fetchTrack(url: string): Promise<string> {
  if (!url) return "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return "";
    const xml = await res.text();
    return [...xml.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/g)]
      .map((m) =>
        m[1]
          .replace(/&amp;#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
          .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
          .replace(/&#39;|&apos;/g, "'")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter(Boolean)
      .join(" ")
      .slice(0, 6000); // 긴 영상이 프롬프트를 다 먹지 않게 자른다
  } catch {
    return "";
  }
}

/**
 * 유튜브 플레이어에 직접 묻는다 — 설명란과 자막 목록이 여기 있다.
 *
 * ⚠️ **웹 클라이언트로 물어야 한다.** 실측: `ANDROID`·`IOS` 로 물으면 HTTP 400,
 *    `WEB` 은 200 에 설명란 438자를 준다. 흔히 안드로이드가 잘 통한다고들 하는데
 *    지금은 반대다 — 추측하지 말고 재 보고 고를 것.
 *
 * ⚠️ `playabilityStatus` 가 `UNPLAYABLE` 이어도 **설명란은 온다.** 재생이 막힌
 *    것과 정보를 못 읽는 것은 다르다 — 여기서 포기하면 안 된다.
 */
async function fetchPlayer(
  videoId: string,
  key: string,
): Promise<{ desc: string; title: string; trackUrl: string } | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=${encodeURIComponent(key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": UA },
        body: JSON.stringify({
          videoId,
          contentCheckOk: true,
          racyCheckOk: true,
          context: {
            client: {
              clientName: "WEB",
              clientVersion: "2.20240304.00.00",
              hl: "ko",
              gl: "KR",
            },
          },
        }),
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      videoDetails?: { shortDescription?: string; title?: string };
      captions?: {
        playerCaptionsTracklistRenderer?: {
          captionTracks?: { baseUrl?: string; languageCode?: string; kind?: string }[];
        };
      };
    };
    const tracks =
      j.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    const rank = (t: { languageCode?: string; kind?: string }) =>
      t.languageCode === "ko" ? 0 : t.kind === "asr" ? 1 : 2;
    const best = tracks.slice().sort((a, b) => rank(a) - rank(b))[0];
    return {
      desc: String(j.videoDetails?.shortDescription ?? ""),
      title: String(j.videoDetails?.title ?? ""),
      trackUrl: String(best?.baseUrl ?? ""),
    };
  } catch {
    return null;
  }
}

/**
 * 유튜브 영상 하나에서 읽을 것을 전부 캔다.
 *
 * ⚠️ 자막 조회가 실패해도 **제목·설명은 그대로 돌려준다.** 자막은 보너스지
 *    전제가 아니다 — 대부분의 맛집 영상은 설명란에 주소를 적어 둔다.
 */
export async function fetchYoutubeMaterial(
  url: string,
): Promise<YoutubeMaterial | null> {
  const videoId = youtubeVideoId(url);
  if (!videoId) return null;

  const out: YoutubeMaterial = {
    videoId,
    title: "",
    description: "",
    transcript: "",
    channel: "",
    /*
      ⚠️ `maxresdefault` 는 **없는 영상이 있다**(쇼츠는 특히). 404 나면 화면에
         깨진 사진이 뜨므로, 반드시 있는 `hqdefault` 를 뒤에 같이 넣는다.
    */
    thumbnails: [
      `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    ],
  };

  try {
    /*
      ⚠️ **동의 화면을 건너뛰어야 한다.** 데이터센터 IP 로 들어가면 유튜브가
         쿠키 동의 페이지를 대신 주고, 그 HTML 에는 설명란도 자막도 없다.
         `CONSENT` 쿠키와 `bpctr`(연령 확인 우회) 를 붙이면 본문이 온다.
    */
    const res = await fetch(
      `https://www.youtube.com/watch?v=${videoId}&hl=ko&gl=KR&has_verified=1&bpctr=9999999999`,
      {
        headers: {
          "User-Agent": UA,
          "Accept-Language": "ko-KR,ko;q=0.9",
          Cookie: "CONSENT=YES+cb; SOCS=CAI",
        },
        signal: AbortSignal.timeout(15000),
      },
    );
    out.diag = `http=${res.status}`;
    if (res.ok) {
      const html = await res.text();
      out.diag += ` html=${html.length}`;
      const d = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
      if (d?.[1]) out.description = unescapeJsString(d[1]).slice(0, 4000);
      const t = html.match(/"title":"((?:[^"\\]|\\.)*)","lengthSeconds"/);
      if (t?.[1]) out.title = unescapeJsString(t[1]);
      const c = html.match(/"ownerChannelName":"((?:[^"\\]|\\.)*)"/);
      if (c?.[1]) out.channel = unescapeJsString(c[1]);
      out.transcript = await fetchTranscript(html);
      out.diag += ` desc=${out.description.length} cap=${out.transcript.length}`;

      /*
        ⚠️ **배포 서버에는 플레이어 설정이 빠진 판이 온다.** 실측: 페이지는
           1.1MB 전문이 왔는데 `shortDescription` 도 `captionTracks` 도 0 이었다
           (내 맥에서는 둘 다 왔다 — 그래서 못 알아챘다).

           그럴 때는 유튜브 **자신의 플레이어 API** 에 직접 묻는다. 설명란과
           자막 목록이 여기서 온다.

        ⚠️ 열쇠(`INNERTUBE_API_KEY`)를 코드에 박지 않는다 — 방금 받은 페이지에서
           꺼내 쓴다. 박아 두면 바뀌는 날 조용히 죽는다(모델 이름으로 두 번 당했다).
      */
      if (!out.description || !out.transcript) {
        const k = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
        if (k?.[1]) {
          const pr = await fetchPlayer(videoId, k[1]);
          if (pr) {
            if (!out.description && pr.desc) out.description = pr.desc.slice(0, 4000);
            if (!out.title && pr.title) out.title = pr.title;
            if (!out.transcript && pr.trackUrl)
              out.transcript = await fetchTrack(pr.trackUrl);
            out.diag += ` player(desc=${pr.desc.length} track=${pr.trackUrl ? "y" : "n"})`;
          } else out.diag += " player=fail";
        } else out.diag += " nokey";
      }
    }
  } catch (e) {
    out.diag = `err=${e instanceof Error ? e.name : "unknown"}`;
  }

  if (!out.title) {
    try {
      const r = await fetch(
        `https://www.youtube.com/oembed?url=https://youtu.be/${videoId}&format=json`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (r.ok) {
        const j = (await r.json()) as { title?: string; author_name?: string };
        out.title = String(j.title ?? "");
        if (!out.channel) out.channel = String(j.author_name ?? "");
      }
    } catch {
      /* 제목이 없어도 설명·자막이 있으면 뽑을 수 있다 */
    }
  }

  return out;
}

/**
 * 캔 재료를 AI 에게 넘길 글 한 덩이로 합친다.
 *
 * ⚠️ **어디서 온 글인지 표시를 붙인다.** 제목·설명·자막을 그냥 이어 붙이면
 *    AI 가 자막에 스친 지명을 가게 이름으로 오해한다. 무엇이 제목이고
 *    무엇이 말한 내용인지 알려 주면 판단이 눈에 띄게 정확해진다.
 */
export function youtubeCaption(m: YoutubeMaterial): string {
  const parts: string[] = [];
  if (m.title) parts.push(`[영상 제목] ${m.title}`);
  if (m.description) parts.push(`[설명란]\n${m.description}`);
  if (m.transcript) parts.push(`[영상에서 말한 내용]\n${m.transcript}`);
  return parts.join("\n\n").trim();
}
