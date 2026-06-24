import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Avatar from '../common/Avatar';
import Badge from '../common/Badge';

// Fix Leaflet's default icon path issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Component to dynamically update map center
const ChangeView = ({ center, zoom }) => {
  const map = useMap();
  map.setView(center, zoom);
  return null;
};

const CustomMapContainer = ({ users, userLocation }) => {
  const defaultCenter = [40.7128, -74.0060]; // NYC fallback
  const center = userLocation || defaultCenter;

  return (
    <div className="w-full h-[600px] rounded-2xl overflow-hidden border border-border shadow-xl relative z-0">
      <MapContainer 
        center={center} 
        zoom={13} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%' }}
      >
        <ChangeView center={center} zoom={13} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles-dark" // We will style this in index.css to look dark
        />
        
        {userLocation && (
          <Marker position={userLocation}>
            <Popup className="custom-popup">
              <div className="text-center">
                <span className="font-semibold text-accent">You are here</span>
              </div>
            </Popup>
          </Marker>
        )}

        {users?.map(user => {
          if (!user.locationCoordinates?.coordinates) return null;
          const [lng, lat] = user.locationCoordinates.coordinates;
          return (
            <Marker key={user._id} position={[lat, lng]}>
              <Popup className="custom-popup">
                <div className="flex flex-col gap-2 p-1 min-w-[200px]">
                  <div className="flex items-center gap-3 border-b border-gray-200 pb-2">
                    <Avatar name={user.name} size="sm" userId={user._id} />
                    <div>
                      <h4 className="font-medium text-gray-900 m-0 leading-tight">{user.name}</h4>
                      <div className="text-xs text-gray-500 mt-1">Trust: {user.trustScore}</div>
                    </div>
                  </div>
                  {user.skills && user.skills.length > 0 ? (
                    <div className="mt-1">
                      <span className="text-xs font-semibold text-gray-500 uppercase">Teaches:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {user.skills.slice(0, 2).map(skill => (
                          <Badge key={skill._id} variant="primary" className="text-[10px] px-2 py-0">
                            {skill.skillOffered}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500 italic">No skills listed yet</span>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default CustomMapContainer;
