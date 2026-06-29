import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet'
import L from 'leaflet'
import { useTelegram } from '../providers/TelegramProvider'
import { updateLocation, getFriendsWithLocations } from '../lib/supabase'
import FriendMarkers from './FriendMarkers'
import FriendsPanel from './FriendsPanel'
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

function FlyToCenter({ lat, lng }) {
  const map = useMap()
  useEffect(() => {
    if (lat != null && lng != null) {
      map.flyTo([lat, lng], 15, { duration: 1 })
    }
  }, [lat, lng, map])
  return null
}

export default function MapView() {
  const { user, debug } = useTelegram()
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  const [showDebug, setShowDebug] = useState(false)
  const [showFriends, setShowFriends] = useState(false)
  const [friends, setFriends] = useState([])
  const [centerFriend, setCenterFriend] = useState(null)
  const previousPositionRef = useRef(null)

  const defaultCenter = [55.7558, 37.6173] // Moscow

  // ── Debounced location update to Supabase ──────────────────────
  const sendLocationUpdate = useCallback((lat, lng) => {
    if (user?.id) {
      updateLocation(user.id, lat, lng)
    }
  }, [user])

  // ── Geolocation ────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported')
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = [pos.coords.latitude, pos.coords.longitude]
        setPosition(newPos)
        setError(null)
      },
      (err) => {
        setError(err.message)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [])

  // ── Send location to Supabase when it changes (debounced) ─────
  useEffect(() => {
    if (!position || !user?.id) return

    // Only update if moved more than ~50 meters (0.0005 deg ≈ 50m)
    const [lat, lng] = position
    const prev = previousPositionRef.current
    if (prev) {
      const [plat, plng] = prev
      const dist = Math.sqrt((lat - plat) ** 2 + (lng - plng) ** 2)
      if (dist < 0.0005) return // too small to update
    }

    previousPositionRef.current = position
    sendLocationUpdate(lat, lng)
  }, [position, user?.id, sendLocationUpdate])

  // ── Poll friends locations every 15 seconds ───────────────────
  useEffect(() => {
    if (!user?.id) return

    const fetchFriends = async () => {
      const data = await getFriendsWithLocations(user.id)
      setFriends(data)
    }

    fetchFriends() // initial fetch
    const interval = setInterval(fetchFriends, 15000)

    return () => clearInterval(interval)
  }, [user?.id])

  // ── User icon ──────────────────────────────────────────────────
  const userIcon = useMemo(() => {
    const avatarUrl = user?.photoUrl
    const initials = user
      ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || user.firstName?.slice(0,2) || '?'
      : '?'

    const bg = user ? '#c084fc' : '#ef4444'

    const innerContent = avatarUrl
      ? `<img src="${avatarUrl}" style="
          width:40px;height:40px;border-radius:50%;object-fit:cover;
          border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.3);
        " onerror="this.style.display='none';this.parentElement.innerHTML='<div style=\\'width:40px;height:40px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;border:3px solid white;font-size:16px;font-weight:700;color:white;\\'>${initials}</div>'" />`
      : `<div style="
          width:40px;height:40px;border-radius:50%;
          background:${bg};
          display:flex;align-items:center;justify-content:center;
          border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.3);
          font-size:16px;font-weight:700;color:white;
        ">${initials}</div>`

    return L.divIcon({
      className: '',
      html: `<div style="
        width:44px;height:44px;display:flex;align-items:center;justify-content:center;
      ">${innerContent}</div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    })
  }, [user])

  // ── Center on friend callback ──────────────────────────────────
  const handleCenterFriend = useCallback((lat, lng) => {
    setCenterFriend({ lat, lng })
    setTimeout(() => setCenterFriend(null), 1500) // reset after fly
  }, [])

  return (
    <div className="map-wrapper">
      {!user && (
        <div className="map-error" style={{ background: 'rgba(0,0,0,0.85)', color: '#fbbf24', whiteSpace: 'normal', maxWidth: '92%' }}>
          <span>⚠️ User data not found — Telegram WebView may not have passed user info</span>
        </div>
      )}

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
                  <strong>{user?.firstName || user?.username || 'No user'}</strong>
                  <div className="popup-debug">
                    Telegram: {typeof window.Telegram !== 'undefined' ? '✅' : '❌'}<br/>
                    WebApp: {window.Telegram?.WebApp ? '✅' : '❌'}<br/>
                    User data: {user ? '✅' : '❌'}<br/>
                    {user ? `ID: ${user.id}` : ''}
                  </div>
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

        {/* Friend markers */}
        <FriendMarkers friends={friends} />

        {centerFriend && (
          <FlyToCenter lat={centerFriend.lat} lng={centerFriend.lng} />
        )}

        <LocationUpdater position={position} />
      </MapContainer>

      {/* Debug overlay */}
      {showDebug && debug && (
        <div className="debug-overlay">
          <button className="debug-close" onClick={() => setShowDebug(false)}>✕</button>
          <pre>{JSON.stringify(debug, null, 2)}</pre>
        </div>
      )}

      {/* Friends panel */}
      {showFriends && (
        <FriendsPanel
          friends={friends}
          onClose={() => setShowFriends(false)}
          onCenterFriend={handleCenterFriend}
        />
      )}

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
        <button
          className="fab fab-friends"
          aria-label="Friends list"
          onClick={() => setShowFriends(s => !s)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </button>
        {/* Chat button placeholder — будет позже */}
        <button className="fab fab-chat" aria-label="Chat">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a14 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
