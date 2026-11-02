function CoachingPanel({ label, message }) {
  return (
    <section className="panel coaching-panel">
      <div className="panel-heading"><div><span className="eyebrow">{label}</span><h2>지금 이렇게 해보세요</h2></div></div>
      <blockquote><span aria-hidden="true">“</span><p aria-live="polite">{message}</p></blockquote>
    </section>
  );
}
export default CoachingPanel;
