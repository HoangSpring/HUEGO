export function Footer() {
  return (
    <footer className="site-footer" aria-label="Footer">
      <div className="site-footer__inner">
        <div>
          <strong>HUEGO</strong>
          <div className="muted">Travel thoughtfully through Huế.</div>
        </div>
        <div className="site-footer__meta">
          <div className="site-footer__links" aria-label="Useful links">
            <a href="/home">Home</a>
            <a href="/explore">Explore</a>
            <a href="/now">HUEGO NOW</a>
            <a href="/my-trips">My Trips</a>
          </div>
          <span>© 2026 HUEGO</span>
        </div>
      </div>
    </footer>
  );
}
