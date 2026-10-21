import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Footer } from '../components/layout/Footer';
import { useAuth } from '../contexts/useAuth';
import { Button } from '../components/ui/Button';
import './MainLayout.css';

export interface MainLayoutProps {
  children: ReactNode;
}

const navItems = [
  { to: '/home', label: 'Home' },
  { to: '/explore', label: 'Explore' },
  { to: '/now', label: 'HUEGO NOW' },
  { to: '/my-trips', label: 'My Trips' },
];

export function MainLayout({ children }: MainLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut, loading } = useAuth();

  const closeMobileMenu = () => setMobileOpen(false);

  return (
    <div className="site-shell">
      <header className="site-header" aria-label="Site header">
        <div className="site-header__inner">
          <div className="brand" aria-label="HUEGO home">
            <span className="brand__mark">H</span>
            <div className="brand__text">
              <span className="brand__title">HUEGO</span>
              <span className="brand__tagline">Plan less. Experience Hue more.</span>
            </div>
          </div>

          <nav className="site-nav" aria-label="Main navigation">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `site-nav__link ${isActive ? 'active' : ''}`.trim()}
              >
                {item.label}
              </NavLink>
            ))}
            <NavLink to="/plan" className="site-nav__cta">
              Plan My Trip
            </NavLink>
          </nav>

          <div className="inline-actions" style={{ gap: '0.5rem' }}>
            {!loading && user ? (
              <>
                <span className="muted" style={{ fontSize: '0.8rem' }}>{user.email}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => void signOut()}>
                  Sign out
                </Button>
              </>
            ) : (
              <NavLink to="/auth" className="site-nav__link">
                Sign in
              </NavLink>
            )}
            <button
              type="button"
              className="mobile-nav-toggle"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-panel"
              onClick={() => setMobileOpen((open) => !open)}
            >
              ☰
            </button>
          </div>
        </div>

        <div id="mobile-nav-panel" className="mobile-nav-panel" data-open={mobileOpen ? 'true' : 'false'} aria-label="Mobile navigation menu">
          <div className="mobile-nav-list">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className="mobile-nav-link" onClick={closeMobileMenu}>
                {item.label}
              </NavLink>
            ))}
            <NavLink to="/plan" className="mobile-nav-link" onClick={closeMobileMenu}>
              Plan My Trip
            </NavLink>
            {user ? (
              <Button type="button" variant="outline" onClick={() => { void signOut(); closeMobileMenu(); }}>
                Sign out
              </Button>
            ) : (
              <NavLink to="/auth" className="mobile-nav-link" onClick={closeMobileMenu}>
                Sign in
              </NavLink>
            )}
          </div>
        </div>
      </header>

      <main className="site-main">
        <div className="page-shell">{children}</div>
      </main>

      <Footer />
    </div>
  );
}
