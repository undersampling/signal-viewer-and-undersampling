import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./Sidebar.css";
import {
  FaStethoscope,
  FaBrain,
  FaHeartbeat,
  FaVolumeUp,
  FaWaveSquare,
  FaSatellite,
  FaChartLine,
  FaBook,
  FaChevronRight,
  FaChevronDown,
} from "react-icons/fa";

const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [medicalOpen, setMedicalOpen] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const closeSidebar = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Backdrop Overlay */}
      <div
        className={`sidebar-overlay ${isOpen ? "open" : ""}`}
        onClick={closeSidebar}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        {/* Header */}
        <div className="sidebar-header">
          <div className="logo-container">
            <FaChartLine className="logo-icon" />
            {isOpen && <span className="logo-text">Signal Viewer Pro</span>}
          </div>
          <button
            className="toggle-btn"
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
          >
            <FaChevronRight className={isOpen ? "rotate" : ""} />
          </button>
        </div>

        {/* Menu Content */}
        <div className="sidebar-content">
          <div className="menu-category">
            <Link to="/" className="menu-item" onClick={closeSidebar}>
              <FaBook className="menu-icon" />
              {isOpen && <span>Home</span>}
            </Link>
          </div>

          {/* Medical Signals Section */}
          <div className="menu-category">
            <div
              className="menu-item expandable"
              onClick={() => setMedicalOpen(!medicalOpen)}
            >
              <FaStethoscope className="menu-icon" />
              {isOpen && (
                <>
                  <span>Medical Analysis</span>
                  <FaChevronDown
                    className={`expand-icon ${medicalOpen ? "open" : ""}`}
                  />
                </>
              )}
            </div>

            {medicalOpen && isOpen && (
              <div className="submenu">
                <Link
                  to="/medical/ecg"
                  className="submenu-item"
                  onClick={closeSidebar}
                >
                  <FaHeartbeat className="submenu-icon" />
                  <span>ECG Analysis</span>
                </Link>
                <Link
                  to="/medical/eeg"
                  className="submenu-item"
                  onClick={closeSidebar}
                >
                  <FaBrain className="submenu-icon" />
                  <span>EEG Analysis</span>
                </Link>
              </div>
            )}
          </div>

          {/* Sound Signals Section */}
          <div className="menu-category">
            <div
              className="menu-item expandable"
              onClick={() => setSoundOpen(!soundOpen)}
            >
              <FaVolumeUp className="menu-icon" />
              {isOpen && (
                <>
                  <span>Sound Analysis</span>
                  <FaChevronDown
                    className={`expand-icon ${soundOpen ? "open" : ""}`}
                  />
                </>
              )}
            </div>

            {soundOpen && isOpen && (
              <div className="submenu">
                <Link
                  to="/drone"
                  className="submenu-item"
                  onClick={closeSidebar}
                >
                  <FaBook className="submenu-icon" />
                  <span>Drone Detection</span>
                </Link>
                <Link
                  to="/sound/human"
                  className="submenu-item"
                  onClick={closeSidebar}
                >
                  <FaVolumeUp className="submenu-icon" />
                  <span>Human Sound</span>
                </Link>
                <Link
                  to="/sound/doppler"
                  className="submenu-item"
                  onClick={closeSidebar}
                >
                  <FaWaveSquare className="submenu-icon" />
                  <span>Doppler Analysis</span>
                </Link>
                <Link
                  to="/sound/soar"
                  className="submenu-item"
                  onClick={closeSidebar}
                >
                  <FaSatellite className="submenu-icon" />
                  <span>SAR Analysis</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
