# 위드트립 푸시 알림 발송 (Expo Push)

앱은 로그인 시 기기의 Expo 푸시 토큰을 `device_push_tokens`에 저장한다.
아래 Edge Function들이 각 이벤트(INSERT)에서 수신자의 토큰을 조회해 실제 푸시를 보낸다.

| 함수 | 트리거 테이블 | 내용 |
| --- | --- | --- |
| `send-chat-push` | `trip_messages` | 여행 단톡 새 메시지 → 참여자 |
| `send-dm-push` | `dm_messages` | 1:1 DM 새 메시지 → 상대방 |
| `send-notify-push` | `notifications` | 초대·친구요청·좋아요·댓글·새 클립 → 수신자 |

## 사전 준비 (한 번만)

1. **SQL 실행** — Supabase Dashboard → SQL Editor에서 아래가 실행돼 있어야 함:
   - `device_push_tokens.sql`
   - `dm_chat.sql` (DM), `trip_chat.sql` (단톡), `notifications.sql` (알림)
2. **EAS projectId** — 앱에서 실기기 토큰을 받으려면 `eas init` 후 `app.json`의
   `extra.eas.projectId`가 채워져 있어야 한다. (시뮬레이터/Expo Go는 원격 푸시 미지원)

## 배포

```bash
# 프로젝트에 연결 (한 번)
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>

# 세 함수 배포
supabase functions deploy send-chat-push
supabase functions deploy send-dm-push
supabase functions deploy send-notify-push
```

`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`는 Edge 런타임이 자동 주입하므로 별도 설정 불필요.

## Database Webhook 연결

Supabase Dashboard → **Database → Webhooks → Create a new hook**, 함수마다 하나씩:

| Name | Table | Events | Type | Edge Function |
| --- | --- | --- | --- | --- |
| trip-chat-push | `public.trip_messages` | Insert | Supabase Edge Function | `send-chat-push` |
| dm-push | `public.dm_messages` | Insert | Supabase Edge Function | `send-dm-push` |
| notify-push | `public.notifications` | Insert | Supabase Edge Function | `send-notify-push` |

## 동작 확인

1. 실기기(개발/프로덕션 빌드)로 로그인 → `device_push_tokens`에 토큰이 쌓이는지 확인.
2. 다른 계정에서 친구요청/DM/단톡 발생 → 실기기에 배너 도착.
3. 배너 탭 → 앱이 해당 화면으로 이동(`usePushNotificationRouting`):
   - DM → `/dm/[threadId]`, 단톡 → `/chat/[tripId]`, 그 외 알림 → `/notifications`
4. 로그: Dashboard → Edge Functions → 각 함수 → Logs 에서 `sent` 수 확인.
