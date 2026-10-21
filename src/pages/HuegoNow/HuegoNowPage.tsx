export function HuegoNowPage() {
  return (
    <div className="page huego-now-page">
      <h1>HUEGO NOW</h1>
      <p>Discover nearby places based on your current location</p>
      <div className="location-request">
        <p>Enable location to see nearby places</p>
        <button className="enable-location-button">Enable Location</button>
      </div>
      <div className="nearby-places">
        <div className="place-item">
          <div className="place-name">Sample Place</div>
          <div className="place-distance">500m away</div>
        </div>
      </div>
    </div>
  );
}
