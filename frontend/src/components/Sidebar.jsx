import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Code2, Zap, Trophy, Clock, CircleUser, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/problems', label: 'Problems', icon: Code2 },
  { to: '/contests', label: 'Contests', icon: Zap },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/submissions', label: 'Submissions', icon: Clock },
];

export default function Sidebar() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <aside className="sidebar">
      <a href="/dashboard" className="brand-lockup">
        <span className="brand-mark">F</span>
        Fortran
      </a>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <Icon size={21} />
            {label}
          </NavLink>
        ))}
        <NavLink to={`/profile/${user.userId}`} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <CircleUser size={21} />
          Profile
        </NavLink>
      </nav>

      {user.role === 'admin' && (
        <div className="sidebar-admin">
          <div className="sidebar-section-label">admin</div>
          <NavLink to="/admin/new-problem" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <PlusCircle size={21} />
            New Problem
          </NavLink>
          <NavLink to="/admin/new-contest" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
            <PlusCircle size={21} />
            New Contest
          </NavLink>
        </div>
      )}

      <div className="sidebar-footer">
        <Avatar fullName={user.fullName} userId={user.userId} size="sm" />
        <div>
          <div className="sidebar-footer-name">{user.fullName}</div>
          <div className="sidebar-footer-title">@{user.userId}</div>
        </div>
      </div>
    </aside>
  );
}
