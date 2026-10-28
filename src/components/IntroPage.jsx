import { useEffect, useState } from "react";
import { MODES } from "../config/modes";
import ModeArtwork from "./ModeArtwork";

const carouselModes = ["presentation", "neck", "interview"];
const introCopy = {
  interview: "면접 상황에 맞는 안정적인 앉은 자세와 손·무릎 배치를 확인합니다.",
  neck: "화면을 오래 볼 때 나타나는 목과 상체의 자세 변화를 살펴봅니다.",
  presentation: "자연스러운 움직임은 존중하면서 발표 자세의 지속적인 변화를 확인합니다.",
};

function IntroPage({ onStart, onChooseMode }) {
  const [activeIndex, setActiveIndex] = useState(1);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const activeId = carouselModes[activeIndex];
  const move = (direction) => setActiveIndex((current) => (current + direction + carouselModes.length) % carouselModes.length);
  const visibleModes = [
    { id: carouselModes[(activeIndex - 1 + carouselModes.length) % carouselModes.length], position: "previous" },
    { id: activeId, position: "active" },
    { id: carouselModes[(activeIndex + 1) % carouselModes.length], position: "next" },
  ];

  useEffect(() => {
    if (carouselPaused) return undefined;
    const timer = window.setInterval(() => move(1), 2500);
    return () => window.clearInterval(timer);
  }, [carouselPaused]);

  return (
    <main className="page-shell intro-page" id="intro-page">
      <section className="hero-section">
        <div className="hero-copy">
          <span className="section-kicker">CONTEXT-AWARE POSTURE COACH</span>
          <h1>웹캠 하나로 시작하는<br /><em>바른 자세 습관</em></h1>
          <p>면접, 거북목 방지, 발표 자세까지<br />상황에 맞는 기준으로 자세 변화를 살펴봅니다.</p>
          <button className="primary-button hero-action" type="button" onClick={onStart}>분석 시작하기 <span aria-hidden="true">→</span></button>
          <small>영상은 저장하지 않으며, 현재 자세 분석과 코칭은 데모 데이터입니다.</small>
        </div>
        <div className="hero-visual" aria-label="PostureMate 자세 코칭 데모 일러스트">
          <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
          <ModeArtwork modeId="neck" />
          <div className="hero-note note-top"><b>실시간 상태</b><span>상황별 자세 변화 확인</span></div>
          <div className="hero-note note-bottom"><b>3가지 모드</b><span>목적에 맞는 코칭 기준</span></div>
        </div>
      </section>

      <section className="mode-carousel-section" aria-labelledby="mode-carousel-title">
        <div className="section-heading">
          <div><span className="section-kicker">POSTURE MODES</span><h2 id="mode-carousel-title">3가지 자세 코칭 모드를 살펴보세요</h2></div>
          <p>하나의 대시보드에서 목적에 맞는 평가 기준을 선택할 수 있습니다.</p>
        </div>
        <div className="mode-carousel">
          <button className="carousel-arrow" type="button" aria-label="이전 모드" onClick={() => move(-1)}>←</button>
          <div
            className="carousel-window"
            aria-live="polite"
            onMouseEnter={() => setCarouselPaused(true)}
            onMouseLeave={() => setCarouselPaused(false)}
            onFocusCapture={() => setCarouselPaused(true)}
            onBlurCapture={() => setCarouselPaused(false)}
          >
            {visibleModes.map(({ id, position }) => {
              const mode = MODES[id];
              const active = position === "active";
              return (
                <button
                  key={id}
                  type="button"
                  className={`carousel-card ${position}`}
                  onClick={() => active ? onChooseMode(id) : setActiveIndex(carouselModes.indexOf(id))}
                  aria-label={`${mode.label} 모드 ${active ? "선택" : "보기"}`}
                >
                  <ModeArtwork modeId={id} />
                  <span><b>{mode.label}</b><small>{introCopy[id]}</small></span>
                </button>
              );
            })}
          </div>
          <button className="carousel-arrow" type="button" aria-label="다음 모드" onClick={() => move(1)}>→</button>
        </div>
        <div className="carousel-caption"><strong>{MODES[activeId].label}</strong><span>{introCopy[activeId]}</span><button type="button" onClick={() => onChooseMode(activeId)}>이 모드 선택하기</button></div>
      </section>
    </main>
  );
}

export default IntroPage;
