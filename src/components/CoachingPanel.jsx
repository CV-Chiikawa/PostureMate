function CoachingPanel({ message }) {
  return (
    <section className="panel coaching-panel">
      <div className="panel-heading"><div><h2>지금 이렇게 해보세요</h2></div></div>
      <blockquote><span aria-hidden="true">“</span><p>{message}</p></blockquote>
    </section>
  );
}
export default CoachingPanel;
