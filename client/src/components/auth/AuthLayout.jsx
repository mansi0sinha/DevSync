import { ArrowLeft, Check, ChevronRight, Clock3, FolderKanban, MessageSquareText } from "lucide-react";
import ThemeToggle from "../ui/ThemeToggle";

function BrandMark({ onNavigate }) {
  return <a href="/" onClick={(event) => { event.preventDefault(); onNavigate?.("home"); }} className="auth-brand" aria-label="DevSync home">
    <img className="public-mark-light" src="/devsync-mark-light.svg" alt="" />
    <img className="public-mark-dark" src="/devsync-mark-dark.svg" alt="" />
    <span>DevSync</span>
  </a>;
}

export function RegisterPreviewCards() {
  return <>
    <article className="auth-preview-card">
      <small>PROJECT PULSE</small>
      <div className="auth-preview-donut"><span>50%</span></div>
      <p className="auth-preview-caption">1 in progress · 1 done</p>
      <div className="auth-preview-split"><i /><i /></div>
    </article>
    <article className="auth-preview-card">
      <small>DECISION LOGGED</small>
      <p className="auth-preview-decision">Use JWT with role checks</p>
      <strong>Linked to 3 tasks</strong>
    </article>
  </>;
}

export function LoginPreviewCards() {
  return <>
    <article className="auth-preview-card">
      <small>RECENT ACTIVITY</small>
      <p className="auth-preview-row"><Check size={15} />Task moved to In Progress</p>
      <p className="auth-preview-row"><MessageSquareText size={15} />Decision recorded</p>
    </article>
    <article className="auth-preview-card">
      <small>NEW NOTIFICATION</small>
      <p className="auth-preview-row auth-preview-notice"><FolderKanban size={18} />You were assigned a task</p>
      <span className="auth-preview-time"><Clock3 size={12} /> Just now</span>
    </article>
  </>;
}

export default function AuthLayout({ eyebrow, headline, children, leftCards, onNavigate }) {
  return <main className="public-page auth-v2">
    <section className="auth-v2-brand-panel" aria-label="DevSync workflow">
      <div className="auth-v2-orb auth-v2-orb-top" aria-hidden="true" />
      <div className="auth-v2-orb auth-v2-orb-bottom" aria-hidden="true" />
      <BrandMark onNavigate={onNavigate} />
      <div className="auth-v2-story">
        <p className="auth-v2-eyebrow">{eyebrow}</p>
        <h2>{headline}</h2>
        <div className="auth-v2-flow" aria-label="Discuss, Decide, Task, Execute">
          {['Discuss', 'Decide', 'Task', 'Execute'].map((step, index) => <span className="auth-v2-flow-item" key={step}>
            <b className={step === 'Decide' ? 'is-active' : ''}>{step}</b>
            {index < 3 && <ChevronRight size={18} aria-hidden="true" />}
          </span>)}
        </div>
      </div>
      <div className="auth-v2-cards">{leftCards}</div>
    </section>
    <section className="auth-v2-form-side">
      <div className="auth-v2-topbar">
        <a href="/" onClick={(event) => { event.preventDefault(); onNavigate?.("home"); }} className="public-auth-back"><ArrowLeft size={15} /> Back to DevSync</a>
        <ThemeToggle className="public-theme-toggle" />
      </div>
      <div className="auth-v2-content">
        <BrandMark onNavigate={onNavigate} />
        {children}
      </div>
    </section>
  </main>;
}

