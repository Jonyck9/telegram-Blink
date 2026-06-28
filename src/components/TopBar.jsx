import { useTelegram } from '../providers/TelegramProvider'
import './TopBar.css'

export default function TopBar() {
	const { user, viewport, error } = useTelegram()

	const initials = user
		? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
		: '?'

	const displayName = user?.firstName ?? 'jonyck'

	return (
		<header className='topbar'>
			<div className='topbar-left'>
				<span className='topbar-logo'>jonyckLoc</span>
			</div>

			<div className='topbar-center'>
				<div className='topbar-user'>
					<span className='topbar-greeting'>Hi, {displayName}</span>
					<div className='topbar-status online'>
						<span className='status-dot' />
						Online
					</div>
				</div>
			</div>

			<div className='topbar-right'>
				{user?.photoUrl ? (
					<img
						className='topbar-avatar'
						src={user.photoUrl}
						alt={displayName}
					/>
				) : (
					<div className='topbar-avatar topbar-avatar-placeholder'>
						{initials}
					</div>
				)}
			</div>

			{error && <div className='topbar-error'>⚠️ {error}</div>}
		</header>
	)
}
