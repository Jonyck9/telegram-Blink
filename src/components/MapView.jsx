import { useEffect, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet'
import L from 'leaflet'
import { useTelegram } from '../providers/TelegramProvider'
import './MapView.css'

function LocationUpdater({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) {
      map.flyTo(position, map.getZoom() < 14 ? 14 : map.getZoom(), {
        duration: 1.5,
      })
    }
  }, [position, map])
  return null
}

export default function MapView() {
  const { user } = useTelegram()
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)

  const defaultCenter = [55.7558, 37.6173] // Moscow

  // Build a divIcon that shows the user's Telegram avatar (or initials)
  const userIcon = useMemo(() => {
    const initials = user
      ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || '?'
      : '?'

    const avatarHtml = user?.photoUrl
      ? `<img class="marker-avatar-img" src="${user.photoUrl}" alt="" />`
      : `<span class="marker-avatar-initials">${initials}</span>`

    return L.divIcon({
      className: 'user-marker',
      html: `<div class="marker-avatar-wrap">${avatarHtml}<div class="marker-avatar-ring"></div></div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    })
  }, [user])

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude])
        setError(null)
      },
      (err) => {
        setError(err.message)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  return (
    <div className="map-wrapper">
      {error && (
        <div className="map-error">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Location unavailable — {error}</span>
        </div>
      )}

      <MapContainer
        center={position || defaultCenter}
        zoom={14}
        className="map-container"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {position && (
          <>
            <Marker position={position} icon={userIcon}>
              <Popup>
                <div className="user-popup">
                  <strong>{user?.firstName ?? 'You'}</strong>
                  <span className="popup-status online">📍 Live</span>
                  <span className="popup-coords">
                    {position[0].toFixed(4)}, {position[1].toFixed(4)}
                  </span>
                </div>
              </Popup>
            </Marker>
            <Circle
              center={position}
              radius={15}
              pathOptions={{
                color: '#c084fc',
                fillColor: '#c084fc',
                fillOpacity: 0.15,
                weight: 1,
              }}
            />
          </>
        )}

        <LocationUpdater position={position} />
      </MapContainer>

      {/* Floating action buttons */}
      <div className="map-fabs">
        <button
          className="fab fab-locate"
          onClick={() => setPosition((p) => p && [...p])}
          aria-label="Center on my location"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
        <button className="fab fab-friends" aria-label="Friends list">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </button>
        <button className="fab fab-chat" aria-label="Chat">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
