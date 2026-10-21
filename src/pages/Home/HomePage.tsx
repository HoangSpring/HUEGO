import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { MediaFrame } from '../../components/ui/MediaFrame';

export function HomePage() {
  return (
    <div className="page home-page">
      <section className="section hero-panel">
        <div className="stack stack--lg">
          <Badge variant="primary">Huế trip planning</Badge>
          <div className="stack stack--sm">
            <h1 className="page-heading" style={{ fontSize: 'clamp(2.4rem, 4vw, 4rem)' }}>
              Discover the calm rhythm of Huế.
            </h1>
            <p className="page-subtitle" style={{ fontSize: '1.05rem', maxWidth: '36rem' }}>
              Build an itinerary that feels local, balanced, and easy to explore — with thoughtfully curated places for culture, food, and slow travel.
            </p>
          </div>

          <div className="inline-actions">
            <Button variant="primary" size="lg">Plan My Trip</Button>
            <Button variant="outline" size="lg">Explore Huế</Button>
          </div>
        </div>

        <MediaFrame
          aspect="landscape"
          alt="Huế river landscape"
          src="https://images.unsplash.com/photo-1505761671935-60eb1d7d6c1e?auto=format&fit=crop&w=900&q=80"
          fallback="Huế scenic view"
        />
      </section>

      <section className="section section--tight">
        <div className="summary-grid">
          <div className="summary-tile">
            <span className="summary-tile__label">Time</span>
            <span className="summary-tile__value">2–3 days</span>
          </div>
          <div className="summary-tile">
            <span className="summary-tile__label">Style</span>
            <span className="summary-tile__value">Slow & local</span>
          </div>
          <div className="summary-tile">
            <span className="summary-tile__label">Budget</span>
            <span className="summary-tile__value">Flexible</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-header">
          <div>
            <div className="eyebrow">Featured</div>
            <h2 className="page-heading">Ideas for your Huế stay</h2>
          </div>
        </div>

        <div className="grid grid--cols-3">
          {[
            { tag: 'History', title: 'Imperial Citadel', text: 'Walk the royal heart of the city...' },
            { tag: 'Food', title: 'Bánh bèo lunch', text: 'Taste local specialties...' },
            { tag: 'Nature', title: 'Perfume River', text: 'Take an evening river stroll...' },
          ].map((item) => (
            <Card key={item.title} interactive>
              <MediaFrame aspect="landscape" alt={item.title} fallback={item.tag} />
              <CardBody>
                <div className="place-card__meta">
                  <Badge variant="accent">{item.tag}</Badge>
                  <span className="muted">1-2 hrs</span>
                </div>
                <h3 style={{ margin: '0.85rem 0 0.4rem' }}>{item.title}</h3>
                <p className="muted" style={{ margin: 0 }}>{item.text}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
