import { useRef, useState } from "react";

function WelcomeModal({ onClose, showDontShowAgain = true }) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [position, setPosition] = useState(() => ({ x: Math.max(12, window.innerWidth - 410), y: 86 }));
  const dragRef = useRef(null);

  const beginDrag = (event) => {
    dragRef.current = { x: event.clientX - position.x, y: event.clientY - position.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event) => {
    if (!dragRef.current) return;
    const width = 380;
    setPosition({
      x: Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX - dragRef.current.x)),
      y: Math.max(72, Math.min(window.innerHeight - 120, event.clientY - dragRef.current.y)),
    });
  };

  const endDrag = (event) => {
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <aside className="guide-popup" style={{ left: position.x, top: position.y }} role="dialog" aria-labelledby="guide-title">
      <div className="guide-popup-header" onPointerDown={beginDrag} onPointerMove={moveDrag} onPointerUp={endDrag}>
        <div><span className="eyebrow">사용 안내</span><strong id="guide-title">Context-Aware AI Posture Coach</strong></div>
        <button type="button" aria-label="사용 안내 닫기" onPointerDown={(event) => event.stopPropagation()} onClick={() => onClose(dontShowAgain)}>×</button>
      </div>
      <p>상황에 따라 서로 다른 자세 기준을 적용하는 선행 데모입니다.</p>
      <ol><li>메뉴에서 분석 설정을 확인하세요.</li><li>데모 모드 또는 실제 카메라를 선택하세요.</li><li>Dashboard에서 분석 시작을 누르세요.</li></ol>
      <div className="guide-scope"><b>실제 영상 사용 가능</b><span>자세 분석과 코칭은 현재 데모 데이터로 동작합니다.</span></div>
      {showDontShowAgain && <label className="dont-show"><input type="checkbox" checked={dontShowAgain} onChange={(event) => setDontShowAgain(event.target.checked)} /> 다음부터 자동으로 열지 않기</label>}
    </aside>
  );
}
export default WelcomeModal;
