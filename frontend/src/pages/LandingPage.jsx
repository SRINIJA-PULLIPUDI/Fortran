import { Link } from 'react-router-dom';
import { Zap, Shield, Trophy, BarChart3, Video, Users } from 'lucide-react';
import PublicNav from '../components/PublicNav';

const FEATURES = [
  {
    icon: Zap,
    title: 'Instant Judging',
    desc: 'Submit and get a real verdict back in seconds, backed by an async queue built to absorb traffic spikes without falling over.',
  },
  {
    icon: Shield,
    title: 'Docker Sandbox',
    desc: 'Every submission compiles and runs inside a disposable, network-isolated, memory-and-CPU-capped container. Your code never touches a shared host.',
  },
  {
    icon: Trophy,
    title: 'Rated Contests',
    desc: 'Compete head to head with a live leaderboard, then walk away with an updated contest rating computed from how you actually placed.',
  },
  {
    icon: BarChart3,
    title: 'Real Progress Tracking',
    desc: 'A submission streak calendar and rating history graph built entirely from your own activity — no vanity numbers.',
  },
  {
    icon: Video,
    title: 'Contest Integrity',
    desc: 'Screen recording during rated contests plus similarity-based plagiarism detection across submissions to the same problem.',
  },
  {
    icon: Users,
    title: 'Global Leaderboard',
    desc: 'See exactly where you rank against every other registered user, sorted by real contest rating.',
  },
];

export default function LandingPage() {
  return (
    <div>
      <PublicNav />

      <section className="landing-hero">
        <div>
          <div className="hero-eyebrow">
            <span className="dot" />
            Docker-sandboxed judging, end to end
          </div>
          <h1 className="hero-title">
            Master
            <br />
            <span className="gradient-text">Competitive</span>
            <br />
            Programming.
          </h1>
          <p className="hero-sub">
            Solve real problems, compete in rated contests, and track your progress with data
            that's actually yours — built on an isolated Docker judge, not a black box.
          </p>
          <div className="btn-row">
            <Link to="/register" className="btn btn-primary">
              Start Solving →
            </Link>
            <Link to="/problems" className="btn btn-outline">
              Explore Problems
            </Link>
          </div>
        </div>

        <div className="hero-mock">
          <div className="hero-mock-bar">
            <span className="hero-mock-dot" style={{ background: '#f87171' }} />
            <span className="hero-mock-dot" style={{ background: '#f5a623' }} />
            <span className="hero-mock-dot" style={{ background: '#4ade80' }} />
          </div>
          <div className="hero-mock-body">
            <div style={{ color: '#6d5df6' }}>a, b = map(int, input().split())</div>
            <div style={{ color: '#f2f3f7' }}>print(a + b)</div>
            <div style={{ color: '#5b5f6d', marginTop: 10 }}># Accepted · 4/4 test cases · 42ms</div>
          </div>
        </div>
      </section>

      <section className="section section-center">
        <div className="section-eyebrow">PLATFORM FEATURES</div>
        <h2 className="section-title">
          Everything you need to <span className="gradient-text">excel in competitive programming</span>
        </h2>
        <p className="section-desc">From your first "Accepted" to your first rated contest — built to be real, not decorative.</p>

        <div className="feature-grid">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div className="feature-card" key={title}>
              <div className="feature-icon">
                <Icon size={20} />
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="landing-cta">
        <h2>Ready to level up?</h2>
        <p>Create an account and submit your first solution in under a minute.</p>
        <Link to="/register" className="btn btn-primary">
          Start Solving — It's Free
        </Link>
      </div>

      <footer className="public-footer">
        <div className="footer-grid">
          <div>
            <div className="brand-lockup" style={{ marginBottom: 10 }}>
              <span className="brand-mark">F</span>
              Fortran
            </div>
            <p className="muted" style={{ maxWidth: 240, fontSize: '0.88rem' }}>
              A Docker-sandboxed online judge built end to end — from queueing to grading to rating.
            </p>
          </div>
          <div className="footer-col">
            <h5>Platform</h5>
            <Link to="/problems">Problems</Link>
            <Link to="/contests">Contests</Link>
            <Link to="/leaderboard">Leaderboard</Link>
          </div>
          <div className="footer-col">
            <h5>Account</h5>
            <Link to="/login">Sign In</Link>
            <Link to="/register">Get Started</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <span>Fortran — a MERN + Docker online judge.</span>
        </div>
      </footer>
    </div>
  );
}
