import { ArrowRight, CheckSquare2, GitPullRequest, GitMerge, MessageSquare, Radio } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import ThemeToggle from "../components/ui/ThemeToggle";

const workflow = [
  {
    title: "Discussion",
    copy: "Work through the technical question with the project around it.",
    icon: MessageSquare,
  },
  {
    title: "Decision",
    copy: "Record the chosen approach and the reasoning behind it.",
    icon: GitMerge,
    decision: true,
  },
  {
    title: "Task",
    copy: "Turn the decision into owned work with its context attached.",
    icon: CheckSquare2,
  },
  {
    title: "GitHub PR",
    copy: "Link the implementation and follow verified pull request updates.",
    icon: GitPullRequest,
  },
];

const features = [
  {
    number: "01",
    title: "Discussions that stay findable",
    copy: "Keep technical conversations attached to the project they belong to.",
  },
  {
    number: "02",
    title: "Decisions with a reason",
    copy: "Record what the team chose, why, and which discussion informed it.",
  },
  {
    number: "03",
    title: "Tasks connected to the source",
    copy: "Carry related discussions and decisions into the work your team tracks.",
  },
  {
    number: "04",
    title: "Pull requests in context",
    copy: "Link GitHub PRs to tasks; lifecycle status comes from verified webhooks.",
  },
];

function Brand({ onNavigate }) {
  return (
    <a
      href="/"
      onClick={(event) => {
        event.preventDefault();
        onNavigate?.("home");
      }}
      className="public-brand"
    >
      <img className="public-mark-light" src="/devsync-mark-light.svg" alt="" />
      <img className="public-mark-dark" src="/devsync-mark-dark.svg" alt="" />
      <span>DevSync</span>
    </a>
  );
}

function WorkspacePreview() {
  return (
    <div
      className="public-preview-wrap public-reveal public-reveal-late"
      aria-label="Illustrative DevSync project workspace"
    >
      <div className="public-preview">
        <header className="public-preview-top">
          <div className="public-preview-crumb">
            <span className="public-preview-mark">D</span>
            <span>Platform</span>
            <span className="public-preview-divider">/</span>
            <strong>Session security</strong>
          </div>
          <span className="public-preview-presence">
            <i />
            2 members online
          </span>
        </header>

        <div className="public-preview-body">
          <aside className="public-preview-sidebar">
            <span className="public-preview-label">PROJECT</span>
            <p className="public-preview-nav">Overview</p>
            <p className="public-preview-nav selected">Discussion</p>
            <p className="public-preview-nav">Board</p>
            <p className="public-preview-nav">Decisions</p>
            <p className="public-preview-nav">Activity</p>
            <div className="public-preview-sidebar-foot">DevSync workspace</div>
          </aside>

          <div className="public-preview-content">
            <div className="public-preview-heading">
              <div>
                <span className="public-preview-label">
                  DISCUSSION · UPDATED 12 MIN AGO
                </span>
                <h2>Rotate session tokens safely</h2>
              </div>
              <span className="public-preview-tag">3 replies</span>
            </div>

            <div className="public-preview-message">
              <span className="public-preview-avatar">AM</span>
              <div>
                <strong>
                  Alex Morgan <small>· 10:42</small>
                </strong>
                <p>
                  Rotate the refresh token after each renewal, and reject any
                  token we have already seen.
                </p>
              </div>
            </div>

            <div className="public-preview-decision">
              <span className="public-preview-decision-label">
                <GitMerge size={14} /> DECISION
              </span>
              <strong>
                Use single-use refresh tokens with reuse detection.
              </strong>
              <p>Recorded by Alex · linked to this discussion</p>
            </div>

            <div className="public-preview-task">
              <span className="public-preview-checkbox">
                <CheckSquare2 size={15} />
              </span>
              <div>
                <strong>Implement token rotation</strong>
                <small>Task · In progress · linked to decision</small>
              </div>
              <span className="public-preview-pr">
                <GitPullRequest size={14} /> PR #184
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="public-preview-caption">
        A project discussion, its decision, and the implementation in one view.
      </p>
    </div>
  );
}

function FeatureMarquee() {
  const sequenceRef = useRef(null);
  const [sequenceHeight, setSequenceHeight] = useState(0);

  useLayoutEffect(() => {
    const sequence = sequenceRef.current;
    if (!sequence) return undefined;

    const measure = () => {
      const height = sequence.getBoundingClientRect().height;
      setSequenceHeight((current) => (Math.abs(current - height) < 0.5 ? current : height));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(sequence);
    return () => observer.disconnect();
  }, []);

  const loopStyle = sequenceHeight > 0 ? {
    "--feature-cycle-height": `${sequenceHeight}px`,
    "--feature-viewport-height": `${sequenceHeight + 2}px`,
    "--feature-loop-duration": `${sequenceHeight / 24}s`,
  } : undefined;

  function renderSequence({ duplicate = false } = {}) {
    return (
      <div
        className="public-feature-marquee-sequence"
        aria-hidden={duplicate ? "true" : undefined}
        ref={duplicate ? undefined : sequenceRef}
      >
        {features.map((feature) => (
          <article className="public-feature-marquee-item" key={feature.number}>
            <span className="public-feature-marquee-number">{feature.number}</span>
            <div className="public-feature-marquee-copy">
              <h3>{feature.title}</h3>
              <p>{feature.copy}</p>
            </div>
          </article>
        ))}
      </div>
    );
  }

  return (
    <div
      className="public-feature-marquee"
      style={loopStyle}
      role="region"
      aria-label="DevSync features"
    >
      <div className="public-feature-marquee-viewport">
        <div className="public-feature-marquee-track">
          {renderSequence()}
          {renderSequence({ duplicate: true })}
        </div>
      </div>
    </div>
  );
}

export default function Home({ onNavigate }) {
  return (
    <div className="public-page ">
      <header className="public-header">
        <nav className="public-nav" aria-label="Main navigation">
          <Brand onNavigate={onNavigate} />

          <div className="public-nav-links">
            <a href="#product">Product</a>
            <a href="#workflow">How it works</a>
            <a href="#features">Features</a>
            <a href="https://github.com" target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>

          <div className="public-nav-actions">
            <button
              type="button"
              className="public-nav-login"
              onClick={() => onNavigate?.("login")}
            >
              Log in
            </button>

            <button
              type="button"
              className="public-button public-button-small"
              onClick={() => onNavigate?.("register")}
            >
              Get started <ArrowRight size={15} />
            </button>

            <ThemeToggle className="public-theme-toggle" />
          </div>

          <button
            type="button"
            className="public-mobile-login"
            onClick={() => onNavigate?.("login")}
          >
            Log in
          </button>
        </nav>
      </header>

      <main>
        <section id="product" className="public-hero">
          <div className="public-hero-grid" aria-hidden="true" />

          <div className="public-hero-inner">
            <div className="public-hero-copy public-reveal">
              <p className="public-eyebrow">
                <span />
                A workspace for engineering teams
              </p>

              <h1>
                Turn engineering conversations into <em>shipped work.</em>
              </h1>

              <p className="public-hero-lede">
                DevSync connects project discussions, decisions, tasks, and
                GitHub pull requests—so the reason behind the work stays with
                it.
              </p>

              <div className="public-hero-actions">
                <button
                  type="button"
                  className="public-button"
                  onClick={() => onNavigate?.("register")}
                >
                  Create your workspace <ArrowRight size={16} />
                </button>

                <a className="public-text-link" href="#workflow">
                  See how it works <span>↓</span>
                </a>
              </div>

              <div className="public-hero-note">
                <Radio size={14} />
                Real-time project updates, with access scoped to your workspace
              </div>
            </div>

            <WorkspacePreview />
          </div>
        </section>

        <section className="public-context">
          <div className="public-section-inner public-context-inner">
            <div>
              <p className="public-eyebrow">THE CONTEXT GAP</p>
              <h2>
                Decisions lose their value when the reasoning gets left behind.
              </h2>
            </div>

            <p>
              Engineering work crosses chat, meetings, tickets, and code review.
              DevSync keeps the path between them visible, so teammates can
              understand what changed and why.
            </p>
          </div>
        </section>

        <section id="workflow" className="public-workflow">
          <div className="public-section-inner">
            <div className="public-section-heading">
              <p className="public-eyebrow">ONE CONNECTED WORKFLOW</p>
              <h2>From the first question to the merged change.</h2>
              <p>
                Each step keeps a link to the context that came before it.
              </p>
            </div>

            <div className="public-workflow-grid">
              {workflow.map(
                ({ title, copy, icon: Icon, decision }, index) => (
                  <article
                    className="public-workflow-step public-reveal"
                    style={{ animationDelay: `${index * 75}ms` }}
                    key={title}
                  >
                    <div className="public-step-top">
                      <span>0{index + 1}</span>
                      <Icon
                        size={19}
                        className={decision ? "public-decision-icon" : ""}
                      />
                    </div>

                    <h3>{title}</h3>
                    <p>{copy}</p>

                    {index < workflow.length - 1 && (
                      <span className="public-step-line" aria-hidden="true" />
                    )}
                  </article>
                ),
              )}
            </div>
          </div>
        </section>

        <section id="features" className="public-features">
          <div className="public-section-inner public-features-inner">
            <div className="public-section-heading">
              <p className="public-eyebrow">BUILT AROUND PROJECT CONTEXT</p>
              <h2>Less searching. Clearer handoffs.</h2>
            </div>

            <FeatureMarquee />
          </div>
        </section>

        <section className="public-cta">
          <div className="public-section-inner public-cta-inner">
            <div>
              <p className="public-eyebrow">KEEP THE WHY WITH THE WORK</p>
              <h2>Stop losing engineering context.</h2>
            </div>

            <button
              type="button"
              className="public-button"
              onClick={() => onNavigate?.("register")}
            >
              Start building with DevSync <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </main>

      <footer className="public-footer">
        <div className="public-section-inner public-footer-inner">
          <Brand onNavigate={onNavigate} />

          <span>© {new Date().getFullYear()} DevSync</span>

          <div>
            <a href="#workflow">Product</a>
            <a href="https://github.com" target="_blank" rel="noreferrer">
              GitHub
            </a>
            <button type="button" onClick={() => onNavigate?.("login")}>
              Log in
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
