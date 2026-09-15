export default function Approach() {
  return (
    <section className="section" id="approach">
      <div className="shell">
        <div className="split">
          <div className="rv">
            <p className="eyebrow"><b>01</b> Load</p>
            <h2 className="t-h1">Monolithic logic, distributed load.</h2>
            <p className="lead-p" style={{ marginTop: 'var(--s-6)' }}>
              GrintaHub sells and resells event tickets, so traffic spikes massively the moment a big event goes on sale. The industry answer to that is to chop the codebase into services. That trades a performance problem you understand for a distributed-systems problem you don&rsquo;t. So I left the code alone and moved every stateful layer out from under it instead - one at a time, in production, over a couple of months, without a rewrite.
            </p>
            <p className="measure" style={{ color: 'var(--text-muted)' }}>
              The platform now absorbs spikes to <span className="num">100.96M</span> requests a month with zero downtime, across <span className="num">$47.5M</span> in annual GMV.
            </p>
          </div>
          <div className="rv">
            <ol className="steps" data-stagger="80">
              <li className="rv">
                <span className="k">Sessions &amp;&nbsp;cache</span>
                <div>
                  <h3>Redis / ValKey</h3>
                  <p>Took session state off the boxes so the web tier could be thrown away and replaced at any moment.</p>
                </div>
              </li>
              <li className="rv">
                <span className="k">Storage</span>
                <div>
                  <h3>S3</h3>
                  <p>Removed the last reason an instance had to be special.</p>
                </div>
              </li>
              <li className="rv">
                <span className="k">Queues &amp;&nbsp;email</span>
                <div>
                  <h3>SQS &amp; SES</h3>
                  <p>Work that used to compete with requests now runs on its own workers, with retries and back-off it can survive.</p>
                </div>
              </li>
              <li className="rv">
                <span className="k">Database</span>
                <div>
                  <h3>Aurora Serverless</h3>
                  <p>Capacity follows the spike instead of being provisioned for the worst night of the year.</p>
                </div>
              </li>
              <li className="rv">
                <span className="k">Web tier</span>
                <div>
                  <h3>EC2 auto scaling + Octane</h3>
                  <p>Octane keeps the application in server memory, so each instance does far more before another one is needed.</p>
                </div>
              </li>
            </ol>
          </div>
        </div>

        <div className="split" style={{ marginTop: 'var(--section-y)' }}>
          <div className="rv">
            <h3>Then I made shipping boring.</h3>
            <p className="measure" style={{ color: 'var(--text-muted)', marginTop: 'var(--s-4)' }}>
              GrintaHub had no CI pipeline when I joined in <span className="num">2021</span> - PHPStan sitting at level 2 and nothing running automatically. It now runs unit, feature and API suites, and PHPStan at level 5, with StyleCI holding a team of <span className="num">7</span> to one style, and nothing deploys until every check passes. Releases went from one every month or two, to weekly. Then I went the extra mile and reduced deployment time to a couple of seconds by deferring the docker image rebuild to post deployment.
            </p>
          </div>
          <div className="rv">
            <div className="term">
              <div className="term__bar">
                <i className="dot" style={{ background: 'var(--accent)' }}></i> deploy - production
              </div>
              <pre className="term__body">
                <code>
                  <b>$</b> git pull --ff-only            <i># 0.4s</i>{'\n'}
                  <b>$</b> php artisan optimize:clear    <i># 0.9s</i>{'\n'}
                  <b>$</b> php artisan octane:reload     <i># 1.3s</i>{'\n'}
                  {'\n'}
                  <u>&#10003;</u> live in <b>2.6s</b> - zero dropped requests{'\n'}
                  <i>&#8618; docker build queued for autoscaled nodes</i>
                </code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
