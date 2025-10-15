import React, { useState } from "react";
import { apiService } from "../../services/api";
import "./Drone.css";
import "../../components/Audio.css";
import AudioUploader from "../../components/AudioUploader";
import DisplayAudio from "../../components/DisplayAudio";

const Drone = () => {
  const [file, setFile] = useState(null);
  const [audioSrc, setAudioSrc] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  //  Comparison
  const [showComparison, setShowComparison] = useState(false);
  const [resampleRate, setResampleRate] = useState(16000); // default resample rate

  const handleFileSelected = (selectedFile) => {
    setFile(selectedFile);
    setAudioSrc(URL.createObjectURL(selectedFile));
    setAnalysis(null);
    setError("");
    setShowComparison(false); // Reset comparison on new file
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await apiService.detectDrone(file);
      setAnalysis(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Analysis failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleComparison = () => {
    setShowComparison(!showComparison);
  };

  return (
    <>
      <h1 className="page-title">🚁 Drone Sound Detector</h1>

      <div className="upload-section">
        <AudioUploader
          onFileSelect={handleFileSelected}
          onAnalyze={handleAnalyze}
          isLoading={isLoading}
        />
      </div>

      {error && <div className="alert error">{error}</div>}

      {analysis && (
        <div className="results-container">
          <div
            className={`alert ${
              analysis.prediction === "DRONE" ? "success" : "info"
            }`}
          >
            <h3>Prediction: {analysis.prediction}</h3>
          </div>

          {/* 🆕 Comparison Toggle Button */}
          <div className="comparison-controls">
            <button className="btn btn-secondary" onClick={toggleComparison}>
              {showComparison ? "Hide Comparison" : "Show Comparison"}
            </button>

            {/* 🆕 Resample Rate Slider */}
            {showComparison && (
              <div className="resample-control">
                <label>
                  Sample Rate: <strong>{resampleRate} Hz</strong>
                </label>
                <input
                  type="range"
                  min="8000"
                  max="48000"
                  step="1000"
                  value={resampleRate}
                  onChange={(e) => setResampleRate(Number(e.target.value))}
                />
              </div>
            )}
          </div>

          {/* 🆕 Conditional Rendering: Single or Side-by-Side */}
          {!showComparison ? (
            // Single display
            <DisplayAudio
              analysis={analysis}
              audioSrc={audioSrc}
              setError={setError}
            />
          ) : (
            // Side-by-side comparison
            <div className="comparison-container">
              <div className="comparison-side">
                <h3>Original Audio</h3>
                <DisplayAudio
                  analysis={analysis}
                  audioSrc={audioSrc}
                  setError={setError}
                />
              </div>

              <div className="comparison-side">
                <h3>Resampled Audio</h3>

                <DisplayAudio
                  analysis={analysis}
                  audioSrc={audioSrc}
                  setError={setError}
                  resampleRate={resampleRate}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default Drone;
