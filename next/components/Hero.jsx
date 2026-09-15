import { profile } from '@/lib/profile';

export default function Hero() {
  return (
    <section className="section hero">
      <div className="shell">
        <div className="hero__grid">
          <div className="hero__copy">
            <p className="eyebrow eyebrow--id">
              Lead Engineer &middot; Laravel&nbsp;&amp;&nbsp;Distributed&nbsp;Systems &middot; AI
            </p>
            <h1 className="t-hero">
              <span className="ln"><span>I make</span></span>
              <span className="ln"><span>systems</span></span>
              <span className="ln"><span><em>hold.</em></span></span>
            </h1>
            <p className="hero__sub">
              17 years building platforms that can&rsquo;t go down, and four building the AI systems that run on top of them. I still write code every day.
            </p>
            <div className="hero__cta">
              <a className="btn-b btn-b--primary" href="#contact">Tell me what&rsquo;s breaking</a>
              <a className="btn-b btn-b--ghost" href="#work">See where it held</a>
            </div>
          </div>
          <div className="hero__fig">
            <figure className="stage">
              <span className="stage__shadow"></span>
              <video
                className="stage__media stage__media--video"
                id="heroVideo"
                poster="/assets/video/ismail-wave-poster.jpg"
                muted
                playsInline
                preload="none"
                aria-hidden="true"
                data-src-webm="/assets/video/ismail-wave.webm"
                data-src-mp4="/assets/video/ismail-wave.mp4"
              ></video>
            </figure>
            <p className="hero__meta">
              <span><i className="dot"></i> {profile.availability}</span>
              <span>{profile.location}</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
