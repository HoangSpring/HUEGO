import { Button } from '../../components/ui/Button';

export function LanguageSelectionPage() {
  return (
    <div className="page page-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <section className="card" style={{ width: 'min(100%, 32rem)', padding: '2rem' }}>
        <div className="stack stack--lg">
          <div>
            <div className="eyebrow">Welcome</div>
            <h1 className="page-heading">Choose your language</h1>
          </div>

          <p className="page-subtitle" style={{ margin: 0 }}>
            Select how you want to experience HUEGO.
          </p>

          <div className="stack stack--sm">
            <Button variant="primary" size="lg">🇻🇳 Tiếng Việt</Button>
            <Button variant="outline" size="lg">🇬🇧 English</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
