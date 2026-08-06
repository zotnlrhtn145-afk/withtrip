import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "개인정보처리방침 · 위드트립(WITHTRIP)",
  description: "위드트립(WITHTRIP)이 수집·이용하는 개인정보 항목, 목적, 위탁, 보유·파기, 이용자 권리 안내.",
}

const CONTACT_EMAIL = "zotnlrhtn145@gmail.com"
const EFFECTIVE_DATE = "2026년 8월 6일"

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <header className="mb-8 border-b border-slate-100 pb-6">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-500">WITHTRIP · 위드트립</p>
        <h1 className="mt-2 text-2xl font-extrabold text-slate-900 sm:text-3xl">개인정보처리방침</h1>
        <p className="mt-2 text-sm text-slate-500">시행일: {EFFECTIVE_DATE}</p>
      </header>

      <div className="flex flex-col gap-8 text-[15px] leading-relaxed text-slate-700">
        <p>
          위드트립(WITHTRIP, 이하 &ldquo;서비스&rdquo;)은 이용자의 개인정보를 소중히 다루며, 「개인정보 보호법」 등
          관련 법령을 준수합니다. 본 방침은 서비스가 어떤 정보를 수집하고 어떻게 이용·보관하는지, 이용자가 어떤 권리를
          가지는지 설명합니다.
        </p>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">1. 수집하는 개인정보 항목</h2>
          <ul className="flex flex-col gap-2">
            <li>
              <span className="font-bold text-slate-900">계정·인증</span> — 이메일 주소, 비밀번호(암호화 저장),
              소셜 로그인(카카오·구글) 시 제공되는 프로필 정보(닉네임, 프로필 사진).
            </li>
            <li>
              <span className="font-bold text-slate-900">프로필</span> — 닉네임, 프로필 이미지, 정산 수령을 위해
              이용자가 직접 입력한 계좌 정보(선택).
            </li>
            <li>
              <span className="font-bold text-slate-900">서비스 이용 콘텐츠</span> — 여행 일정, 저장한 장소,
              지출·영수증 이미지, 정산 내역, 친구·멤버 간 주고받은 채팅 메시지.
            </li>
            <li>
              <span className="font-bold text-slate-900">위치정보</span> — 주변 맛집·스팟까지의 거리를 계산하기 위한
              기기 위치. 실시간 계산에만 사용하며 서버에 저장하지 않습니다. 권한은 언제든 기기 설정에서 해제할 수 있습니다.
            </li>
            <li>
              <span className="font-bold text-slate-900">사진·카메라</span> — 영수증·장소 사진 등록을 위해 이용자가
              선택한 이미지 및 카메라 촬영 이미지.
            </li>
            <li>
              <span className="font-bold text-slate-900">기기·푸시</span> — 알림 발송을 위한 푸시 토큰, 기기명,
              플랫폼(iOS/Android) 정보.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">2. 개인정보의 이용 목적</h2>
          <ul className="list-disc pl-5">
            <li>회원 가입·인증 및 본인 확인, 계정 관리</li>
            <li>여행 계획·일정·장소 저장, 지출·정산 등 핵심 기능 제공</li>
            <li>친구·여행 멤버 간 공유 및 1:1·단체 채팅 제공</li>
            <li>초대·친구 요청·새 메시지 등 알림 발송</li>
            <li>영수증 이미지의 문자 인식을 통한 지출 자동 입력</li>
            <li>서비스 개선, 오류 대응 및 문의 처리</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">3. 처리 위탁 및 제3자 제공</h2>
          <p>
            서비스는 원활한 운영을 위해 아래 사업자에 개인정보 처리를 위탁하며, 각 사업자는 자체 개인정보 정책에 따라
            정보를 처리합니다. 위탁 목적 범위를 벗어난 이용은 하지 않습니다.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-bold">수탁자</th>
                  <th className="py-2 pr-4 font-bold">위탁 업무</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-semibold">Supabase</td>
                  <td className="py-2 pr-4">데이터 저장, 인증, 백엔드 호스팅</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-semibold">Vercel</td>
                  <td className="py-2 pr-4">웹 서비스 호스팅</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-semibold">Google</td>
                  <td className="py-2 pr-4">지도·장소 검색(Places), 구글 로그인</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-semibold">Kakao</td>
                  <td className="py-2 pr-4">카카오 로그인, 공유</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-semibold">Google Gemini · OpenAI</td>
                  <td className="py-2 pr-4">영수증 이미지 문자 인식(지출 자동 입력)</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-4 font-semibold">Expo</td>
                  <td className="py-2 pr-4">푸시 알림 발송</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-sm text-slate-500">
            법령에 근거가 있거나 수사기관의 적법한 요청이 있는 경우를 제외하고, 이용자의 동의 없이 개인정보를 외부에
            제공하지 않습니다.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">4. 보유 및 파기</h2>
          <p>
            개인정보는 수집·이용 목적이 달성되면 지체 없이 파기합니다. 회원이 탈퇴하면 계정 및 관련 콘텐츠는 삭제되며,
            다만 관계 법령에 따라 보관 의무가 있는 정보는 해당 기간 동안 분리 보관 후 파기합니다.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">5. 이용자의 권리</h2>
          <p>
            이용자는 언제든 자신의 개인정보를 열람·수정·삭제하거나 처리 정지를 요청할 수 있습니다. 앱 내{" "}
            <span className="font-semibold text-slate-900">마이페이지 → 회원 탈퇴</span>를 통해 계정과 데이터 삭제를
            직접 요청할 수 있으며, 아래 이메일로도 요청하실 수 있습니다.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">6. 아동의 개인정보</h2>
          <p>
            서비스는 만 14세 미만 아동을 대상으로 하지 않으며, 만 14세 미만 아동의 개인정보를 고의로 수집하지 않습니다.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">7. 개인정보 보호책임자 및 문의</h2>
          <p>
            개인정보 처리에 관한 문의·불만·피해 구제는 아래로 연락해 주시면 신속히 답변드리겠습니다.
          </p>
          <p className="rounded-xl bg-slate-50 px-4 py-3">
            이메일:{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-amber-600 underline">
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-extrabold text-slate-900">8. 방침의 변경</h2>
          <p>
            본 방침은 법령·서비스 변경에 따라 개정될 수 있으며, 개정 시 서비스 내 공지 또는 본 페이지를 통해 안내합니다.
          </p>
        </section>
      </div>
    </main>
  )
}
