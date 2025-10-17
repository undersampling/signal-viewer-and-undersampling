import Navbar from "./components/Navbar";
import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Sidebar from "./components/Sidebar";

import "./App.css";
import Drone from "./pages/Drone/Drone";
import Doppler from "./pages/Doppler/Doppler";
import SAR from "./pages/SAR/SAR";
import Human from "./pages/Human/Human";

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
            <Route path="/ecg" element={<div>EEG Page - Coming Soon</div>} />
            <Route path="/eeg" element={<div>EEG Page - Coming Soon</div>} />
            <Route path="/drone" element={<Drone />} />

            <Route path="/human" element={<Human />} />
            <Route path="/doppler" element={<Doppler />} />
            <Route path="/sar" element={<SAR />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
};

export default App;
