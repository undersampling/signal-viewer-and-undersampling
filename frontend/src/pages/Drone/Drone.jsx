// import React, { useState, useEffect, useRef } from "react";
// import Plot from "react-plotly.js";
// import { apiService } from "../../services/api"; // Corrected path
// import "./Drone.css"; // Corrected path

// const DroneDetectorPage = () => {
//   const [file, setFile] = useState(null);
//   const [audioSrc, setAudioSrc] = useState(null);
//   const [analysis, setAnalysis] = useState(null);
//   const [error, setError] = useState("");
//   const [isLoading, setIsLoading] = useState(false);

//   // State for scrolling animation
//   const [isPlaying, setIsPlaying] = useState(false);
//   const [position, setPosition] = useState(0);
//   const [waveform, setWaveform] = useState(null);
//   const intervalRef = useRef(null);

//   // --- New additions for Drag-and-Drop ---
//   const [isDragging, setIsDragging] = useState(false);
//   const fileInputRef = useRef(null); // Ref for the hidden file input

//   // Universal function to handle the selected file
//   const processFile = (selectedFile) => {
//     if (selectedFile && selectedFile.type.startsWith("audio/")) {
//       setFile(selectedFile);
//       setAudioSrc(URL.createObjectURL(selectedFile));
//       // Reset everything on new file selection
//       setAnalysis(null);
//       setWaveform(null);
//       setError("");
//       setIsPlaying(false);
//       setPosition(0);
//       if (intervalRef.current) clearInterval(intervalRef.current);
//     } else {
//       setError("Please select a valid audio file.");
//     }
//   };

//   const handleFileChange = (event) => {
//     processFile(event.target.files[0]);
//   };

//   // --- Drag-and-Drop Event Handlers ---
//   const handleDragEnter = (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     setIsDragging(true);
//   };

//   const handleDragLeave = (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     setIsDragging(false);
//   };

//   const handleDragOver = (e) => {
//     e.preventDefault();
//     e.stopPropagation(); // Necessary to allow drop
//   };

//   const handleDrop = (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     setIsDragging(false);
//     processFile(e.dataTransfer.files[0]);
//   };

//   // --- End of Drag-and-Drop additions ---

//   const handleAnalyze = async () => {
//     if (!file) return;
//     setIsLoading(true);
//     setError("");
//     try {
//       const response = await apiService.detectDrone(file);
//       setAnalysis(response.data);
//       setWaveform(response.data.initial_waveform);
//       setPosition(0);
//     } catch (err) {
//       setError(err.response?.data?.error || "Analysis failed.");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (isPlaying && analysis?.file_id) {
//       intervalRef.current = setInterval(async () => {
//         try {
//           const response = await apiService.getWaveformChunk(
//             analysis.file_id,
//             position
//           );
//           if (response.data.completed) {
//             setIsPlaying(false);
//           } else {
//             setWaveform({
//               time: response.data.time,
//               amplitude: response.data.amplitude,
//             });
//             setPosition(response.data.new_position);
//           }
//         } catch (err) {
//           setError("Failed to update waveform.");
//           setIsPlaying(false);
//         }
//       }, 100);
//     } else {
//       if (intervalRef.current) clearInterval(intervalRef.current);
//     }
//     return () => {
//       if (intervalRef.current) clearInterval(intervalRef.current);
//     };
//   }, [isPlaying, position, analysis]);

//   const handleStartPause = () => setIsPlaying(!isPlaying);
//   const handleRestart = () => {
//     setIsPlaying(false);
//     setPosition(0);
//     if (analysis) setWaveform(analysis.initial_waveform);
//   };

//   return (
//     <div className="drone-container">
//       <h1 className="page-title">🚁 Drone Sound Detector</h1>

//       {/* --- Updated Upload Section --- */}
//       <div className="upload-section">
//         <div
//           className={`upload-box ${isDragging ? "drag-active" : ""}`}
//           onClick={() => fileInputRef.current.click()}
//           onDragEnter={handleDragEnter}
//           onDragLeave={handleDragLeave}
//           onDragOver={handleDragOver}
//           onDrop={handleDrop}
//         >
//           <input
//             type="file"
//             accept="audio/*"
//             ref={fileInputRef}
//             onChange={handleFileChange}
//             style={{ display: "none" }}
//           />
//           <div className="upload-icon">🔊</div>
//           <div className="upload-text">
//             {file ? file.name : "Drag & Drop Audio File Here"}
//           </div>
//           <div className="upload-subtext">or click to select a file</div>
//         </div>

//         {file && (
//           <div className="analyze-button-container">
//             <button
//               className="btn"
//               onClick={handleAnalyze}
//               disabled={isLoading}
//             >
//               {isLoading ? "Analyzing..." : "Analyze Audio"}
//             </button>
//           </div>
//         )}
//       </div>

//       {error && <div className="alert error">{error}</div>}

//       {isLoading && (
//         <div className="loading-spinner">
//           <div className="spinner"></div>Analyzing...
//         </div>
//       )}

//       {analysis && (
//         <div className="results-section">
//           <div className="player-and-prediction">
//             {audioSrc && (
//               <audio controls src={audioSrc} style={{ width: "100%" }} />
//             )}
//             <div
//               className={`alert ${
//                 analysis.prediction === "DRONE" ? "success" : "info"
//               }`}
//             >
//               <h3>Prediction: {analysis.prediction}</h3>
//             </div>
//           </div>

//           <div className="controls">
//             <button
//               className="btn"
//               onClick={handleStartPause}
//               disabled={!analysis}
//             >
//               {isPlaying ? "Pause" : "Start / Resume"}
//             </button>
//             <button
//               className="btn"
//               onClick={handleRestart}
//               disabled={!analysis}
//             >
//               Restart
//             </button>
//           </div>

//           {waveform && (
//             <Plot
//               data={[
//                 {
//                   x: waveform.time,
//                   y: waveform.amplitude,
//                   type: "scatter",
//                   mode: "lines",
//                   marker: { color: "royalblue" },
//                 },
//               ]}
//               layout={{
//                 title: "Waveform (2-Second Window)",
//                 template: "plotly_white",
//                 margin: { l: 60, r: 20, t: 50, b: 60 },
//                 xaxis: {
//                   title: "Time (s)",
//                   range: [
//                     waveform.time[0],
//                     waveform.time[waveform.time.length - 1],
//                   ],
//                 },
//                 yaxis: { title: "Amplitude" },
//               }}
//               style={{ width: "100%", height: "400px" }}
//               config={{ responsive: true }}
//             />
//           )}

//           <Plot
//             data={[
//               {
//                 ...analysis.spectrogram,
//                 type: "heatmap",
//                 colorscale: "Viridis",
//               },
//             ]}
//             layout={{
//               title: "Spectrogram",
//               template: "plotly_white",
//               margin: { l: 60, r: 20, t: 50, b: 60 },
//               xaxis: { title: "Time (s)" },
//               yaxis: { title: "Frequency (Hz)", type: "log" },
//             }}
//             style={{ width: "100%", height: "400px" }}
//             config={{ responsive: true }}
//           />
//         </div>
//       )}
//     </div>
//   );
// };

// export default DroneDetectorPage;
// frontend/src/pages/DroneDetectorPage.jsx

import React, { useState, useEffect, useRef } from "react";
import Plot from "react-plotly.js";
import { apiService } from "../../services/api";
import "./Drone.css";

const DroneDetectorPage = () => {
  const [file, setFile] = useState(null);
  const [audioSrc, setAudioSrc] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [waveform, setWaveform] = useState(null);
  const intervalRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [sampleRate, setSampleRate] = useState(16000);
  const [isResampling, setIsResampling] = useState(false);
  const [resampledSpectrogram, setResampledSpectrogram] = useState(null);
  const [originalAudioSrc, setOriginalAudioSrc] = useState(null);

  const processFile = (selectedFile) => {
    if (selectedFile && selectedFile.type.startsWith("audio/")) {
      setFile(selectedFile);
      const objectUrl = URL.createObjectURL(selectedFile);
      setAudioSrc(objectUrl);
      setOriginalAudioSrc(objectUrl);
      setAnalysis(null);
      setWaveform(null);
      setError("");
      setIsPlaying(false);
      setPosition(0);
      setSampleRate(16000);
      setResampledSpectrogram(null);
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      setError("Please select a valid audio file.");
    }
  };

  const handleFileChange = (event) => processFile(event.target.files[0]);
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await apiService.detectDrone(file);
      setAnalysis(response.data);
      setWaveform(response.data.initial_waveform);
      setPosition(0);
    } catch (err) {
      setError(err.response?.data?.error || "Analysis failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResample = async (newSr) => {
    if (!analysis?.file_id) return;
    setIsResampling(true);
    setError("");
    try {
      const response = await apiService.resampleAudio(analysis.file_id, newSr);
      setAudioSrc(response.data.resampled_audio_src);
      setWaveform(response.data.waveform);
      setResampledSpectrogram(response.data.spectrogram);
      setIsPlaying(false);
    } catch (err) {
      setError(err.response?.data?.error || "Resampling failed.");
    } finally {
      setIsResampling(false);
    }
  };

  useEffect(() => {
    if (isPlaying && analysis?.file_id) {
      intervalRef.current = setInterval(async () => {
        try {
          const response = await apiService.getWaveformChunk(
            analysis.file_id,
            position
          );
          if (response.data.completed) {
            setIsPlaying(false);
          } else {
            setWaveform({
              time: response.data.time,
              amplitude: response.data.amplitude,
            });
            setPosition(response.data.new_position);
          }
        } catch (err) {
          setError("Failed to update waveform.");
          setIsPlaying(false);
        }
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, position, analysis]);

  const handleStartPause = () => setIsPlaying(!isPlaying);
  const handleRestart = () => {
    setIsPlaying(false);
    setPosition(0);
    if (analysis) setWaveform(analysis.initial_waveform);
  };

  return (
    <>
      <h1 className="page-title">🚁 Drone Sound Detector</h1>
      <div className="upload-section">
        <div
          className={`upload-box ${isDragging ? "drag-active" : ""}`}
          onClick={() => fileInputRef.current.click()}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept="audio/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <div className="upload-icon">🔊</div>
          <div className="upload-text">
            {file ? file.name : "Drag & Drop Audio File Here"}
          </div>
          <div className="upload-subtext">or click to select a file</div>
        </div>
        {file && (
          <div className="analyze-button-container">
            <button
              className="btn"
              onClick={handleAnalyze}
              disabled={isLoading}
            >
              {isLoading ? "Analyzing..." : "Analyze Audio"}
            </button>
          </div>
        )}
      </div>
      {error && <div className="alert error">{error}</div>}
      {isLoading && (
        <div className="loading-spinner">
          <div className="spinner"></div>Analyzing...
        </div>
      )}
      {analysis && (
        <div className="results-section">
          <div className="player-and-prediction">
            {audioSrc && (
              <audio
                key={audioSrc}
                controls
                src={audioSrc}
                style={{ width: "100%" }}
                autoPlay={isResampling}
              />
            )}
            <div
              className={`alert ${
                analysis.prediction === "DRONE" ? "success" : "info"
              }`}
            >
              <h3>Prediction: {analysis.prediction}</h3>
            </div>
          </div>
          <div className="resampling-section">
            <h4>Resample Audio</h4>
            <p>
              Listen to how the sound changes with different sample rates. Low
              rates can cause aliasing.
            </p>
            <div className="slider-container">
              <span>2000 Hz</span>
              <input
                type="range"
                min="2000"
                max="22050"
                step="50"
                value={sampleRate}
                className="slider"
                disabled={isResampling}
                onChange={(e) => setSampleRate(parseInt(e.target.value))}
                onMouseUp={(e) => handleResample(parseInt(e.target.value))}
                onKeyUp={(e) => handleResample(parseInt(e.target.value))}
              />
              <span>22050 Hz</span>
            </div>
            <div className="slider-value">
              Current Sample Rate: <strong>{sampleRate} Hz</strong>
              {isResampling && <div className="spinner-small"></div>}
            </div>
          </div>
          <div className="controls">
            <button
              className="btn"
              onClick={() => setAudioSrc(originalAudioSrc)}
            >
              Play Original
            </button>
            <button
              className="btn"
              onClick={handleStartPause}
              disabled={!analysis}
            >
              {isPlaying ? "Pause Scroll" : "Start Scroll"}
            </button>
            <button
              className="btn"
              onClick={handleRestart}
              disabled={!analysis}
            >
              Restart Scroll
            </button>
          </div>
          {waveform && (
            <Plot
              data={[
                {
                  x: waveform.time,
                  y: waveform.amplitude,
                  type: "scatter",
                  mode: "lines",
                  marker: { color: "royalblue" },
                },
              ]}
              layout={{
                title: "Waveform",
                template: "plotly_white",
                margin: { l: 60, r: 20, t: 50, b: 60 },
                xaxis: { title: "Time (s)" },
                yaxis: { title: "Amplitude" },
              }}
              style={{ width: "100%", height: "400px" }}
              config={{ responsive: true }}
            />
          )}
          <Plot
            data={[
              {
                ...(resampledSpectrogram || analysis.spectrogram),
                type: "heatmap",
                colorscale: "Viridis",
              },
            ]}
            layout={{
              title: "Spectrogram",
              template: "plotly_white",
              margin: { l: 60, r: 20, t: 50, b: 60 },
              xaxis: { title: "Time (s)" },
              yaxis: { title: "Frequency (Hz)", type: "log" },
            }}
            style={{ width: "100%", height: "400px" }}
            config={{ responsive: true }}
          />
        </div>
      )}
    </>
  );
};

export default DroneDetectorPage;
