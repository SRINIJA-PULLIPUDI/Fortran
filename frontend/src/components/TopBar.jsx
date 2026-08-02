import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Flame, TrendingUp } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';
import api from '../api/client';

export default function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!user) return;
    api.get(`/profile/${user.userId}`).then((res) => setStats(res.data.profile));
  }, [user]);

  function handleSearchKeyDown(e) {
    if (e.key === 'Enter' && query.trim()) {
      navigate(`/problems?q=${encodeURIComponent(query.trim())}`);
    }
  }

  if (!user) return null;

  return (
    <header className="topbar">
      <div className="topbar-search">
        <Search size={19} />
        <input
          placeholder="Search problems..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
      </div>

      <div className="topbar-spacer" />

      {stats && (
        <>
          <div className="topbar-chip chip-streak" title="Current submission streak">
            <Flame size={18} />
            {stats.currentStreak} day{stats.currentStreak === 1 ? '' : 's'}
          </div>
          <div className="topbar-chip chip-rating" title="Contest rating">
            <TrendingUp size={18} />
            {stats.contestRating}
          </div>
        </>
      )}

      <button className="link-btn" onClick={() => { logout(); navigate('/login'); }}>
        Logout
      </button>

      <Avatar fullName={user.fullName} userId={user.userId} />
    </header>
  );
}
