import { TelegramProvider } from './providers/TelegramProvider'
import MapPage from './pages/MapPage'
import './App.css'

function App() {
  return (
    <TelegramProvider>
      <MapPage />
    </TelegramProvider>
  )
}

export default App
