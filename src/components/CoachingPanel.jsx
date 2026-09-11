function CoachingPanel({ message, temporal, mode }) {
  return (
    <section className="panel coaching-panel">
      <div className="panel-heading"><div><span className="eyebrow">DEMO COACHING · MOCK PROVIDER</span><h2>EXPLAINABLE FEEDBACK</h2></div><span className="coaching-source">NOT SOLAR</span></div>
      <blockquote><span aria-hidden="true">“</span><p>{message}</p></blockquote>
      <div className="coaching-evidence"><span>CONTEXT <b>{mode.label}</b></span><span>EVENT <b>{temporal.eventType || "none"}</b></span><span>STATE <b>{temporal.status}</b></span></div>
    </section>
  );
}
export default CoachingPanel;
