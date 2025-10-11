import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Drone from "./pages/Drone/Drone";
import "./App.css";

function App() {
  return (
    <Router>
      <div className="app-container">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/drone" element={<Drone />} />
          {/* Add other routes here */}
          <Route path="/eeg" element={<div>EEG Page - Coming Soon</div>} />
          <Route path="/ecg" element={<div>ECG Page - Coming Soon</div>} />
          <Route path="/sar" element={<div>SAR Page - Coming Soon</div>} />
          <Route
            path="/doppler"
            element={<div>Doppler Page - Coming Soon</div>}
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
