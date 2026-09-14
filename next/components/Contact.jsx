import { profile, mailto, tel } from '@/lib/profile';

export default function Contact() {
  return (
    <section className="section on-dark" id="contact">
      <div className="shell">
        <div className="contact__grid">
          <div className="rv">
            <p className="eyebrow"><b>06</b> Contact</p>
            <h2 className="t-h1">Tell me what&rsquo;s breaking.</h2>
            <p className="lead-p" style={{ marginTop: 'var(--s-6)' }}>
              Scaling problem, a platform you&rsquo;re afraid to touch, or an AI system that needs to be reliable rather than impressive - send me the shape of it and I&rsquo;ll tell you honestly whether I&rsquo;m the right person.
            </p>
            <div className="hero__cta" style={{ marginTop: 'var(--s-8)' }}>
              <a className="btn-b btn-b--primary" href={mailto("Let's talk")}>
                Email me
              </a>
              <a className="btn-b btn-b--ghost" href={profile.cvPath} download>
                Download CV
              </a>
              <a className="btn-b btn-b--ghost" href={profile.linkedin} rel="noopener">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zM7.12 20.45H3.55V9h3.57v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"/>
                </svg>
                LinkedIn
              </a>
            </div>
          </div>
          <div className="rv">
            <ul className="deets">
              <li className="rv">
                <span className="k">Email</span>
                <span className="v">
                  <a href={mailto()}>{profile.email}</a>
                </span>
              </li>
              <li className="rv">
                <span className="k">Phone</span>
                <span className="v">
                  <a href={tel}>{profile.phoneDisplay}</a>
                </span>
              </li>
              <li className="rv">
                <span className="k">Based</span>
                <span className="v">{profile.location}</span>
              </li>
              <li className="rv">
                <span className="k">Status</span>
                <span className="v">
                  <i className="dot" style={{ display: 'inline-block', marginRight: '8px' }}></i>
                  {profile.availability}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
