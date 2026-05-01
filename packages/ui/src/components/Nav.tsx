import { NavLink, useNavigate } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '../context/AuthContext';
import { platformConfig } from '../platform.config';
import styles from './Nav.module.css';

export function Nav() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <NavLink to="/compare" className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            {platformConfig.logoLetter}
          </span>
          <span>{platformConfig.siteName}</span>
        </NavLink>
        <nav aria-label="Primary" className={styles.nav}>
          <NavLink
            to="/compare"
            className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
          >
            Vote
          </NavLink>
          <NavLink
            to="/leaderboard"
            className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
          >
            Leaderboard
          </NavLink>
          <NavLink
            to="/tagboard"
            className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
          >
            Tags
          </NavLink>
          <NavLink
            to="/providers"
            className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}
          >
            Providers
          </NavLink>
          <ThemeToggle />
          {platformConfig.requireAuth && (
            user ? (
              <button
                type="button"
                onClick={handleSignOut}
                className={styles.authBtn}
                title={user.email ?? undefined}
              >
                Sign out
              </button>
            ) : (
              <NavLink
                to="/login"
                className={({ isActive }) => `${styles.authBtn} ${isActive ? styles.active : ''}`}
              >
                Sign in
              </NavLink>
            )
          )}
        </nav>
      </div>
    </header>
  );
}
