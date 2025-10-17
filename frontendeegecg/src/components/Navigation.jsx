import { Link, useLocation } from 'react-router-dom'
import '../styles/Navigation.css'

export default function Navigation() {
  const location = useLocation()

  const isActive = (path) => location.pathname === path ? 'active' : ''

  return (
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-brand">
          <i className="fas fa-chart-pie"></i>
          <span>Signal Viewer Pro</span>
        </Link>
        <ul className="nav-links">
          <li><Link to="/" className={isActive('/')}>Home</Link></li>
          <li><Link to="/eeg" className={isActive('/eeg')}>EEG Viewer</Link></li>
          <li><Link to="/ecg" className={isActive('/ecg')}>ECG Viewer</Link></li>
        </ul>
      </div>
    </nav>
  )
}
