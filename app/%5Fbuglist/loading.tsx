/**
 * 목록·상세를 여는 동안 뜨는 표시.
 *
 * ⚠️ 흰 화면만 보이면 눌린 건지 멈춘 건지 알 수 없다. `loading.tsx` 는
 *    Next.js 가 그 폴더 아래 **모든 화면**에 자동으로 씌워 준다 —
 *    탭을 옮기든 상세로 들어가든 같은 표시가 뜬다.
 */
export default function BugListLoading() {
  return (
    <div className="bl-busy" role="status" aria-live="polite">
      <div className="bl-busy-in">
        <span className="face" aria-hidden>
          🤔
        </span>
        <span className="what">불러오는 중이에요</span>
        <span className="sub">잠시만요</span>
      </div>
    </div>
  )
}
