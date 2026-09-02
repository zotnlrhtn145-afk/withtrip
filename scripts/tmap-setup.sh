#!/usr/bin/env bash
#
# 티맵 키 넣고 바로 확인하기.
#
#   bash scripts/tmap-setup.sh              → 발급 페이지를 열고 안내
#   bash scripts/tmap-setup.sh <appKey>     → .env.local 에 넣고 실제로 확인
#
# ⚠️ 키는 화면에 절대 다시 찍지 않는다. .env.local 은 git 에 안 올라간다.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"

if [[ $# -eq 0 ]]; then
  cat <<'GUIDE'

  티맵 키 받기 (5분)
  ─────────────────────────────────────────────

  1. 방금 열린 창에서 회원가입 · 로그인
  2. 오른쪽 위 「My Console」 (또는 마이페이지)
  3. 「앱 만들기」 → 이름은 아무거나 (예: withtrip)
  4. 그 앱에 상품 담기 → TMAP 의 「경로안내」
  5. 앱 상세에 뜨는 appKey 를 복사

  그다음 이 창에 아래처럼 치면 끝입니다.

      ! bash ~/withtrip/scripts/tmap-setup.sh 복사한키

  무료 한도는 하루 1,000건입니다.

GUIDE
  open "https://openapi.sk.com" 2>/dev/null || true
  exit 0
fi

KEY="$1"
if [[ ${#KEY} -lt 10 ]]; then
  echo "❌ 키가 너무 짧습니다. 복사가 덜 된 것 같아요."
  exit 1
fi

# ── 1) 실제로 되는 키인지 먼저 확인한다 (넣기 전에) ──────────────
echo "→ 키를 확인합니다 (제주 신화월드 → 제주공항)"
RESP="$(curl -s -m 30 -X POST "https://apis.openapi.sk.com/tmap/routes?version=1&format=json" \
  -H "Content-Type: application/json" -H "appKey: $KEY" \
  -d '{"startX":"126.3170","startY":"33.3070","endX":"126.4930","endY":"33.5113","reqCoordType":"WGS84GEO","resCoordType":"WGS84GEO","startName":"출발","endName":"도착","searchOption":"0","trafficInfo":"N"}')"

OK="$(printf '%s' "$RESP" | python3 -c "
import json,sys
try:
    d=json.load(sys.stdin)
except Exception:
    print('PARSE'); raise SystemExit
p=(d.get('features') or [{}])[0].get('properties') or {}
t,m=p.get('totalTime'),p.get('totalDistance')
if t and m: print(f'OK {int(t)//60}분 {m/1000:.1f}km')
else: print('FAIL ' + json.dumps(d,ensure_ascii=False)[:200])
")"

case "$OK" in
  OK*) echo "   ✅ ${OK#OK }" ;;
  *)   echo "   ❌ 키가 안 먹습니다: ${OK}"; echo "   앱에 「경로안내」 상품이 담겼는지 확인해 주세요."; exit 1 ;;
esac

# ── 2) .env.local 에 넣는다 (있으면 갈아끼운다) ──────────────────
touch "$ENV_FILE"
if grep -q '^TMAP_APP_KEY=' "$ENV_FILE"; then
  python3 - "$ENV_FILE" "$KEY" <<'PY'
import sys, re
path, key = sys.argv[1], sys.argv[2]
s = open(path).read()
s = re.sub(r'^TMAP_APP_KEY=.*$', f'TMAP_APP_KEY={key}', s, flags=re.M)
open(path, 'w').write(s)
PY
  echo "→ .env.local 의 기존 값을 갈아끼웠습니다"
else
  printf '\nTMAP_APP_KEY=%s\n' "$KEY" >> "$ENV_FILE"
  echo "→ .env.local 에 넣었습니다"
fi

# ── 3) Vercel 에도 넣는다 ────────────────────────────────────────
if command -v vercel >/dev/null 2>&1 || [[ -x "$ROOT/node_modules/.bin/vercel" ]]; then
  echo "→ Vercel 에도 넣습니다 (운영에서 쓰려면 필요합니다)"
  for ENVNAME in production preview development; do
    printf '%s' "$KEY" | npx --yes vercel env add TMAP_APP_KEY "$ENVNAME" --force >/dev/null 2>&1 \
      && echo "   ✅ $ENVNAME" || echo "   ⚠️ $ENVNAME 실패 — 콘솔에서 직접 넣어 주세요"
  done
else
  echo "⚠️ Vercel CLI 가 없습니다. 콘솔에서 TMAP_APP_KEY 를 직접 넣어 주세요."
fi

cat <<'DONE'

  다 됐습니다.
  이제 배포하면 한국 자동차 구간이 티맵 값으로 나옵니다.

DONE
