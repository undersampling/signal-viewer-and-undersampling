import React, { useState } from "react";
import { apiService } from "../services/api";
// import "./Human.css";
import AudioUploader from "../components/AudioUploader";
import DisplayAudio from "../components/DisplayAudio";

const Human = () => {
  const [file, setFile] = useState(null);
  const [audioSrc, setAudioSrc] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleFileSelected = (selectedFile) => {
    setFile(selectedFile);
    setAudioSrc(URL.createObjectURL(selectedFile));
    setAnalysis(null);
    setError("");
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsLoading(true);
    setError("");
    try {
      // 2. Changed the API call to a new function for human sound
      // Make sure you create this function in your api.js service file!
      const response = await apiService.detectDrone(file);
      setAnalysis(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Analysis failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* 3. Changed the page title */}
      <h1 className="page-title">🗣️ Human Sound Analysis</h1>

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
          {/* 4. REMOVED the prediction display section */}
          <DisplayAudio
            analysis={analysis}
            audioSrc={audioSrc}
            setError={setError}
          />
        </div>
      )}
    </>
  );
};

export default Human;
