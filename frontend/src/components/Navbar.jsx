import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "./Navbar.css";

const Navbar = () => {
  const location = useLocation();
  // State to manage the mobile menu toggle
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (path) => {
    return location.pathname === path ? "active" : "";
  };

  // Function to close the menu, useful for when a link is clicked on mobile
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand" onClick={closeMenu}>
          <i className="fas fa-chart-pie"></i>
          Signal Viewer Pro
        </Link>

        {/* Hamburger Menu Icon for Mobile */}
        <div className="menu-icon" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          <i className={isMenuOpen ? "fas fa-times" : "fas fa-bars"}></i>
        </div>

        {/* Navigation Links */}
        <ul className={`navbar-nav ${isMenuOpen ? "active" : ""}`}>
          <li>
            <Link
              to="/"
              className={`nav-link ${isActive("/")}`}
              onClick={closeMenu}
            >
              <i className="fas fa-home"></i> Home
            </Link>
          </li>
          <li>
            <Link
              to="/drone"
              className={`nav-link ${isActive("/drone")}`}
              onClick={closeMenu}
            >
              <i className="fa-solid fa-satellite-dish"></i> Drone Detection
            </Link>
          </li>
          <li>
            <Link
              to="/human"
              className={`nav-link ${isActive("/drone")}`}
              onClick={closeMenu}
            >
              <i className="fa-solid fa-satellite-dish"></i> Human
            </Link>
          </li>
          <li>
            <Link
              to="/eeg"
              className={`nav-link ${isActive("/eeg")}`}
              onClick={closeMenu}
            >
              <i className="fa-solid fa-brain"></i> EEG Viewer
            </Link>
          </li>
          <li>
            <Link
              to="/ecg"
              className={`nav-link ${isActive("/ecg")}`}
              onClick={closeMenu}
            >
              <i className="fa-solid fa-heart-pulse"></i> ECG Viewer
            </Link>
          </li>
          <li>
            <Link
              to="/sar"
              className={`nav-link ${isActive("/sar")}`}
              onClick={closeMenu}
            >
              <i className="fas fa-file-alt"></i> SAR
            </Link>
          </li>
          <li>
            <Link
              to="/doppler"
              className={`nav-link ${isActive("/doppler")}`}
              onClick={closeMenu}
            >
              <i className="fas fa-cog"></i> Doppler
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;


