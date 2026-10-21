import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/home', label: 'Home' },
  { to: '/explore', label: 'Explore' },
  { to: '/now', label: 'HUEGO NOW' },
  { to: '/my-trips', label: 'My Trips' },
];

export function MainNavigation() {
  return (
    <>
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

      <div className="mobile-nav-wrap">
        <button
          type="button"
          className="mobile-nav-toggle"
          aria-label="Toggle navigation menu"
          aria-expanded="false"
        >
          ☰
        </button>
      </div>
    </>
  );
}
