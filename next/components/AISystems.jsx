export default function AISystems() {
  return (
    <section className="section on-dark" id="ai">
      <div className="shell">
        <div className="split">
          <div className="rv">
            <p className="eyebrow"><b>03</b> AI systems</p>
            <h2 className="t-h1">The agent isn&rsquo;t the hard part.</h2>
            <p className="lead-p" style={{ marginTop: 'var(--s-6)' }}>
              Any LLM call in production can hallucinate, lie to a user, or leak something it shouldn&rsquo;t, and it bills you either way. The model is the easy half. The hard half is making it predictable, the supervisor above it, the constraints around it, and the queue underneath that has to survive an inference error at 3am without corrupting anything.
            </p>
            <p className="measure" style={{ color: 'var(--text-muted)' }}>
              Everything below is running in production, not in a notebook.
            </p>
            <ul className="taglist" style={{ marginTop: 'var(--s-6)' }}>
              <li className="tag">MCP &middot; FastMCP, Laravel MCP</li>
              <li className="tag">Laravel &middot; AI SDK</li>
              <li className="tag">CrewAI</li>
              <li className="tag">OpenAI Agents SDK</li>
              <li className="tag">Bedrock Agent Runtime</li>
              <li className="tag">OpenRouter</li>
              <li className="tag">LanceDB</li>
              <li className="tag">QLoRA &middot; Unsloth</li>
              <li className="tag">NLP / OCR</li>
            </ul>
          </div>
          <div className="rv">
            <ol className="steps" data-stagger="80">
              <li className="rv">
                <span className="k">Shipped</span>
                <div>
                  <h3>Eve, in plain Laravel</h3>
                  <p>
                    An agentic talent engagement system built inside the existing Laravel app rather than a separate Python service, so it deploys, queues and gets monitored like everything else. Tens of thousands of background jobs introduce talent, fill profile gaps by priority score, confirm interest and surface roles. One enterprise tenant: <span className="num">12,000+</span> talents, roughly <span className="num">15,000</span> interactions a quarter, <span className="num">65%+</span> engagement.
                  </p>
                </div>
              </li>
              <li className="rv">
                <span className="k">Boundary</span>
                <div>
                  <h3>A supervisor agent, not a longer prompt</h3>
                  <p>
                    Compliance and data boundaries enforced on every interaction with hard constraints and structured JSON output. Instructions are not a security model.
                  </p>
                </div>
              </li>
              <li className="rv">
                <span className="k">Cost</span>
                <div>
                  <h3>Capabilities activate on context</h3>
                  <p>
                    The agent loads what the moment needs instead of stuffing every tool into every call. Tokens are a budget line, not an afterthought.
                  </p>
                </div>
              </li>
              <li className="rv">
                <span className="k">Failure</span>
                <div>
                  <h3>Queues that assume the model breaks</h3>
                  <p>
                    <span className="num">ShouldBeUnique</span> on stable identifiers so a job is never queued twice, back-off that increases on inference and API errors, and permanently failed jobs logged with a trace, then parsed and notified on a schedule.
                  </p>
                </div>
              </li>
              <li className="rv">
                <span className="k">Local</span>
                <div>
                  <h3>Fine-tuned Qwen2.5 with QLoRA</h3>
                  <p>
                    Trained with Unsloth so dictated speech comes out as correctly cased variable, class and method names that follow PHP and Laravel conventions. Runs on my own machine. I also build MCP servers with FastMCP and consume them daily.
                  </p>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
