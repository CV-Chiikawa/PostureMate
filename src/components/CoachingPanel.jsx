import { useEffect, useState } from "react";

const READING_MS = 8000;
const CONFIRM_MS = 2000;

function CoachingPanel({ label, message }) {
  const [shown, setShown] = useState(() => ({ label, message, since: performance.now() }));
  const isSolar = shown.label === "SOLAR 응답";

  useEffect(() => {
    if (shown.label === label && shown.message === message) return;
    const delay = Math.max(CONFIRM_MS, shown.since + READING_MS - performance.now());
    const timer = window.setTimeout(() => {
      setShown({ label, message, since: performance.now() });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [shown, label, message]);

  return (
    <section className="panel coaching-panel">
      <div className="panel-heading">
        <div className="coaching-heading-title">
          <h2>지금 이렇게 해보세요</h2>
          <span className={`coaching-source-badge ${isSolar ? "solar" : "default"}`} aria-label={`코칭 출처: ${shown.label}`}>
            {shown.label}
          </span>
        </div>
      </div>
      <blockquote><span aria-hidden="true">“</span><p aria-live="polite">{shown.message}</p></blockquote>
    </section>
  );
}
export default CoachingPanel;
