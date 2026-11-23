import { useEffect, useState } from "react";

const READING_MS = 8000;
const CONFIRM_MS = 2000;

function CoachingPanel({ label, message }) {
  const [shown, setShown] = useState(() => ({ label, message, since: performance.now() }));

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
      <div className="panel-heading"><div><span className="eyebrow">{shown.label}</span><h2>최근 연습 안내</h2></div></div>
      <blockquote><span aria-hidden="true">“</span><p aria-live="polite">{shown.message}</p></blockquote>
    </section>
  );
}
export default CoachingPanel;
