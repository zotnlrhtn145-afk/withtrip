"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { createClient } from "@/utils/supabase/client"



type Picked = { file: File; url: string; kind: "image" | "video"; path?: string; done: boolean }

const MAX_MB = 50

/** 어느 기기에서 썼는지 브라우저가 아는 만큼 알아낸다 */
function guessDevice() {
  if (typeof navigator === "undefined") return { platform: "web", device: "", os: "" }
  const ua = navigator.userAgent
  const isAndroid = /Android/i.test(ua)
  const isIOS = /iPhone|iPad|iPod/i.test(ua)

  let device = ""
  let os = ""
  if (isAndroid) {
    os = `안드로이드 ${ua.match(/Android\s([\d.]+)/)?.[1] ?? ""}`.trim()
    // "SM-S911N Build/..." 같은 모델명이 들어 있는 경우가 많다
    device = ua.match(/;\s?([^;)]+)\sBuild\//)?.[1]?.trim() ?? "안드로이드 기기"
  } else if (isIOS) {
    os = `iOS ${(ua.match(/OS\s([\d_]+)/)?.[1] ?? "").replace(/_/g, ".")}`.trim()
    device = /iPad/.test(ua) ? "iPad" : "iPhone"
  } else {
    os = navigator.platform || ""
    device = "PC 브라우저"
  }
  return { platform: isAndroid ? "android" : isIOS ? "ios" : "web", device, os }
}

export function NewBugForm() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [severity, setSeverity] = useState<"low" | "mid" | "high">("mid")
  const [picked, setPicked] = useState<Picked[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [env, setEnv] = useState({ platform: "android", device: "", os: "" })
  /*
    올리는 중인 첨부들. 보내기를 누르면 이걸 기다린다.
    ⚠️ 예전엔 하나라도 안 끝나면 **보내기 단추를 아예 막았다.** 업로드가 실패하거나
       멈추면 단추가 영영 회색으로 죽어서, 새로고침 말고는 방법이 없었다(신고받음).
       이제는 막지 않고, 누르면 기다렸다가 보낸다.
  */
  const inflight = useRef<Promise<void>[]>([])
  /* 기다린 뒤에는 상태가 바뀌어 있다 — 최신 값을 봐야 방금 끝난 첨부가 붙는다 */
  const pickedRef = useRef<Picked[]>([])

  useEffect(() => {
    setEnv(guessDevice())
  }, [])

  useEffect(() => {
    pickedRef.current = picked
  }, [picked])

  // ⚠️ 미리보기로 만든 주소는 놓아 주지 않으면 계속 메모리를 잡고 있는다
  useEffect(() => () => picked.forEach((p) => URL.revokeObjectURL(p.url)), [picked])

  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setErr(null)

    const next: Picked[] = []
    for (const file of Array.from(files)) {
      if (file.size > MAX_MB * 1024 * 1024) {
        setErr(`${file.name} 은(는) 너무 큽니다 (${MAX_MB}MB까지). 화면 녹화는 짧게 잘라 주세요.`)
        continue
      }
      next.push({
        file,
        url: URL.createObjectURL(file),
        kind: file.type.startsWith("video") ? "video" : "image",
        done: false,
      })
    }
    if (next.length === 0) return
    setPicked((p) => [...p, ...next])

    /*
      ⚠️ 고르자마자 올려 둔다. '보내기' 를 누른 뒤에 올리기 시작하면 영상이
         큰 날에는 한참 멈춰 있게 되고, 그동안 다시 누르게 된다.
    */
    for (const item of next) {
      const job = (async () => {
        try {
          const ext = item.file.name.split(".").pop()?.toLowerCase() || (item.kind === "video" ? "mp4" : "jpg")
          const path = `${crypto.randomUUID()}.${ext}`
          /*
            ⚠️ 시간 제한을 둔다. 전파가 나쁠 때 업로드가 끝나지도 실패하지도 않고
               매달려 있는 일이 있는데, 그러면 화면이 통째로 멈춘 것처럼 된다.
          */
          const upload = supabase.storage.from("bug-media").upload(path, item.file, {
            contentType: item.file.type || undefined,
            upsert: false,
          })
          const timeout = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("시간 초과")), 90_000)
          )
          const { error } = (await Promise.race([upload, timeout])) as { error: unknown }
          if (error) throw error
          setPicked((p) => p.map((x) => (x.url === item.url ? { ...x, path, done: true } : x)))
        } catch {
          // 실패한 첨부는 빼고, 글은 그대로 보낼 수 있게 둔다
          setPicked((p) => p.filter((x) => x.url !== item.url))
          setErr("사진 하나를 올리지 못했어요. 그 사진만 빼고 보낼 수 있어요.")
        }
      })()
      inflight.current.push(job)
      void job
    }
  }

  const remove = (url: string) => {
    setPicked((p) => p.filter((x) => x.url !== url))
    URL.revokeObjectURL(url)
  }

  const uploading = picked.some((p) => !p.done)

  /**
   * 보내기.
   *
   * ⚠️ 서버 액션이 아니라 **평범한 API 주소**로 보낸다. 서버 액션은 새 배포가
   *    올라가면 이전 화면의 주소가 무효가 되어, 쓰던 사람이 "Load failed" 만
   *    보고 글을 못 보냈다(아이폰 사파리에서 실제로 겪음).
   *
   * ⚠️ 한 번은 **다시 시도한다.** 폰에서는 잠깐 끊기는 일이 흔한데, 길게 쓴 글을
   *    한 번 실패했다고 날려 버리면 다시 쓸 마음이 안 든다.
   */
  const submit = async (fd: FormData) => {
    const bodyText = String(fd.get("body") ?? "").trim()
    if (!bodyText) {
      setErr("무슨 일이 있었는지 적어 주세요")
      return
    }

    setBusy(true)
    setErr(null)

    // 아직 올라가는 중인 첨부가 있으면 여기서 기다린다 (단추를 막는 대신)
    if (inflight.current.length > 0) {
      await Promise.allSettled(inflight.current)
      inflight.current = []
    }

    const payload = {
      body: bodyText,
      severity,
      platform: env.platform,
      device: env.device,
      os_version: env.os,
      media: pickedRef.current
        .filter((p) => p.path)
        .map((p) => ({ kind: p.kind, path: p.path as string, bytes: p.file.size })),
    }

    const send = async () => {
      const res = await fetch("/api/buglist/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!res.ok || !json.ok) throw new Error(json.error || `보내지 못했습니다 (${res.status})`)
    }

    try {
      try {
        await send()
      } catch {
        // 한 번 더 — 잠깐 끊긴 것뿐일 수 있다
        await new Promise((r) => setTimeout(r, 1200))
        await send()
      }
      router.replace("/_buglist?s=mine")
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      setErr(
        /load failed|failed to fetch|networkerror/i.test(msg)
          ? "연결이 잠깐 끊겼어요. 쓰신 내용은 그대로 있으니 다시 눌러 주세요."
          : msg || "보내지 못했습니다"
      )
      setBusy(false)
    }
  }

  /* 첨부를 올리는 중인지, 보내는 중인지 — 무엇을 기다리는지 말해 준다 */
  const busyWhat = busy ? (uploading ? "첨부를 올리는 중" : "신고를 보내는 중") : null

  return (
    <form action={submit}>
      {busyWhat ? (
        <div className="bl-busy" role="status" aria-live="polite">
          <div className="bl-busy-in">
            <span className="face" aria-hidden>
              🤔
            </span>
            <span className="what">{busyWhat}이에요</span>
            <span className="sub">
              {uploading ? "영상은 조금 걸릴 수 있어요" : "잠시만요"}
            </span>
          </div>
        </div>
      ) : null}
      <div className="bl-fld">
        <span className="bl-lbl">얼마나 불편한가요</span>
        <div className="bl-segs">
          {([["low", "낮음"], ["mid", "보통"], ["high", "심각"]] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={`bl-seg${k === "high" ? " danger" : ""}`}
              aria-pressed={severity === k}
              onClick={() => setSeverity(k)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="bl-fld">
        <label className="bl-lbl" htmlFor="body">
          무슨 일이 있었나요
        </label>
        {/*
          ⚠️ 예전엔 제목 칸을 따로 뒀는데, 같은 말을 두 번 쓰게 만드는 꼴이라
             다들 제목만 쓰고 내용을 비웠다. 한 칸으로 합치고 목록 제목은
             첫 줄에서 뽑는다.
        */}
        <textarea id="body" name="body" required maxLength={4000} rows={6}
          placeholder={"눌렀던 순서대로 적어 주시면 가장 빨리 고칩니다.\n예) 맛집 상세 → 리뷰 쓰기 → 사진 고르기에서 아무 일도 안 일어나요"} />
      </div>

      <div className="bl-fld">
        <span className="bl-lbl">사진·영상</span>
        <label className="bl-drop">
          눌러서 고르세요
          <br />
          <b>화면 녹화</b>가 가장 도움이 됩니다 · {MAX_MB}MB까지
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => {
              void add(e.target.files)
              e.target.value = ""
            }}
          />
        </label>

        {picked.length > 0 && (
          <div className="bl-picked">
            {picked.map((p) => (
              <div className="bl-pk" key={p.url} style={p.done ? undefined : { opacity: 0.45 }}>
                {p.kind === "video" ? <video src={p.url} muted playsInline /> : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.url} alt="" />
                )}
                <button type="button" className="x" aria-label="빼기" onClick={() => remove(p.url)}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/*
        ⚠️ 기기·버전을 사람에게 적게 하면 "갤럭시요" 로 끝난다.
           브라우저가 아는 만큼 자동으로 붙이고, 무엇이 함께 가는지 보여 준다.
      */}
      <div className="bl-auto">
        <b>자동으로 함께 보냄</b>
        <br />
        {[env.device, env.os].filter(Boolean).join(" · ") || "기기 정보를 읽는 중…"}
      </div>

      {err && <div className="bl-err">{err}</div>}

      {/*
        ⚠️ 업로드 중이라고 단추를 막지 않는다. 막아 두면 업로드가 한 번 꼬였을 때
           손 쓸 방법이 없어진다 — 눌러 두면 기다렸다가 알아서 보낸다.
      */}
      <button className="bl-btn" type="submit" disabled={busy}>
        {busy ? "보내는 중…" : uploading ? "신고 보내기 (첨부 올리는 중)" : "신고 보내기"}
      </button>
      <button type="button" className="bl-btn line" onClick={() => router.back()}>
        취소
      </button>
    </form>
  )
}
