import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/useAuth';
import { EmptyState } from '../../components/common/EmptyState';
import { ErrorState } from '../../components/common/ErrorState';
import { LoadingState } from '../../components/common/LoadingState';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { MediaFrame } from '../../components/ui/MediaFrame';
import { getFavoriteForPlace, setFavorite } from '../../services/places/favoriteService';
import { getPlaceById, getPlaceCategory, getPlaceImages, getPlaceTags } from '../../services/places/placeService';
import type { PlaceCategoryRow, PlaceImageRow, PlaceRow, TagRow } from '../../types/database';

const SUPABASE_STORAGE_URL = "https://lshdvvsgwivlnpirxgjy.supabase.co/storage/v1/object/public/place-images";

export function PlaceDetailPage() {
  const { placeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [place, setPlace] = useState<PlaceRow | null>(null);
  const [category, setCategory] = useState<PlaceCategoryRow | null>(null);
  const [images, setImages] = useState<PlaceImageRow[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [favorite, setFavoriteState] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!placeId) {
      return;
    }

    const loadPlace = async () => {
      try {
        const nextPlace = await getPlaceById(placeId);
        setPlace(nextPlace);
        if (nextPlace) {
          const [nextCategory, nextImages, nextTags] = await Promise.all([
            getPlaceCategory(nextPlace.category_id),
            getPlaceImages(nextPlace.id),
            getPlaceTags(nextPlace.id),
          ]);
          setCategory(nextCategory);
          setImages(nextImages);
          setTags(nextTags);
          if (user) {
            setFavoriteState(Boolean(await getFavoriteForPlace(nextPlace.id)));
          }
        }
      } catch (loadError) {
        console.error('Failed to load place:', loadError);
        setMessage('Unable to load this place right now. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void loadPlace();
  }, [placeId, user]);

  const handleFavorite = async () => {
    if (!place) return;
    if (!user) {
      navigate(`/auth?redirect=/place/${place.id}`);
      return;
    }
    try {
      await setFavorite(place.id, !favorite);
      setFavoriteState(!favorite);
    } catch (favoriteError) {
      console.error('Failed to update favorite:', favoriteError);
      setMessage('Unable to update your favorite right now.');
    }
  };

  if (loading && placeId) return <div className="page place-detail-page"><LoadingState title="Loading place" message="Opening destination details..." /></div>;
  if (message && !place) return <div className="page place-detail-page"><ErrorState title="Place unavailable" message={message} /></div>;
  if (!place) return <div className="page place-detail-page"><EmptyState title="Place not found" message="This destination is no longer available." action={{ label: 'Back to Explore', onClick: () => navigate('/explore') }} /></div>;

  const name = place.name_en || place.name_vi || 'Untitled place';
  const categoryName = category?.name_en || category?.name_vi || 'Huế place';

  const rawCover = images.find((image) => image.is_cover) ?? images[0];
  const coverUrl = rawCover?.storage_path ? `${SUPABASE_STORAGE_URL}/${rawCover.storage_path}` : undefined;
  const coverAlt = rawCover?.alt_text_vi || rawCover?.alt_text_en || name;

  const price = place.price_min != null || place.price_max != null ? `${place.price_min?.toLocaleString() ?? ''}${place.price_min != null && place.price_max != null ? ' - ' : ''}${place.price_max?.toLocaleString() ?? ''} VND` : null;
  const locationUrl = place.latitude != null && place.longitude != null ? `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}` : null;

  return (
    <div className="page place-detail-page">
      <div className="inline-actions" style={{ justifyContent: 'space-between' }}><Button variant="ghost" onClick={() => navigate(-1)}>Back</Button><Button variant="outline" onClick={() => void handleFavorite()}>{favorite ? 'Saved' : 'Favorite'}</Button></div>
      <div className="place-detail-content">
        <div className="place-images">
          <MediaFrame aspect="landscape" src={coverUrl} alt={coverAlt} fallback={name} />
        </div>
        <Card><CardBody>
          <Badge variant="primary">{categoryName}</Badge>
          <h1 className="page-heading">{name}</h1>
          <p>{place.description_en || place.description_vi || 'Discover this Huế destination at your own pace.'}</p>
          {images.length > 1 && (
            <div className="grid grid--cols-3">
              {images.slice(1).map((image) => {
                const subImgUrl = image.storage_path ? `${SUPABASE_STORAGE_URL}/${image.storage_path}` : undefined;
                const subImgAlt = image.alt_text_vi || image.alt_text_en || name;
                return <MediaFrame key={image.id} aspect="landscape" src={subImgUrl} alt={subImgAlt} fallback={name} />;
              })}
            </div>
          )}
          <div className="stack stack--sm">
            {place.address && <p><strong>Address:</strong> {place.address}</p>}
            {place.opening_time && place.closing_time && (
              <p><strong>Opening hours:</strong> {place.opening_time.slice(0, 5)} - {place.closing_time.slice(0, 5)}</p>
            )}
            {price && <p><strong>Price:</strong> {price}</p>}
            {place.duration_minutes != null && <p><strong>Suggested visit:</strong> {place.duration_minutes} minutes</p>}
            {place.rating != null && <p><strong>Rating:</strong> ★ {place.rating}</p>}
            {place.latitude != null && place.longitude != null && <p><strong>Coordinates:</strong> {place.latitude}, {place.longitude}</p>}
          </div>
          {!!tags.length && <div className="inline-actions">{tags.map((tag) => <Badge key={tag.id} variant="neutral">{tag.name_en || tag.name_vi || tag.slug}</Badge>)}</div>}
          {locationUrl && <a className="button button--outline" href={locationUrl} target="_blank" rel="noreferrer">View location</a>}
          <Button variant="primary" onClick={() => setMessage('Add to Trip is available from your saved trip itinerary.')}>Add to Trip</Button>
          {message && <p className="form-error" role="alert">{message}</p>}
        </CardBody></Card>
      </div>
    </div>
  );
}