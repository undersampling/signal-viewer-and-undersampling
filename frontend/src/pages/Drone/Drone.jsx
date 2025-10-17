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
import React, { useState, useEffect } from "react";
import { apiService } from "../../services/api";
import "./Drone.css"; // Assuming this CSS is relevant
import "../../components/Audio.css"; // Assuming this CSS is relevant
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
  const [originalRate, setOriginalRate] = useState(0); // Stores the sample rate of the original uploaded audio

  // States for downsampling logic with debounce
  const [resampleRate, setResampleRate] = useState(16000); // This is the 'effective' rate that triggers downsampling
  const [sliderValue, setSliderValue] = useState(16000); // This is the rate displayed by the slider, updates immediately

  // Downsampled audio state
  const [downsampledAudio, setDownsampledAudio] = useState(null);
  const [downsampledAnalysis, setDownsampledAnalysis] = useState(null);
  const [isDownsampling, setIsDownsampling] = useState(false);

  const handleFileSelected = (selectedFile) => {
    setFile(selectedFile);
    setAudioSrc(URL.createObjectURL(selectedFile));
    setAnalysis(null);
    setError("");
    setShowComparison(false);
    setDownsampledAudio(null);
    setDownsampledAnalysis(null);
    setResampleRate(16000); // Reset effective resample rate
    setSliderValue(16000); // Reset slider display value
    setOriginalRate(0); // Reset original rate
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await apiService.detectDrone(file);
      setAnalysis(response.data);
      // Assuming original_rate is part of the initial analysis response
      if (response.data && response.data.original_rate) {
        setOriginalRate(response.data.original_rate);
      }
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
    // Only proceed if resampleRate is a valid positive number
    if (resampleRate <= 0) {
      console.warn("Invalid resampleRate for handleDownsample:", resampleRate);
      return;
    }

    setIsDownsampling(true);
    setError("");

    try {
      // Use the debounced `resampleRate` for the backend call
      const response = await apiService.downsampleAudio(file, resampleRate);
      
      let data;
      if (response && response.data) {
        data = response.data;
      } else if (response && typeof response === 'object') {
        data = response;
      } else {
        throw new Error("Invalid response structure");
      }

      // No need to set originalRate here, as it should be set by handleAnalyze
      if (!data.original_rate && data.original_rate !== 0) {
        console.warn("Original rate not provided in downsample response, assuming it's already known.");
      }
      
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
      const downsampledFile = new File([blob], `downsampled_${resampleRate}.wav`, { type: "audio/wav" });

      // Analyze the downsampled file
      const analysisResponse = await apiService.detectDrone(downsampledFile);
      setDownsampledAnalysis(analysisResponse.data);
    } catch (err) {
      console.error("Downsampled analysis error:", err);
      setError("Failed to analyze downsampled audio.");
    }
  };

  const toggleComparison = () => {
    if (!showComparison) { // If turning comparison ON
      // Set initial slider value and effective resample rate for the first comparison
      const initialRate = originalRate > 0 ? Math.min(16000, originalRate) : 16000;
      setSliderValue(initialRate);
      setResampleRate(initialRate); // This will trigger the downsampling via useEffect
    } else { // If turning comparison OFF
      setDownsampledAudio(null);
      setDownsampledAnalysis(null);
    }
    setShowComparison(!showComparison);
  };

  // EFFECT 1: Triggers `handleDownsample` when the debounced `resampleRate` changes
  //           or when comparison mode is toggled on (and a file is present).
  useEffect(() => {
    if (showComparison && file && resampleRate > 0) {
      handleDownsample();
    }
  }, [resampleRate, showComparison, file]); // Dependencies: resampleRate (debounced), showComparison, file

  // EFFECT 2: Debounces the slider input.
  //           It watches `sliderValue` and, after a delay, updates `resampleRate`.
  useEffect(() => {
    // Only debounce if comparison is active and a file is loaded
    if (!showComparison || !file) {
      return;
    }

    const handler = setTimeout(() => {
      // Only update `resampleRate` if it's different from the current `sliderValue`.
      // This prevents unnecessary API calls if the user moves the slider but
      // releases it at the same effective value.
      if (sliderValue !== resampleRate) {
        setResampleRate(sliderValue);
      }
    }, 500); // 500ms debounce time (adjust as needed)

    // Cleanup function: This runs if the component unmounts OR if `sliderValue` changes again
    // before the timeout fires. This clears the previous timeout.
    return () => {
      clearTimeout(handler);
    };
  }, [sliderValue, showComparison, file, resampleRate]); // Dependencies: `sliderValue` is the primary trigger.
                                                          // `showComparison`, `file`, `resampleRate` are for conditions
                                                          // and ensuring correct re-evaluation.

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
              disabled={isLoading || isDownsampling} // Disable if initial analysis or downsampling is ongoing
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
                  Resample Rate: <strong>{sliderValue} Hz</strong> {/* Display the immediate slider value */}
                </label>
                <input
                  type="range"
                  min="8000"
                  // Ensure max is never 0; use originalRate if available, otherwise a sensible default (e.g., 48000)
                  max={originalRate > 0 ? originalRate : 48000} 
                  step="1000"
                  value={sliderValue} // Slider controls the immediate `sliderValue` state
                  onChange={(e) => setSliderValue(Number(e.target.value))} // Update `sliderValue` on change
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
                <h3>Original Audio ({originalRate > 0 ? originalRate : 'N/A'} Hz)</h3>
                <DisplayAudio
                  analysis={analysis}
                  audioSrc={audioSrc}
                  setError={setError}
                />
              </div>

              <div className="comparison-side">
                <h3>Downsampled Audio ({resampleRate} Hz)</h3> {/* Display the effective `resampleRate` here */}
                {isDownsampling ? (
                  <div className="loading-spinner">Processing...</div>
                ) : downsampledAudio && downsampledAnalysis ? (
                  <>
                    {/* Removed: Prediction display for downsampled audio */}
                    {/*
                    <div className={`alert ${
                      downsampledAnalysis.prediction === "DRONE" ? "success" : "info"
                    }`}>
                      <h4>Prediction: {downsampledAnalysis.prediction}</h4>
                    </div>
                    */}
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