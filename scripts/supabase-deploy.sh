#!/usr/bin/env bash
# 위드트립 Supabase 자동 배포
# - Edge Function 3개 배포 (send-chat-push / send-dm-push / send-notify-push)
# - 각 함수용 Database Webhook(트리거) 생성 (idempotent)
# - device_push_tokens 테이블 보장
#
# 필요한 것: 딱 한 번, 본인 Supabase 개인 접근 토큰만.
#   1) https://supabase.com/dashboard/account/tokens 에서 "Generate new token"
#   2) 아래처럼 환경변수로 넣기 (한 번만):
#        export SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxx
#   3) 이 스크립트 실행:  bash scripts/supabase-deploy.sh
#
# 토큰은 스크립트/깃에 저장하지 않는다. env 로만 읽는다.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# supabase CLI 는 프로젝트 의존성으로 넣지 않는다(Vercel 빌드 깨짐). npx 로 실행.
supa() { npx --yes supabase@latest "$@"; }
ENV_FILE="$ROOT/.env.local"

# ── 사전 점검 ────────────────────────────────────────────────
if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "❌ SUPABASE_ACCESS_TOKEN 이 설정돼 있지 않습니다."
  echo "   https://supabase.com/dashboard/account/tokens 에서 토큰을 만들고:"
  echo "     export SUPABASE_ACCESS_TOKEN=sbp_xxx"
  echo "   한 뒤 다시 실행하세요."
  exit 1
fi
[[ -f "$ENV_FILE" ]]     || { echo "❌ .env.local 없음"; exit 1; }

# ── 프로젝트 ref / anon key 추출 ─────────────────────────────
SUPA_URL="$(grep -E '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)"
ANON_KEY="$(grep -E '^NEXT_PUBLIC_SUPABASE_ANON_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs)"
REF="$(echo "$SUPA_URL" | sed -E 's#https?://([a-z0-9]+)\.supabase\.co.*#\1#')"

if [[ -z "$REF" || -z "$ANON_KEY" ]]; then
  echo "❌ .env.local 에서 project ref / anon key 를 못 읽었습니다."
  exit 1
fi
echo "▸ 프로젝트: $REF"

FUNCS=(send-chat-push send-dm-push send-notify-push)

# ── 1) 함수 배포 (webhook-triggered → JWT 검증 끔) ───────────
for fn in "${FUNCS[@]}"; do
  echo "▸ 배포: $fn"
  supa functions deploy "$fn" --project-ref "$REF" --no-verify-jwt
done

# ── Management API 로 SQL 실행하는 헬퍼 ─────────────────────
run_sql() {
  local sql="$1"
  local body
  body="$(python3 -c 'import json,sys; print(json.dumps({"query": sys.stdin.read()}))' <<< "$sql")"
  local resp
  resp="$(curl -sS -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    --data "$body")"
  if echo "$resp" | grep -qiE '"(message|error)"[[:space:]]*:'; then
    echo "  ⚠ SQL 응답: $resp"
  fi
}

# ── 2) 필수 테이블 보장 (없으면 생성; 전부 idempotent) ──────
echo "▸ 테이블 확인/생성 (device_push_tokens · DM · 단톡 · 신고/차단)"
run_sql "$(cat "$ROOT/supabase/device_push_tokens.sql")"
run_sql "$(cat "$ROOT/supabase/dm_chat.sql")"
run_sql "$(cat "$ROOT/supabase/trip_chat.sql")"
run_sql "$(cat "$ROOT/supabase/moderation.sql")"
run_sql "$(cat "$ROOT/supabase/place_recommendations.sql")"
run_sql "$(cat "$ROOT/supabase/notifications_place_rec_type.sql")"

# ── 3) Webhook 트리거 (pg_net 직접 호출; supabase_functions 불필요) ──
# 테이블 → (함수, 트리거명) 매핑
declare -a HOOKS=(
  "trip_messages:send-chat-push:wt_push_trip_chat"
  "dm_messages:send-dm-push:wt_push_dm"
  "notifications:send-notify-push:wt_push_notify"
)

echo "▸ pg_net 웹훅 트리거 생성"
run_sql "create extension if not exists pg_net;"

# 공통 트리거 함수: INSERT 된 행을 Edge Function 으로 POST (record 형태)
run_sql "
create or replace function public.wt_push_webhook() returns trigger
language plpgsql security definer set search_path = public as \$fn\$
declare v_url text := TG_ARGV[0];
begin
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('type', TG_OP, 'table', TG_TABLE_NAME, 'record', to_jsonb(NEW)),
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer ${ANON_KEY}',
      'apikey','${ANON_KEY}'
    ),
    timeout_milliseconds := 5000
  );
  return NEW;
end
\$fn\$;
"

for hook in "${HOOKS[@]}"; do
  IFS=':' read -r table fn trigger <<< "$hook"
  url="${SUPA_URL%/}/functions/v1/${fn}"
  run_sql "
    drop trigger if exists ${trigger} on public.${table};
    create trigger ${trigger}
      after insert on public.${table}
      for each row execute function public.wt_push_webhook('${url}');
  "
  echo "  ✓ ${table} → ${fn}"
done

echo ""
echo "✅ 완료. 실기기에서 로그인 → 이벤트 발생 시 푸시가 도착합니다."
echo "   (실기기 토큰 발급에는 app.json 의 extra.eas.projectId 가 필요: 'eas init')"
