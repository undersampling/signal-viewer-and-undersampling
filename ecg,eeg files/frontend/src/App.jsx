import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navigation from './components/Navigation'
import Home from './pages/Home'
import EEGViewer from './pages/EEGViewer'
import ECGViewer from './pages/ECGViewer'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/eeg" element={<EEGViewer />} />
        <Route path="/ecg" element={<ECGViewer />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
