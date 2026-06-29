import { useMemo } from 'react'
import './FriendsPanel.css'

export default function FriendsPanel({ friends, onClose, onCenterFriend }) {
  // Сортируем: онлайн → первые, потом по имени
  const sorted = useMemo(() => {
    return [...(friends || [])].sort((a, b) => {
      if (a.online && !b.online) return -1
      if (!a.online && b.online) return 1
      return (a.first_name || '').localeCompare(b.first_name || '')
    })
  }, [friends])

  const onlineCount = (friends || []).filter(f => f.online).length

  return (
    <div className="friends-panel-overlay" onClick={onClose}>
      <div className="friends-panel" onClick={e => e.stopPropagation()}>
        <div className="friends-panel-header">
          <h2>👥 Друзья {friends?.length > 0 && `(${onlineCount} онлайн)`}</h2>
          <button className="friends-panel-close" onClick={onClose}>✕</button>
        </div>

        <div className="friends-panel-content">
          {!sorted.length ? (
            <div className="friends-empty">
              <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
              <div>Пока нет друзей</div>
              <div className="friends-empty-hint">
                Добавь в боте: /add username
              </div>
            </div>
          ) : sorted.map(friend => {
            const initials = `${friend.first_name?.[0] ?? ''}`.toUpperCase() || '?'
            const bg = friend.online ? '#22c55e' : '#6b7280'

            return (
              <div
                key={friend.telegram_id}
                className="friend-item"
                onClick={() => {
                  if (friend.lat && friend.lng) {
                    onCenterFriend?.(friend.lat, friend.lng)
                    onClose?.()
                  }
                }}
              >
                {friend.photo_url ? (
                  <img
                    className="friend-item-avatar"
                    src={friend.photo_url}
                    alt={friend.first_name}
                  />
                ) : (
                  <div
                    className="friend-item-avatar-placeholder"
                    style={{ background: bg }}
                  >
                    {initials}
                  </div>
                )}
                <div className="friend-item-info">
                  <div className="friend-item-name">
                    {friend.first_name}
                  </div>
                  {friend.username && (
                    <div className="friend-item-username">@{friend.username}</div>
                  )}
                </div>
                <div className={`friend-item-status ${friend.online ? 'online' : 'offline'}`}>
                  {friend.online ? '🟢 Online' : '⚪ Offline'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
