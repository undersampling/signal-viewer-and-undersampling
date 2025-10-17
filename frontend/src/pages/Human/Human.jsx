import React, { useState } from "react";
import { apiService } from "../../services/api";
// import "./Human.css";
import AudioUploader from "../../components/AudioUploader";
import DisplayAudio from "../../components/DisplayAudio";

const Human = () => {
  const [file, setFile] = useState(null);
  const [audioSrc, setAudioSrc] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  //  Comparison
  const [showComparison, setShowComparison] = useState(false);
  const [resampleRate, setResampleRate] = useState(16000);

  const handleFileSelected = (selectedFile) => {
    setFile(selectedFile);
    setAudioSrc(URL.createObjectURL(selectedFile));
    setAnalysis(null);
    setError("");
    setShowComparison(false);
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
    <div className="page-container">
      <h1 className="page-title">🚁 Human Audio Aliasing</h1>

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
          {/* 🆕 Comparison Toggle Button */}
          <div className="comparison-controls">
            <button className="btn btn-secondary" onClick={toggleComparison}>
              {showComparison ? "Hide Comparison" : "Show Comparison"}
            </button>

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
    </div>
  );
};

export default Human;
