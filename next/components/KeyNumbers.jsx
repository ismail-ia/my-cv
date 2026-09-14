export default function KeyNumbers() {
  return (
    <section className="section section--tight on-dark" aria-label="Key numbers">
      <div className="shell">
        <div className="metrics" data-stagger="90">
          <div className="metric rv">
            <span className="metric__n" data-count="71.2" data-suffix="M">71.2M</span>
            <span className="metric__l">Requests / month</span>
          </div>
          <div className="metric rv">
            <span className="metric__n" data-count="47.5" data-prefix="$" data-suffix="M">$47.5M</span>
            <span className="metric__l">Annual GMV</span>
          </div>
          <div className="metric rv">
            <span className="metric__n">0.001%</span>
            <span className="metric__l">Downtime</span>
          </div>
          <div className="metric rv">
            <span className="metric__n" data-count="17">17</span>
            <span className="metric__l">Years Delivering</span>
          </div>
        </div>
      </div>
    </section>
  );
}
