// import React, { useState } from "react";
// import { apiService } from "../../services/api";
// import "./Drone.css";
// import "../../components/Audio.css";
// import AudioUploader from "../../components/AudioUploader";
// import DisplayAudio from "../../components/DisplayAudio";

// const Drone = () => {
//   const [file, setFile] = useState(null);
//   const [audioSrc, setAudioSrc] = useState(null);
//   const [analysis, setAnalysis] = useState(null);
//   const [error, setError] = useState("");
//   const [isLoading, setIsLoading] = useState(false);

//   //  Comparison
//   const [showComparison, setShowComparison] = useState(false);
//   const [resampleRate, setResampleRate] = useState(16000); // default resample rate

//   const handleFileSelected = (selectedFile) => {
//     setFile(selectedFile);
//     setAudioSrc(URL.createObjectURL(selectedFile));
//     setAnalysis(null);
//     setError("");
//     setShowComparison(false); // Reset comparison on new file
//   };

//   const handleAnalyze = async () => {
//     if (!file) return;
//     setIsLoading(true);
//     setError("");
//     try {
//       const response = await apiService.detectDrone(file);
//       setAnalysis(response.data);
//     } catch (err) {
//       setError(err.response?.data?.error || "Analysis failed.");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const toggleComparison = () => {
//     setShowComparison(!showComparison);
//   };

//   return (
//     <div className="page-container">
//       <h1 className="page-title">🚁 Drone Sound Detector</h1>

//       <div className="upload-section">
//         <AudioUploader
//           onFileSelect={handleFileSelected}
//           onAnalyze={handleAnalyze}
//           isLoading={isLoading}
//         />
//       </div>

//       {error && <div className="alert error">{error}</div>}

//       {analysis && (
//         <div className="results-container">
//           <div
//             className={`alert ${
//               analysis.prediction === "DRONE" ? "success" : "info"
//             }`}
//           >
//             <h3>Prediction: {analysis.prediction}</h3>
//           </div>

//           {/* 🆕 Comparison Toggle Button */}
//           <div className="comparison-controls">
//             <button className="btn btn-secondary" onClick={toggleComparison}>
//               {showComparison ? "Hide Comparison" : "Show Comparison"}
//             </button>

//             {/* 🆕 Resample Rate Slider */}
//             {showComparison && (
//               <div className="resample-control">
//                 <label>
//                   Sample Rate: <strong>{resampleRate} Hz</strong>
//                 </label>
//                 <input
//                   type="range"
//                   min="8000"
//                   max="48000"
//                   step="1000"
//                   value={resampleRate}
//                   onChange={(e) => setResampleRate(Number(e.target.value))}
//                 />
//               </div>
//             )}
//           </div>

//           {/* 🆕 Conditional Rendering: Single or Side-by-Side */}
//           {!showComparison ? (
//             // Single display
//             <DisplayAudio
//               analysis={analysis}
//               audioSrc={audioSrc}
//               setError={setError}
//             />
//           ) : (
//             // Side-by-side comparison
//             <div className="comparison-container">
//               <div className="comparison-side">
//                 <h3>Original Audio</h3>
//                 <DisplayAudio
//                   analysis={analysis}
//                   audioSrc={audioSrc}
//                   setError={setError}
//                 />
//               </div>

//               <div className="comparison-side">
//                 <h3>Resampled Audio</h3>

//                 <DisplayAudio
//                   analysis={analysis}
//                   audioSrc={audioSrc}
//                   setError={setError}
//                   resampleRate={resampleRate}
//                 />
//               </div>
//             </div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// };

// export default Drone;
import React, { useState, useEffect } from "react";
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

  // Comparison state
  const [showComparison, setShowComparison] = useState(false);
  const [resampleRate, setResampleRate] = useState(16000);
  
  // Downsampled audio state
  const [downsampledAudio, setDownsampledAudio] = useState(null);
  const [downsampledAnalysis, setDownsampledAnalysis] = useState(null);
  const [originalRate, setOriginalRate] = useState(0);
  const [isDownsampling, setIsDownsampling] = useState(false);

  const handleFileSelected = (selectedFile) => {
    setFile(selectedFile);
    setAudioSrc(URL.createObjectURL(selectedFile));
    setAnalysis(null);
    setError("");
    setShowComparison(false);
    setDownsampledAudio(null);
    setDownsampledAnalysis(null);
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

  const handleDownsample = async () => {
    if (!file) {
      setError("Please upload an audio file first.");
      return;
    }

    setIsDownsampling(true);
    setError("");

    try {
      const response = await apiService.downsampleAudio(file, resampleRate);
      
      let data;
      if (response && response.data) {
        data = response.data;
      } else if (response && typeof response === 'object') {
        data = response;
      } else {
        throw new Error("Invalid response structure");
      }

      if (!data.original_rate && data.original_rate !== 0) {
        throw new Error("Invalid data structure: missing original_rate");
      }

      setOriginalRate(data.original_rate);
      setDownsampledAudio(data.downsampled_audio);

      // Analyze the downsampled audio
      await analyzeDownsampledAudio(data.downsampled_audio);

    } catch (err) {
      console.error("Downsampling error:", err);
      const errorMessage = err.response?.data?.error 
        || err.message 
        || "Downsampling failed.";
      setError(errorMessage);
    } finally {
      setIsDownsampling(false);
    }
  };

  const analyzeDownsampledAudio = async (audioDataUri) => {
    try {
      // Convert data URI to Blob
      const response = await fetch(audioDataUri);
      const blob = await response.blob();
      const downsampledFile = new File([blob], "downsampled.wav", { type: "audio/wav" });

      // Analyze the downsampled file
      const analysisResponse = await apiService.detectDrone(downsampledFile);
      setDownsampledAnalysis(analysisResponse.data);
    } catch (err) {
      console.error("Downsampled analysis error:", err);
      setError("Failed to analyze downsampled audio.");
    }
  };

  const toggleComparison = () => {
    if (!showComparison && !downsampledAudio) {
      // If enabling comparison for the first time, trigger downsampling
      handleDownsample();
    }
    setShowComparison(!showComparison);
  };

  // Re-downsample when resample rate changes in comparison mode
  useEffect(() => {
    if (showComparison && file) {
      handleDownsample();
    }
  }, [resampleRate]);

  return (
    <div className="page-container">
      <h1 className="page-title">🚁 Drone Sound Detector</h1>

      <div className="upload-section">
        <AudioUploader
          onFileSelect={handleFileSelected}
          onAnalyze={handleAnalyze}
          isLoading={isLoading}
          accept=".wav,.mp3"
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
            <h3>Original Prediction: {analysis.prediction}</h3>
            {originalRate > 0 && <p>Original Sample Rate: {originalRate} Hz</p>}
          </div>

          {/* Comparison Toggle Button */}
          <div className="comparison-controls">
            <button 
              className="btn btn-secondary" 
              onClick={toggleComparison}
              disabled={isDownsampling}
            >
              {isDownsampling 
                ? "Processing..." 
                : showComparison 
                ? "Hide Comparison" 
                : "Show Comparison"}
            </button>

            {/* Resample Rate Slider */}
            {showComparison && (
              <div className="resample-control">
                <label>
                  Resample Rate: <strong>{resampleRate} Hz</strong>
                </label>
                <input
                  type="range"
                  min="8000"
                  max={originalRate || 48000}
                  step="1000"
                  value={resampleRate}
                  onChange={(e) => setResampleRate(Number(e.target.value))}
                  disabled={isDownsampling}
                />
              </div>
            )}
          </div>

          {/* Conditional Rendering: Single or Side-by-Side */}
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
                <h3>Original Audio ({originalRate} Hz)</h3>
                <DisplayAudio
                  analysis={analysis}
                  audioSrc={audioSrc}
                  setError={setError}
                />
              </div>

              <div className="comparison-side">
                <h3>Downsampled Audio ({resampleRate} Hz)</h3>
                {isDownsampling ? (
                  <div className="loading-spinner">Processing...</div>
                ) : downsampledAudio && downsampledAnalysis ? (
                  <>
                    <div className={`alert ${
                      downsampledAnalysis.prediction === "DRONE" ? "success" : "info"
                    }`}>
                      <h4>Prediction: {downsampledAnalysis.prediction}</h4>
                    </div>
                    <DisplayAudio
                      analysis={downsampledAnalysis}
                      audioSrc={downsampledAudio}
                      setError={setError}
                    />
                  </>
                ) : (
                  <div className="alert info">
                    Adjust the sample rate slider to generate downsampled audio
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Drone;