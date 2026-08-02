import { Link } from 'react-router-dom';

export default function PublicNav() {
  return (
    <nav className="public-nav">
      <Link to="/" className="brand-lockup">
        <span className="brand-mark">F</span>
        Fortran
      </Link>
      <div className="public-nav-links">
        <Link to="/problems">Problems</Link>
        <Link to="/contests">Contests</Link>
        <Link to="/leaderboard">Leaderboard</Link>
        <div className="btn-row">
          <Link to="/login" className="btn btn-outline">
            Sign In
          </Link>
          <Link to="/register" className="btn btn-primary">
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
