import { useMemo } from 'react'
import { Marker, Popup } from 'react-leaflet'
import L from 'leaflet'

function getFriendIcon(friend) {
  const initials = `${friend.first_name?.[0] ?? ''}`.toUpperCase() || '?'
  const avatarUrl = friend.photo_url
  const online = friend.online
  const bg = online ? '#22c55e' : '#6b7280' // green if online, gray if offline

  const innerContent = avatarUrl
    ? `<img src="${avatarUrl}" style="
        width:36px;height:36px;border-radius:50%;object-fit:cover;
        border:3px solid white;box-shadow:0 0 8px rgba(0,0,0,0.3);
      " onerror="this.style.display='none';this.parentElement.innerHTML='<div style=\\'width:36px;height:36px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;border:3px solid white;font-size:14px;font-weight:700;color:white;\\'>${initials}</div>'" />`
    : `<div style="
        width:36px;height:36px;border-radius:50%;
        background:${bg};
        display:flex;align-items:center;justify-content:center;
        border:3px solid white;box-shadow:0 0 8px rgba(0,0,0,0.3);
        font-size:14px;font-weight:700;color:white;
      ">${initials}</div>`

  return L.divIcon({
    className: '',
    html: `<div style="
      width:40px;height:40px;display:flex;align-items:center;justify-content:center;
    ">${innerContent}
    ${online ? '<div style="position:absolute;top:0;right:0;width:10px;height:10px;background:#22c55e;border:2px solid white;border-radius:50%;"></div>' : ''}
    </div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  })
}

export default function FriendMarkers({ friends }) {
  // Отображаем только друзей с известной локацией
  const markers = useMemo(() => {
    return (friends || []).filter(f => f.lat && f.lng)
  }, [friends])

  return markers.map((friend) => (
    <Marker
      key={friend.telegram_id}
      position={[friend.lat, friend.lng]}
      icon={getFriendIcon(friend)}
    >
      <Popup>
        <div className="friend-popup">
          <strong>{friend.first_name}</strong>
          {friend.username && <div style={{ fontSize: 12, color: '#9ca3af' }}>@{friend.username}</div>}
          <div style={{
            fontSize: 11,
            color: friend.online ? '#22c55e' : '#6b7280',
            marginTop: 4,
          }}>
            {friend.online ? '🟢 Online' : '⚪ Offline'}
          </div>
        </div>
      </Popup>
    </Marker>
  ))
}
