// import React, { useState } from "react";
// import { apiService } from "../../services/api";
// // import "./Human.css";
// import AudioUploader from "../../components/AudioUploader";
// import DisplayAudio from "../../components/DisplayAudio";

// const Human = () => {
//   const [file, setFile] = useState(null);
//   const [audioSrc, setAudioSrc] = useState(null);
//   const [analysis, setAnalysis] = useState(null);
//   const [error, setError] = useState("");
//   const [isLoading, setIsLoading] = useState(false);

//   //  Comparison
//   const [showComparison, setShowComparison] = useState(false);
//   const [resampleRate, setResampleRate] = useState(16000);

//   const handleFileSelected = (selectedFile) => {
//     setFile(selectedFile);
//     setAudioSrc(URL.createObjectURL(selectedFile));
//     setAnalysis(null);
//     setError("");
//     setShowComparison(false);
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
//       <h1 className="page-title">🚁 Human Audio Aliasing</h1>

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
//           {/* 🆕 Comparison Toggle Button */}
//           <div className="comparison-controls">
//             <button className="btn btn-secondary" onClick={toggleComparison}>
//               {showComparison ? "Hide Comparison" : "Show Comparison"}
//             </button>

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

// export default Human;
import React, { useState, useEffect } from "react";
import { apiService } from "../../services/api";
import "../../components/Audio.css";
import AudioUploader from "../../components/AudioUploader";
import DisplayAudio from "../../components/DisplayAudio";

const Human = () => {
  const [file, setFile] = useState(null);
  const [audioSrc, setAudioSrc] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Comparison state
  const [showComparison, setShowComparison] = useState(false);
  const [originalRate, setOriginalRate] = useState(0); // Stores the sample rate of the original uploaded audio

  // States for resampling logic
  const [resampleRate, setResampleRate] = useState(16000); // This is the 'effective' rate that triggers resampling
  const [sliderValue, setSliderValue] = useState(16000); // This is the rate displayed by the slider, updates immediately

  // Resampled audio state
  const [resampledAudio, setResampledAudio] = useState(null);
  const [resampledAnalysis, setResampledAnalysis] = useState(null);
  const [isResampling, setIsResampling] = useState(false);

  const handleFileSelected = (selectedFile) => {
    setFile(selectedFile);
    setAudioSrc(URL.createObjectURL(selectedFile));
    setAnalysis(null);
    setError("");
    setShowComparison(false);
    setResampledAudio(null);
    setResampledAnalysis(null);
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

  const handleResample = async () => {
    if (!file) {
      setError("Please upload an audio file first.");
      return;
    }
    // Only proceed if resampleRate is a valid positive number
    if (resampleRate <= 0) {
      console.warn("Invalid resampleRate for handleResample:", resampleRate);
      return;
    }

    setIsResampling(true);
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

      if (!data.original_rate && data.original_rate !== 0) {
        // The `original_rate` from this endpoint refers to the rate *before* downsampling by the backend.
        // If not already set from initial analysis, this would be a good place to grab it.
        // However, for clarity, we assume originalRate is set by handleAnalyze.
        console.warn("Original rate not provided in downsample response.");
      }

      // Store the audio data URI
      setResampledAudio(data.downsampled_audio);

      // Analyze the resampled audio
      await analyzeResampledAudio(data.downsampled_audio);

    } catch (err) {
      console.error("Resampling error:", err);
      const errorMessage = err.response?.data?.error 
        || err.message 
        || "Resampling failed.";
      setError(errorMessage);
    } finally {
      setIsResampling(false);
    }
  };

  const analyzeResampledAudio = async (audioDataUri) => {
    try {
      // Convert data URI to Blob
      const response = await fetch(audioDataUri);
      const blob = await response.blob();
      const resampledFile = new File([blob], `resampled_${resampleRate}.wav`, { type: "audio/wav" });

      // Analyze the resampled file
      const analysisResponse = await apiService.detectDrone(resampledFile);
      setResampledAnalysis(analysisResponse.data);
    } catch (err) {
      console.error("Resampled analysis error:", err);
      setError("Failed to analyze resampled audio.");
    }
  };

  const toggleComparison = () => {
    if (!showComparison) { // If turning comparison ON
      // Set initial slider value and effective resample rate for the first comparison
      const initialRate = originalRate > 0 ? Math.min(16000, originalRate) : 16000;
      setSliderValue(initialRate);
      setResampleRate(initialRate); // This will trigger the resampling via useEffect
    } else { // If turning comparison OFF
      setResampledAudio(null);
      setResampledAnalysis(null);
    }
    setShowComparison(!showComparison);
  };

  // EFFECT 1: Triggers `handleResample` when the debounced `resampleRate` changes
  //           or when comparison mode is toggled on (and a file is present).
  useEffect(() => {
    if (showComparison && file && resampleRate > 0) {
      handleResample();
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
      <h1 className="page-title">🚁 Human Audio Aliasing</h1>

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
          <div className="alert info">
            <h3>Original Audio</h3>
            {originalRate > 0 && <p>Sample Rate: {originalRate} Hz</p>}
          </div>

          {/* Comparison Toggle Button */}
          <div className="comparison-controls">
            <button 
              className="btn btn-secondary" 
              onClick={toggleComparison}
              disabled={isLoading || isResampling} // Disable if initial analysis or resampling is ongoing
            >
              {isResampling 
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
                  disabled={isResampling}
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
                <h3>Resampled Audio ({resampleRate} Hz)</h3> {/* Display the effective `resampleRate` here */}
                {isResampling ? (
                  <div className="loading-spinner">Processing...</div>
                ) : resampledAudio && resampledAnalysis ? (
                  <DisplayAudio
                    analysis={resampledAnalysis}
                    audioSrc={resampledAudio}
                    setError={setError}
                  />
                ) : (
                  <div className="alert info">
                    Adjust the sample rate slider to generate resampled audio
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

export default Human;