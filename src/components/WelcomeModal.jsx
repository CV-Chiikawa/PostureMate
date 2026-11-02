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
        <div><span className="eyebrow">사용 안내</span><strong id="guide-title">PostureMate</strong></div>
        <button type="button" aria-label="사용 안내 닫기" onPointerDown={(event) => event.stopPropagation()} onClick={() => onClose(dontShowAgain)}>×</button>
      </div>
      <p>상황에 맞는 기준으로 자세를 살펴보는 AI 코칭 선행 데모입니다.</p>
      <ol><li>상단 메뉴에서 사용할 모드를 고르세요.</li><li>분석 화면에서 입력 방식을 확인하세요.</li><li>분석 시작을 눌러 세션을 시작하세요.</li></ol>
      <div className="guide-scope"><b>실제 영상 사용 가능</b><span>자세 판정은 데모입니다. 거북목 모드에서는 기본 안내 뒤에 SOLAR 코칭이 표시될 수 있습니다.</span></div>
      <div className="guide-actions">
        {showDontShowAgain && <label className="dont-show"><input type="checkbox" checked={dontShowAgain} onChange={(event) => setDontShowAgain(event.target.checked)} /> 다음부터 자동으로 열지 않기</label>}
        <button className="secondary-button guide-close" type="button" onClick={() => onClose(dontShowAgain)}>닫기</button>
      </div>
    </aside>
  );
}
export default WelcomeModal;
