import { useNavigate } from 'react-router-dom';

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0].slice(0, 2).toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Clicking the avatar navigates to the current user's own profile page.
export default function Avatar({ fullName, userId, size = '' }) {
  const navigate = useNavigate();
  return (
    <button
      className={`avatar ${size === 'sm' ? 'avatar-sm' : size === 'lg' ? 'avatar-lg' : ''} plain`}
      onClick={() => navigate(`/profile/${userId}`)}
      title={`View ${fullName}'s profile`}
      aria-label="Open your profile"
    >
      {initials(fullName)}
    </button>
  );
}
