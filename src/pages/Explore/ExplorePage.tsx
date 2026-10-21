import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Card, CardBody } from '../../components/ui/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { Input } from '../../components/ui/Input';
import { MediaFrame } from '../../components/ui/MediaFrame';
import { Select } from '../../components/ui/Select';
import { getPlaceCategories, getPlaceImages, getPlaces } from '../../services/places/placeService';
import type { PlaceCategoryRow, PlaceImageRow, PlaceRow } from '../../types/database';

const SUPABASE_STORAGE_URL = "https://lshdvvsgwivlnpirxgjy.supabase.co/storage/v1/object/public/place-images";

export function ExplorePage() {
  const [places, setPlaces] = useState<PlaceRow[]>([]);
  const [categories, setCategories] = useState<PlaceCategoryRow[]>([]);
  const [images, setImages] = useState<Record<string, PlaceImageRow[]>>({});
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadExplore = async () => {
      try {
        const [nextPlaces, nextCategories] = await Promise.all([getPlaces(), getPlaceCategories()]);
        const imageEntries = await Promise.all(nextPlaces.map(async (place) => [place.id, await getPlaceImages(place.id)] as const));
        setPlaces(nextPlaces);
        setCategories(nextCategories);
        setImages(Object.fromEntries(imageEntries));
      } catch (loadError) {
        console.error('Failed to load explore data:', loadError);
        setError('Unable to load places right now. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void loadExplore();
  }, []);

  const filteredPlaces = places.filter((place) => {
    const name = `${place.name_en ?? ''} ${place.name_vi ?? ''}`.toLowerCase();
    const matchesSearch = !search.trim() || name.includes(search.trim().toLowerCase());
    const matchesCategory = !categoryId || place.category_id === categoryId;
    return matchesSearch && matchesCategory;
  });

  const categoryName = (place: PlaceRow) => {
    const category = categories.find((item) => item.id === place.category_id);
    return category?.name_en || category?.name_vi || 'Huế place';
  };

  return (
    <div className="page explore-page">
      <section className="section stack stack--lg">
        <div>
          <div className="eyebrow">Explore</div>
          <h1 className="page-heading">Discover Huế</h1>
        </div>

        <div className="card content-card">
          <div className="grid grid--cols-2">
            <Input aria-label="Search places" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search places or neighborhoods" />
            <Select aria-label="Select category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">All categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name_en || category.name_vi || 'Category'}</option>)}
            </Select>
          </div>
        </div>

        {loading && <LoadingState title="Loading places" message="Gathering Huế destinations..." />}
        {!loading && error && <ErrorState title="Explore is unavailable" message={error} />}
        {!loading && !error && !places.length && <EmptyState title="No places yet" message="The Huế place collection is ready for its first destinations." />}
        {!loading && !error && places.length > 0 && !filteredPlaces.length && <EmptyState title="No matching places" message="Try a different search or category." />}
        {!loading && !error && filteredPlaces.length > 0 && <div className="grid grid--cols-3">
          {filteredPlaces.map((place) => {
            const rawImage = images[place.id]?.find((item) => item.is_cover) ?? images[place.id]?.[0];
            const name = place.name_en || place.name_vi || 'Untitled place';

            const imageUrl = rawImage?.storage_path
              ? `${SUPABASE_STORAGE_URL}/${rawImage.storage_path}`
              : undefined;

            const imageAlt = rawImage?.alt_text_vi || rawImage?.alt_text_en || name;

            return <Link key={place.id} to={`/place/${place.id}`} className="place-card-link">
              <Card interactive className="place-card">
                <MediaFrame aspect="landscape" src={imageUrl} alt={imageAlt} fallback={categoryName(place)} />
                <CardBody>
                  <div className="place-card__meta"><Badge variant="primary">{categoryName(place)}</Badge>{place.rating != null && <span className="muted">★ {place.rating}</span>}</div>
                  <h3 style={{ margin: '0.9rem 0 0.1rem' }}>{name}</h3>
                  <p className="muted" style={{ margin: 0 }}>{place.description_en || place.description_vi || 'A place to experience Huế at your own pace.'}</p>
                </CardBody>
              </Card>
            </Link>;
          })}
        </div>}
      </section>
    </div>
  );
}