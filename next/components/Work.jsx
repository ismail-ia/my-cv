import { profile } from '@/lib/profile';

export default function Work() {
  return (
    <section className="section section--raise" id="work">
      <div className="shell">
        <p className="eyebrow rv"><b>02</b> Where it held</p>
        <h2 className="t-h1 rv" style={{ maxWidth: '20ch' }}>
          Seventeen years, working beside the founders every time.
        </h2>
        <div className="grid-2" data-stagger="110" style={{ marginTop: 'var(--s-12)' }}>

          <article className="card-b rv">
            <div className="card-b__head">
              <h3>GrintaHub</h3>
              <span className="card-b__when">Jan 2021 &rarr; now</span>
            </div>
            <p className="card-b__role">Engineering Director, part-time contract &middot; ticketing &amp; resale &middot; team of 7</p>
            <ul>
              <li>Absorbed <span className="num">100.96M</span> requests a month with zero downtime across <span className="num">$47.5M</span> annual GMV.</li>
              <li>Solved the ticketing race conditions - two buyers reaching for the same ticket in the same millisecond - with uniqueness constraints and optimistic and pessimistic row locks.</li>
              <li>Moved the entire infrastructure from AWS Bahrain to AWS Italy during a regional outage. No data loss, full capacity the same day.</li>
              <li>Fused AI query refinement with Elasticsearch for a <span className="num">400%</span> gain in search accuracy and speed.</li>
            </ul>
            <ul className="taglist" style={{ marginTop: 'var(--s-2)' }}>
              <li className="tag">Laravel 12</li>
              <li className="tag">Octane</li>
              <li className="tag">Aurora</li>
              <li className="tag">SQS</li>
              <li className="tag">Elasticsearch</li>
            </ul>
          </article>

          <article className="card-b rv">
            <div className="card-b__head">
              <h3>Bench Talent Cloud</h3>
              <span className="card-b__when">Feb 2022 &rarr; Mar 2026</span>
            </div>
            <p className="card-b__role">Fractional Lead Engineer / CTO &middot; enterprise talent cloud &middot; team of 3</p>
            <ul>
              <li>Built <b>Eve</b>, an agentic talent engagement system, in plain Laravel rather than a separate Python stack.</li>
              <li>One enterprise tenant runs <span className="num">12,000+</span> talents and roughly <span className="num">15,000</span> interactions a quarter at a <span className="num">65%+</span> engagement rate.</li>
              <li>Recovered a <span className="num">15,000</span>-profile import queued into the wrong queue by writing an artisan command that moved pending jobs directly in SQS, then scaled workers until the backlog cleared.</li>
              <li>Shipped WorkMap, a real-time collaboration platform on WebSockets, zero to production.</li>
            </ul>
            <ul className="taglist" style={{ marginTop: 'var(--s-2)' }}>
              <li className="tag">Agentic architecture</li>
              <li className="tag">Guardrails</li>
              <li className="tag">NLP / OCR</li>
              <li className="tag">WebSockets</li>
            </ul>
          </article>

          <article className="card-b rv">
            <div className="card-b__head">
              <h3>Spiceworks Ziff Davis / BigLinker</h3>
              <span className="card-b__when">Apr 2019 &rarr; Jan 2022</span>
            </div>
            <p className="card-b__role">Lead Engineer &middot; contractor</p>
            <ul>
              <li>Held <span className="num">99.5%+</span> uptime for enterprise users on headless browser automation, against anti-bot defences that changed constantly.</li>
              <li>Led product engineering through a multi-million-dollar acquisition by J2 Global, then stayed on to onboard the in-house team onto the architecture.</li>
            </ul>
            <ul className="taglist" style={{ marginTop: 'var(--s-2)' }}>
              <li className="tag">Python</li>
              <li className="tag">Selenium</li>
              <li className="tag">M&amp;A due diligence</li>
            </ul>
          </article>

          <article className="card-b rv">
            <div className="card-b__head">
              <h3>Femto15</h3>
              <span className="card-b__when">Apr 2016 &rarr; Dec 2021</span>
            </div>
            <p className="card-b__role">Co-founder &amp; Lead Architect</p>
            <ul>
              <li>Delivered <span className="num">50+</span> web applications for international clients, LapMeta among them.</li>
              <li>Grew engineering and design from <span className="num">2</span> to <span className="num">20+</span> while holding code review and CI/CD standards. The company is still operating.</li>
            </ul>
            <ul className="taglist" style={{ marginTop: 'var(--s-2)' }}>
              <li className="tag">Team building</li>
              <li className="tag">Architecture</li>
              <li className="tag">Hiring</li>
            </ul>
          </article>

        </div>
        <p className="work-more">
          <a className="btn-b btn-b--quiet" href={profile.cvPath} download>
            Earlier roles - Mizatech, EliteModern, Netservex - are on the CV (PDF)
          </a>
        </p>
      </div>
    </section>
  );
}
