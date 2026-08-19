"use client"

import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { createClient } from "@/utils/supabase/client"

import { createBugAction } from "../actions"

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

  useEffect(() => {
    setEnv(guessDevice())
  }, [])

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
      try {
        const ext = item.file.name.split(".").pop()?.toLowerCase() || (item.kind === "video" ? "mp4" : "jpg")
        const path = `${crypto.randomUUID()}.${ext}`
        const { error } = await supabase.storage.from("bug-media").upload(path, item.file, {
          contentType: item.file.type || undefined,
          upsert: false,
        })
        if (error) throw error
        setPicked((p) => p.map((x) => (x.url === item.url ? { ...x, path, done: true } : x)))
      } catch (e) {
        setErr(`첨부를 올리지 못했습니다: ${e instanceof Error ? e.message : ""}`)
        setPicked((p) => p.filter((x) => x.url !== item.url))
      }
    }
  }

  const remove = (url: string) => {
    setPicked((p) => p.filter((x) => x.url !== url))
    URL.revokeObjectURL(url)
  }

  const uploading = picked.some((p) => !p.done)

  const submit = async (fd: FormData) => {
    setBusy(true)
    setErr(null)
    fd.set("severity", severity)
    fd.set("platform", env.platform)
    fd.set("device", env.device)
    fd.set("os_version", env.os)
    fd.set(
      "media",
      picked.filter((p) => p.path).map((p) => `${p.kind}|${p.path}|${p.file.size}`).join("\n")
    )
    try {
      await createBugAction(fd)
    } catch (e) {
      // redirect() 도 예외로 올라온다 — 진짜 오류만 보여 준다
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("NEXT_REDIRECT")) return
      setErr(msg || "보내지 못했습니다")
      setBusy(false)
    }
  }

  return (
    <form action={submit}>
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

      <button className="bl-btn" type="submit" disabled={busy || uploading}>
        {uploading ? "첨부 올리는 중…" : busy ? "보내는 중…" : "신고 보내기"}
      </button>
      <button type="button" className="bl-btn line" onClick={() => router.back()}>
        취소
      </button>
    </form>
  )
}
