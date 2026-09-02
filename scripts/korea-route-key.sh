#!/usr/bin/env bash
#
# 한국 자동차 길찾기 키 넣기.
#
#   bash scripts/korea-route-key.sh                  → 발급 페이지를 열고 안내
#   bash scripts/korea-route-key.sh kakao <REST키>    → 카카오 키 확인 후 저장
#   bash scripts/korea-route-key.sh tmap  <appKey>    → 티맵 키 확인 후 저장
#
# ⚠️ 구글은 한국 안에서 자동차 길을 아예 안 준다(실측). 그래서 국내 업체가 필요하다.
# ⚠️ 키는 화면에 다시 찍지 않는다. .env.local 은 git 에 안 올라간다.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$ROOT/.env.local"

if [[ $# -lt 2 ]]; then
  cat <<'GUIDE'

  카카오 길찾기 키 받기 (3분)
  ─────────────────────────────────────────────

  ⭐ 카카오톡 계정이 있으면 그대로 로그인됩니다.
     승인 절차가 없어서 만들자마자 바로 씁니다.

  1. 방금 열린 창에서 카카오 계정으로 로그인
  2. 「내 애플리케이션」 → 「애플리케이션 추가하기」
       앱 이름: withtrip      사업자명: 아무거나
  3. 만든 앱을 눌러 「앱 키」 화면으로
  4. 「REST API 키」 를 복사      ← JavaScript 키 아닙니다

  그다음 이 창에 아래처럼 치면 끝입니다.

      ! bash ~/withtrip/scripts/korea-route-key.sh kakao 복사한키

  (SK 티맵 키를 나중에 받으시면: ... tmap 복사한키)

GUIDE
  open "https://developers.kakao.com/console/app" 2>/dev/null || true
  exit 0
fi

WHICH="$1"; KEY="$2"
if [[ ${#KEY} -lt 10 ]]; then
  echo "❌ 키가 너무 짧습니다. 복사가 덜 된 것 같아요."
  exit 1
fi

# 제주 신화월드 → 제주공항. 실제로 되는 키인지 넣기 전에 확인한다.
echo "→ 키를 확인합니다 (제주 신화월드 → 제주공항)"
case "$WHICH" in
  kakao)
    VAR="KAKAO_REST_KEY"
    RESP="$(curl -s -m 30 -H "Authorization: KakaoAK $KEY" \
      "https://apis-navi.kakaomobility.com/v1/directions?origin=126.3170,33.3070&destination=126.4930,33.5113&priority=RECOMMEND")"
    OK="$(printf '%s' "$RESP" | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception: print('FAIL 응답을 못 읽었습니다'); raise SystemExit
r=(d.get('routes') or [{}])[0]
if r.get('result_code')==0:
    s=r.get('summary') or {}
    print(f\"OK {int(s.get('duration',0))//60}분 {s.get('distance',0)/1000:.1f}km\")
else:
    print('FAIL ' + json.dumps(d,ensure_ascii=False)[:200])
")" ;;
  tmap)
    VAR="TMAP_APP_KEY"
    RESP="$(curl -s -m 30 -X POST "https://apis.openapi.sk.com/tmap/routes?version=1&format=json" \
      -H "Content-Type: application/json" -H "appKey: $KEY" \
      -d '{"startX":"126.3170","startY":"33.3070","endX":"126.4930","endY":"33.5113","reqCoordType":"WGS84GEO","resCoordType":"WGS84GEO","startName":"출발","endName":"도착","searchOption":"0","trafficInfo":"N"}')"
    OK="$(printf '%s' "$RESP" | python3 -c "
import json,sys
try: d=json.load(sys.stdin)
except Exception: print('FAIL 응답을 못 읽었습니다'); raise SystemExit
p=(d.get('features') or [{}])[0].get('properties') or {}
t,m=p.get('totalTime'),p.get('totalDistance')
print(f'OK {int(t)//60}분 {m/1000:.1f}km' if t and m else 'FAIL ' + json.dumps(d,ensure_ascii=False)[:200])
")" ;;
  *) echo "❌ kakao 또는 tmap 중에 골라 주세요"; exit 1 ;;
esac

case "$OK" in
  OK*) echo "   ✅ ${OK#OK }" ;;
  *)   echo "   ❌ 키가 안 먹습니다: ${OK#FAIL }"
       [[ "$WHICH" == kakao ]] && echo "   ⚠️ 「REST API 키」가 맞는지 확인해 주세요 (JavaScript 키 아닙니다)."
       exit 1 ;;
esac

# ── .env.local 에 넣는다 (있으면 갈아끼운다) ────────────────────
touch "$ENV_FILE"
if grep -q "^${VAR}=" "$ENV_FILE"; then
  python3 - "$ENV_FILE" "$VAR" "$KEY" <<'PY'
import sys, re
path, var, key = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(path).read()
s = re.sub(rf'^{re.escape(var)}=.*$', f'{var}={key}', s, flags=re.M)
open(path, 'w').write(s)
PY
  echo "→ .env.local 의 기존 값을 갈아끼웠습니다"
else
  printf '\n%s=%s\n' "$VAR" "$KEY" >> "$ENV_FILE"
  echo "→ .env.local 에 넣었습니다"
fi

# ── Vercel 에도 넣는다 ──────────────────────────────────────────
echo "→ Vercel 에도 넣습니다 (운영에서 쓰려면 필요합니다)"
for ENVNAME in production preview development; do
  printf '%s' "$KEY" | npx --yes vercel env add "$VAR" "$ENVNAME" --force >/dev/null 2>&1 \
    && echo "   ✅ $ENVNAME" || echo "   ⚠️ $ENVNAME 실패 — 콘솔에서 직접 넣어 주세요"
done

cat <<'DONE'

  다 됐습니다. 배포하면 한국 자동차 구간이 실제 값으로 나옵니다.

DONE
