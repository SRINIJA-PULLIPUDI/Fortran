import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

function formatCountdown(target) {
  const diffMs = new Date(target) - new Date();
  if (diffMs <= 0) return 'now';
  const mins = Math.floor(diffMs / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const remMins = mins % 60;
  if (days > 0) return `${days} day${days === 1 ? '' : 's'}`;
  if (hours > 0) return `${hours}h ${remMins}m`;
  return `${remMins}m`;
}

function formatDuration(start, end) {
  const mins = Math.round((new Date(end) - new Date(start)) / 60000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins ? `${hours}h ${remMins}m` : `${hours}h`;
}

function PastContestRow({ contest, userId }) {
  const [myRank, setMyRank] = useState(null);

  useEffect(() => {
    api.get(`/contests/${contest._id}/leaderboard`).then((res) => {
      const entry = res.data.leaderboard.find((e) => e.user.userId === userId);
      setMyRank(entry ? entry.rank : null);
    });
  }, [contest._id, userId]);

  return (
    <Link to={`/contests/${contest._id}`} style={{ display: 'block', textDecoration: 'none' }}>
      <div className="contest-past-row">
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{contest.title}</div>
          <div className="muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
            {new Date(contest.startTime).toLocaleDateString()} · {contest.participants?.length || 0} participants · {contest.problems?.length || 0} problems
          </div>
        </div>
        <div className="contest-past-rank">
          {myRank ? (
            <>
              <div className="rank-value">#{myRank}</div>
              <div className="muted" style={{ fontSize: '0.78rem' }}>
                Your rank
              </div>
            </>
          ) : (
            <span className="badge badge-outline">Did not participate</span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function ContestList() {
  const [contests, setContests] = useState([]);
  const [tab, setTab] = useState('Live');
  const { user } = useAuth();

  useEffect(() => {
    api.get('/contests').then((res) => setContests(res.data.contests));
  }, []);

  const liveOrUpcoming = contests.filter((c) => c.status === tab);
  const past = contests.filter((c) => c.status === 'Ended').sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

  return (
    <div className="page wide">
      <h2>Contests</h2>
      <p className="page-sub">Compete and climb the ratings</p>

      <div className="contest-tabs">
        {['Live', 'Upcoming', 'Past'].map((t) => (
          <button key={t} className={`tab-item ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Past' ? (
        <div>
          {past.length === 0 && <p className="empty-state">No past contests yet.</p>}
          {past.map((c) => (
            <PastContestRow key={c._id} contest={c} userId={user?.userId} />
          ))}
        </div>
      ) : (
        <div className="contest-grid">
          {liveOrUpcoming.map((c) => (
            <div className="contest-card" key={c._id}>
              <span className={`badge ${c.isRated ? 'badge-rank' : 'badge-outline'}`}>{c.isRated ? 'Rated' : 'Unrated'}</span>
              <h3>{c.title}</h3>
              <div className="contest-meta-row">
                <div className="contest-meta-item">
                  <div className="meta-value">{c.status === 'Live' ? 'Live now' : formatCountdown(c.startTime)}</div>
                  <div className="meta-label">{c.status === 'Live' ? 'Status' : 'Starts In'}</div>
                </div>
                <div className="contest-meta-item">
                  <div className="meta-value">{formatDuration(c.startTime, c.endTime)}</div>
                  <div className="meta-label">Duration</div>
                </div>
                <div className="contest-meta-item">
                  <div className="meta-value">{c.participants?.length || 0}</div>
                  <div className="meta-label">Registered</div>
                </div>
              </div>
              <Link to={`/contests/${c._id}`} className="btn btn-primary">
                {c.status === 'Live' ? 'Enter Contest →' : 'View Contest →'}
              </Link>
            </div>
          ))}
          {liveOrUpcoming.length === 0 && <p className="empty-state">No {tab.toLowerCase()} contests right now.</p>}
        </div>
      )}
    </div>
  );
}
