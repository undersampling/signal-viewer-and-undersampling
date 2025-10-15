import Navbar from "./components/Navbar";
import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar";
// import Home from "./pages/Home";
import "./App.css";
import Drone from "./pages/Drone/Drone";
import Doppler from "./pages/Doppler/Doppler";
import SAR from "./pages/SAR/SAR";
import Human from "./pages/Human";

const App = () => {
  return (
    <Router>
      <div className="app-container">
        <Navbar />

        <div>
          <Routes>
            <Route
              path="/"
              element={
                <div className="home-container">
                  <h1>Welcome to the Signal Viewer Dashboard</h1>
                  <p>
                    Select a tool from the navigation bar above to begin
                    analyzing signals.
                  </p>
                </div>
              }
            />
            <Route
              path="/medical/ecg"
              element={<div>EEG Page - Coming Soon</div>}
            />
            <Route
              path="/medical/eeg"
              element={<div>EEG Page - Coming Soon</div>}
            />
            <Route path="/drone" element={<Drone />} />

            <Route path="/human" element={<Human />} />
            <Route path="/doppler" element={<Doppler />} />
            <Route path="/sar" element={<SAR />} />
            <Route
              path="/sound/soar"
              element={<div>EEG Page - Coming Soon</div>}
            />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
