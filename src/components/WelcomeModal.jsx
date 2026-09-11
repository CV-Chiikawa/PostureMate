function WelcomeModal({ onClose }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="welcome-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <div className="welcome-mark" aria-hidden="true">PC</div>
        <span className="eyebrow">CONTEXT-AWARE POSTURE COACH</span>
        <h2 id="welcome-title">Context-Aware AI Posture Coach</h2>
        <p className="welcome-lead">사용 상황에 따라 서로 다른 자세 기준을 적용하는 AI 자세 코칭 선행 데모입니다.</p>
        <ol className="welcome-steps">
          <li><b>1</b><span>사용할 모드를 선택합니다.</span></li>
          <li><b>2</b><span>데모 모드 또는 실제 카메라를 선택합니다.</span></li>
          <li><b>3</b><span>분석을 시작하고 자세 상태와 코칭을 확인합니다.</span></li>
        </ol>
        <div className="demo-scope"><strong>데모 범위 안내</strong><p>실제 카메라 영상은 사용할 수 있지만 현재 Pose 분석과 AI 코칭은 데모 데이터로 동작합니다.</p></div>
        <button className="primary-button welcome-action" type="button" onClick={onClose} autoFocus>데모 시작하기</button>
      </section>
    </div>
  );
}
export default WelcomeModal;
