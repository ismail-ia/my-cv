export default function Delivery() {
  return (
    <section className="section section--tight" id="delivery">
      <div className="shell">
        <div className="split">
          <div className="rv">
            <p className="eyebrow"><b>04</b> Delivery</p>
            <h2 className="t-h2">I build with agents. I don&rsquo;t trust them.</h2>
            <p className="lead-p" style={{ marginTop: 'var(--s-6)' }}>
              Using AI to write code should be carefully evaluated. I ship features with Claude Code and Google Antigravity daily, and I read every line before it lands - an agent that is right most of the time is a liability at scale, not a shortcut.
            </p>
            <p className="measure" style={{ color: 'var(--text-muted)' }}>
              It makes me faster at the parts I already know how to do. It has never once made me faster at blindly deciding what to build.
            </p>
          </div>
          <div className="rv">
            <ol className="steps" data-stagger="80">
              <li className="rv">
                <span className="k">First</span>
                <div>
                  <h3>Plan, then generate</h3>
                  <p>The approach is agreed before any code exists. Agents are very good at confidently building the wrong thing quickly.</p>
                </div>
              </li>
              <li className="rv">
                <span className="k">Then</span>
                <div>
                  <h3>Implementation instructions, test cases, architecture</h3>
                  <p>Written down before generation starts, so there is something to check the output against that is not just my memory of what I wanted.</p>
                </div>
              </li>
              <li className="rv">
                <span className="k">Always</span>
                <div>
                  <h3>Review every change, before and after it lands</h3>
                  <p>Then the same gates as any other commit: Pest and PHPUnit suites, PHPStan level 5, StyleCI. Nothing deploys until every check passes.</p>
                </div>
              </li>
            </ol>
            <ul className="taglist" style={{ marginTop: 'var(--s-8)' }}>
              <li className="tag">Claude Code</li>
              <li className="tag">Google Antigravity</li>
              <li className="tag">Pest &middot; PHPUnit</li>
              <li className="tag">PHPStan L5</li>
              <li className="tag">StyleCI</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
