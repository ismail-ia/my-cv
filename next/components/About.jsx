export default function About() {
  return (
    <section className="section section--raise" id="about">
      <div className="shell">
        <div className="hero__grid">
          <div className="hero__copy rv">
            <p className="eyebrow"><b>05</b> Teams</p>
            <h2 className="t-h1">Teams are a system too.</h2>
            <p className="lead-p">
              I&rsquo;ve grown teams from <span className="num">3</span> to <span className="num">20+</span>, hired for them, and set the standards they run on - review rules, static analysis gates, and a release process the team owns rather than one person. I&rsquo;ve worked directly with the founders at every company I&rsquo;ve been at, turning loosely defined requirements into scoped, shippable work.
            </p>
            <ul className="deets" style={{ marginTop: 'var(--s-6)' }}>
              <li className="rv">
                <span className="k">Education</span>
                <span className="v">BS, Systems &amp; Computer Engineering - Cairo University</span>
              </li>
              <li className="rv">
                <span className="k">Also</span>
                <span className="v">Kubernetes (completed) &middot; LangChain &amp; LangGraph (in progress) &middot; Foundations of Everyday Leadership, UIUC</span>
              </li>
              <li className="rv">
                <span className="k">Languages</span>
                <span className="v">English (fluent) &middot; Arabic (native)</span>
              </li>
              <li className="rv">
                <span className="k">Integrations</span>
                <span className="v">
                  Around <span className="num">30</span> production integrations owned end to end - payments, open banking, BNPL, KYC, loyalty, ERP, messaging - including the retries, back-off and reconciliation that keep late external data from corrupting order state.
                </span>
              </li>
            </ul>
          </div>
          <div className="hero__fig rv">
            <figure className="stage stage--figure">
              <span className="stage__shadow"></span>
              <img
                className="stage__media stage__media--figure"
                src="/assets/avatar/ismail-stand-900.webp"
                alt=""
                width={900}
                height={2563}
                loading="lazy"
                decoding="async"
              />
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
