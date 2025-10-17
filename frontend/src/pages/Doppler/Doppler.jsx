// import React, { useMemo, useState, useEffect, useCallback } from "react";
// import { apiService } from "../../services/api";
// import Plot from "react-plotly.js";
// import DisplayAudio from "../../components/DisplayAudio";
// import "./Doppler.css";

// const Doppler = () => {
//   const [uploadSrc, setUploadSrc] = useState(null);
//   const [storeOriginal, setStoreOriginal] = useState(null);
//   const [waveformOriginal, setWaveformOriginal] = useState(null);

//   const [passingSrc, setPassingSrc] = useState(null);
//   const [passingWaveform, setPassingWaveform] = useState(null);
//   const [passingFreq, setPassingFreq] = useState("");
//   const [vStart, setVStart] = useState(0.0);
//   const [vEnd, setVEnd] = useState(20.0);
//   const [fSource, setFSource] = useState(440);

//   const [dopplerSrc, setDopplerSrc] = useState(null);
//   const [dopplerWaveform, setDopplerWaveform] = useState(null);
//   const [dopplerStatus, setDopplerStatus] = useState("");
//   const [observedText, setObservedText] = useState("");

//   const [prediction, setPrediction] = useState(null);
//   const [predError, setPredError] = useState("");
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);

//   // For DisplayAudio component
//   const [originalAnalysis, setOriginalAnalysis] = useState(null);
//   const [dopplerAnalysis, setDopplerAnalysis] = useState(null);

//   // Comparison state
//   const [showComparison, setShowComparison] = useState(false);

//   // States for downsampling with debounce
//   const [dopplerOriginalRate, setDopplerOriginalRate] = useState(0);
//   const [resampleRate, setResampleRate] = useState(16000);
//   const [sliderValue, setSliderValue] = useState(16000);
//   const [dopplerDownsampledAudio, setDopplerDownsampledAudio] = useState(null);
//   const [dopplerDownsampledAnalysis, setDopplerDownsampledAnalysis] =
//     useState(null);
//   const [isDopplerDownsampling, setIsDopplerDownsampling] = useState(false);

//   const plotFromWaveform = useMemo(() => {
//     return (wf) => {
//       if (!wf) return { data: [], layout: { height: 300 } };
//       const preview = wf.preview || { t: [], y: [] };
//       const window = wf.window || { t: [], y: [], range: [0, 1] };
//       return {
//         data: [
//           {
//             x: preview.t,
//             y: preview.y,
//             mode: "lines",
//             name: "Full Signal",
//             opacity: 0.3,
//           },
//           { x: window.t, y: window.y, mode: "lines", name: "Zoomed View" },
//         ],
//         layout: {
//           height: 300,
//           margin: { l: 40, r: 10, t: 30, b: 40 },
//           xaxis: { title: "Time (s)", range: window.range },
//           yaxis: { title: "Amplitude", range: [-1.05, 1.05] },
//         },
//       };
//     };
//   }, []);

//   // Helper to convert Data URI to Blob
//   const dataURItoBlob = useCallback((dataURI) => {
//     if (!dataURI || !dataURI.includes(",")) {
//       console.error("Invalid dataURI provided");
//       return new Blob([]);
//     }
//     const byteString = atob(dataURI.split(",")[1]);
//     const mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];
//     const ab = new ArrayBuffer(byteString.length);
//     const ia = new Uint8Array(ab);
//     for (let i = 0; i < byteString.length; i++) {
//       ia[i] = byteString.charCodeAt(i);
//     }
//     return new Blob([ab], { type: mimeString });
//   }, []);

//   const onUpload = async (e) => {
//     const file = e.target.files?.[0];
//     if (!file) return;
//     const reader = new FileReader();
//     reader.onload = async () => {
//       const contents = reader.result;
//       setUploadSrc(contents);
//       try {
//         setLoading(true);
//         const { data } = await apiService.dopplerUpload(contents);
//         setStoreOriginal(data.store);
//         setWaveformOriginal(data.waveform);

//         // Also set analysis for DisplayAudio
//         const analysisData = {
//           initial_waveform: data.waveform,
//           freq_time_data: data.freq_time_data || null,
//           spectrogram: data.spectrogram || null,
//           file_id: data.file_id || null,
//         };
//         delete analysisData.prediction;
//         setOriginalAnalysis(analysisData);

//         // Reset states
//         setDopplerSrc(null);
//         setDopplerWaveform(null);
//         setDopplerAnalysis(null);
//         setDopplerOriginalRate(0);
//         setDopplerDownsampledAudio(null);
//         setDopplerDownsampledAnalysis(null);
//         setShowComparison(false);
//         setResampleRate(16000);
//         setSliderValue(16000);
//         setPrediction(null);
//         setPredError("");
//       } catch (err) {
//         console.error(err);
//         setError("Upload failed");
//       } finally {
//         setLoading(false);
//       }
//     };
//     reader.readAsDataURL(file);
//   };

//   const onSimulate = async () => {
//     if (!uploadSrc) return;
//     try {
//       setLoading(true);
//       const { data } = await apiService.dopplerSimulate({
//         dataUri: uploadSrc,
//         vStart,
//         vEnd,
//         fSource,
//       });
//       setPassingSrc(data.src);
//       setPassingWaveform(data.waveform);
//       setPassingFreq(data.frequencies || "");
//     } catch (e) {
//       console.error(e);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const onGenerate = async () => {
//     if (!uploadSrc) return;
//     try {
//       setLoading(true);
//       const { data } = await apiService.dopplerGenerate({
//         dataUri: uploadSrc,
//         vStart,
//         vEnd,
//         fSource,
//       });

//       setDopplerSrc(data.src);
//       setDopplerStatus(data.status || "");
//       setObservedText(data.observed || "");

//       // Set analysis for DisplayAudio - data now comes directly from backend
//       const dopplerAnalysisData = {
//         initial_waveform: data.initial_waveform || { time: [], amplitude: [] },
//         spectrogram: data.spectrogram || null,
//         file_id: data.file_id || null,
//       };

//       setDopplerAnalysis(dopplerAnalysisData);

//       // Also keep the old waveform format for the simple plot
//       if (
//         data.initial_waveform &&
//         data.initial_waveform.time &&
//         data.initial_waveform.amplitude
//       ) {
//         const timeArray = data.initial_waveform.time;
//         const ampArray = data.initial_waveform.amplitude;
//         setDopplerWaveform({
//           preview: {
//             t: timeArray,
//             y: ampArray,
//           },
//           window: {
//             t: timeArray,
//             y: ampArray,
//             range: [
//               0,
//               timeArray.length > 0 ? timeArray[timeArray.length - 1] : 1,
//             ],
//           },
//         });
//       }

//       // Capture original sample rate
//       const detectedRate = data.initial_waveform?.sr || 48000;
//       setDopplerOriginalRate(detectedRate);

//       // Reset downsampling states
//       setDopplerDownsampledAudio(null);
//       setDopplerDownsampledAnalysis(null);
//       setResampleRate(16000);
//       setSliderValue(16000);
//     } catch (e) {
//       console.error(e);
//       setError("Generation failed");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const onPredict = async () => {
//     if (!uploadSrc) return;
//     try {
//       setLoading(true);
//       setPredError("");
//       const { data } = await apiService.dopplerPredict(uploadSrc);
//       setPrediction(data);
//     } catch (e) {
//       console.error(e);
//       setPrediction(null);
//       const msg = e.response?.data?.error || "Prediction failed.";
//       setPredError(msg);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const analyzeDopplerDownsampledAudio = useCallback(
//     async (audioDataUri) => {
//       try {
//         const response = await fetch(audioDataUri);
//         const blob = await response.blob();
//         const downsampledFile = new File(
//           [blob],
//           `downsampled_doppler_${resampleRate}.wav`,
//           { type: "audio/wav" }
//         );

//         const analysisResponse = await apiService.detectDrone(downsampledFile);
//         const dataWithoutPrediction = { ...analysisResponse.data };
//         delete dataWithoutPrediction.prediction;

//         setDopplerDownsampledAnalysis(dataWithoutPrediction);
//       } catch (err) {
//         console.error("Downsampled Doppler analysis error:", err);
//         setError("Failed to analyze downsampled Doppler audio.");
//       }
//     },
//     [resampleRate]
//   );

//   const handleDopplerDownsample = useCallback(async () => {
//     if (!dopplerSrc) {
//       setError("Generate Doppler audio first.");
//       setIsDopplerDownsampling(false);
//       return;
//     }
//     if (resampleRate <= 0) {
//       console.warn("Invalid resampleRate:", resampleRate);
//       setIsDopplerDownsampling(false);
//       return;
//     }

//     setIsDopplerDownsampling(true);
//     setError("");

//     try {
//       const audioBlob = dataURItoBlob(dopplerSrc);
//       const dopplerFile = new File([audioBlob], "doppler_audio.wav", {
//         type: audioBlob.type,
//       });

//       const response = await apiService.downsampleAudio(
//         dopplerFile,
//         resampleRate
//       );

//       let data;
//       if (response && response.data) {
//         data = response.data;
//       } else if (response && typeof response === "object") {
//         data = response;
//       } else {
//         throw new Error("Invalid response structure");
//       }

//       if (dopplerOriginalRate === 0 && data.original_rate) {
//         setDopplerOriginalRate(data.original_rate);
//       }

//       setDopplerDownsampledAudio(data.downsampled_audio);
//       await analyzeDopplerDownsampledAudio(data.downsampled_audio);
//     } catch (err) {
//       console.error("Doppler downsampling error:", err);
//       const errorMessage =
//         err.response?.data?.error ||
//         err.message ||
//         "Doppler downsampling failed.";
//       setError(errorMessage);
//       setDopplerDownsampledAudio(null);
//       setDopplerDownsampledAnalysis(null);
//     } finally {
//       setIsDopplerDownsampling(false);
//     }
//   }, [
//     dopplerSrc,
//     resampleRate,
//     dopplerOriginalRate,
//     dataURItoBlob,
//     analyzeDopplerDownsampledAudio,
//   ]);

//   const toggleComparison = () => {
//     if (!dopplerSrc) {
//       setError("Please generate Doppler audio first.");
//       return;
//     }

//     setShowComparison((prev) => {
//       const newShowComparison = !prev;
//       if (newShowComparison) {
//         const initialRate =
//           dopplerOriginalRate > 0
//             ? Math.min(16000, dopplerOriginalRate)
//             : 16000;
//         setSliderValue(initialRate);
//         setResampleRate(initialRate);
//       } else {
//         setDopplerDownsampledAudio(null);
//         setDopplerDownsampledAnalysis(null);
//       }
//       return newShowComparison;
//     });
//   };

//   // EFFECT 1: Trigger downsample when resampleRate changes
//   useEffect(() => {
//     if (showComparison && dopplerSrc && resampleRate > 0) {
//       handleDopplerDownsample();
//     }
//   }, [resampleRate, showComparison, dopplerSrc, handleDopplerDownsample]);

//   // EFFECT 2: Debounce slider input
//   useEffect(() => {
//     if (!showComparison || !dopplerSrc) {
//       return;
//     }

//     const handler = setTimeout(() => {
//       if (sliderValue !== resampleRate) {
//         setResampleRate(sliderValue);
//       }
//     }, 500);

//     return () => {
//       clearTimeout(handler);
//     };
//   }, [sliderValue, showComparison, dopplerSrc, resampleRate]);

//   return (
//     <div className="doppler-page" style={{ padding: 16 }}>
//       <h2 style={{ textAlign: "center", margin: "16px 0" }}>
//         Doppler Effect Audio Simulator & Analyzer
//       </h2>

//       <div
//         className="card doppler-card"
//         style={{ padding: 16, marginBottom: 16 }}
//       >
//         <div className="upload-section">
//           <div
//             className="drop-zone"
//             onClick={() =>
//               document.getElementById("doppler-file-input").click()
//             }
//           >
//             <input
//               id="doppler-file-input"
//               type="file"
//               accept="audio/wav"
//               onChange={onUpload}
//               style={{ display: "none" }}
//             />
//             <div className="upload-prompt">
//               <p>🎵 Drag & drop WAV file here or click to browse</p>
//             </div>
//           </div>
//         </div>
//         <div
//           className="grid"
//           style={{
//             display: "grid",
//             gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
//             gap: 12,
//           }}
//         >
//           <div className="field">
//             <label>Start speed v_i (m/s):</label>
//             <input
//               className="input"
//               type="number"
//               value={vStart}
//               onChange={(e) => setVStart(parseFloat(e.target.value))}
//             />
//           </div>
//           <div className="field">
//             <label>End speed v_f (m/s):</label>
//             <input
//               className="input"
//               type="number"
//               value={vEnd}
//               onChange={(e) => setVEnd(parseFloat(e.target.value))}
//             />
//           </div>
//           <div className="field">
//             <label>Source frequency (Hz):</label>
//             <input
//               className="input"
//               type="number"
//               value={fSource}
//               onChange={(e) => setFSource(parseFloat(e.target.value))}
//             />
//           </div>
//           <div className="actions" style={{ alignSelf: "flex-end" }}>
//             <button className="btn primary" onClick={onGenerate}>
//               Apply Doppler (full length)
//             </button>
//           </div>
//         </div>
//         <div
//           className="toolbar"
//           style={{
//             marginTop: 8,
//             display: "flex",
//             gap: 12,
//             alignItems: "center",
//           }}
//         >
//           <button className="btn success" onClick={onSimulate}>
//             Simulate Car Passing By
//           </button>
//           <div className="status success" style={{ fontWeight: 600 }}>
//             {dopplerStatus}
//           </div>
//         </div>
//         <div style={{ marginTop: 8, color: "#6c757d" }}>
//           Note: Enter speeds in m/s. Negative speeds correspond to motion TOWARD
//           the observer (approaching), positive speeds correspond to motion AWAY
//           (receding).
//         </div>
//       </div>

//       <div className="card" style={{ padding: 16, marginBottom: 16 }}>
//         <h4 style={{ margin: 0 }}>AI Prediction</h4>
//         <div
//           style={{
//             display: "flex",
//             gap: 12,
//             alignItems: "center",
//             marginTop: 8,
//             flexWrap: "wrap",
//           }}
//         >
//           <button onClick={onPredict}>
//             Predict Speed & Frequency from Uploaded File
//           </button>
//           <div>
//             {prediction && (
//               <div
//                 style={{
//                   border: "1px solid #0d6efd",
//                   padding: 12,
//                   borderRadius: 6,
//                   color: "#0d6efd",
//                 }}
//               >
//                 <div style={{ fontWeight: 700 }}>Prediction Results:</div>
//                 <div>
//                   Predicted Start Speed:{" "}
//                   {prediction.predicted_start_speed?.toFixed(2)} m/s (
//                   {((prediction.predicted_start_speed || 0) * 3.6).toFixed(2)}{" "}
//                   km/h)
//                 </div>
//                 <div>
//                   Predicted End Speed:{" "}
//                   {prediction.predicted_end_speed?.toFixed(2)} m/s (
//                   {((prediction.predicted_end_speed || 0) * 3.6).toFixed(2)}{" "}
//                   km/h)
//                 </div>
//                 <div>
//                   Predicted Source Frequency:{" "}
//                   {prediction.predicted_source_frequency?.toFixed(2)} Hz
//                 </div>
//               </div>
//             )}
//             {predError && (
//               <div
//                 style={{
//                   border: "1px solid #dc3545",
//                   padding: 12,
//                   borderRadius: 6,
//                   color: "#dc3545",
//                 }}
//               >
//                 {predError}
//               </div>
//             )}
//           </div>
//         </div>
//       </div>

//       {error && <div className="alert error">{error}</div>}

//       {/* Original Display Panels with Plot */}
//       <div className="panel" style={{ marginBottom: 16 }}>
//         <h4>Original Signal</h4>
//         <button
//           className="btn"
//           onClick={() => {
//             const a = document.getElementById("audio-original");
//             if (a) {
//               a.pause();
//               a.currentTime = 0;
//               a.play();
//             }
//           }}
//         >
//           Play Original
//         </button>
//         <audio
//           id="audio-original"
//           controls={false}
//           src={uploadSrc || undefined}
//         />
//         <Plot {...plotFromWaveform(waveformOriginal)} />
//       </div>

//       <div className="panel" style={{ marginBottom: 16 }}>
//         <h4>Doppler-Shifted (full length)</h4>
//         <div style={{ color: "#0d6efd" }}>{observedText}</div>
//         <button
//           className="btn"
//           onClick={() => {
//             const a = document.getElementById("audio-doppler");
//             if (a) {
//               a.pause();
//               a.currentTime = 0;
//               a.play();
//             }
//           }}
//         >
//           Play Doppler
//         </button>
//         <audio
//           id="audio-doppler"
//           controls={false}
//           src={dopplerSrc || undefined}
//         />
//         <Plot {...plotFromWaveform(dopplerWaveform)} />
//       </div>

//       {/* Comparison Section with DisplayAudio */}
//       {dopplerAnalysis && (
//         <div className="results-container">
//           {/* Comparison Toggle Button */}
//           <div className="comparison-controls">
//             <button
//               className="btn btn-secondary"
//               onClick={toggleComparison}
//               disabled={isDopplerDownsampling || loading}
//             >
//               {isDopplerDownsampling
//                 ? "Processing..."
//                 : showComparison
//                 ? "Hide Comparison"
//                 : "Show Comparison"}
//             </button>

//             {showComparison && (
//               <div className="resample-control">
//                 <label>
//                   Sample Rate: <strong>{sliderValue} Hz</strong>
//                 </label>
//                 <input
//                   type="range"
//                   min="8000"
//                   max={dopplerOriginalRate > 0 ? dopplerOriginalRate : 48000}
//                   step="1000"
//                   value={sliderValue}
//                   onChange={(e) => setSliderValue(Number(e.target.value))}
//                   disabled={isDopplerDownsampling}
//                 />
//               </div>
//             )}
//           </div>
//           {!showComparison ? (
//             <>
//               <h3>Doppler-Shifted Audio (Detailed View)</h3>
//               <DisplayAudio
//                 analysis={dopplerAnalysis}
//                 audioSrc={dopplerSrc}
//                 setError={setError}
//               />
//             </>
//           ) : (
//             // Side-by-side comparison
//             <div className="comparison-container">
//               <div className="comparison-side">
//                 <h3>
//                   Doppler Audio (
//                   {dopplerOriginalRate > 0 ? dopplerOriginalRate : "N/A"} Hz)
//                 </h3>
//                 <DisplayAudio
//                   analysis={dopplerAnalysis}
//                   audioSrc={dopplerSrc}
//                   setError={setError}
//                 />
//               </div>

//               <div className="comparison-side">
//                 <h3>Resampled Doppler Audio ({resampleRate} Hz)</h3>
//                 {isDopplerDownsampling ? (
//                   <div className="loading-spinner">Processing...</div>
//                 ) : dopplerDownsampledAudio && dopplerDownsampledAnalysis ? (
//                   <DisplayAudio
//                     analysis={dopplerDownsampledAnalysis}
//                     audioSrc={dopplerDownsampledAudio}
//                     setError={setError}
//                   />
//                 ) : (
//                   <div className="alert info">
//                     Adjust the sample rate slider to generate downsampled audio
//                   </div>
//                 )}
//               </div>
//             </div>
//           )}
//         </div>
//       )}

//       {loading && <div>Loading...</div>}
//     </div>
//   );
// };

// export default Doppler;
import React, { useMemo, useState, useEffect, useCallback } from "react";
import { apiService } from "../../services/api";
import Plot from "react-plotly.js";
import DisplayAudio from "../../components/DisplayAudio";
import AudioUploader from "../../components/AudioUploader";
import "./Doppler.css";

const Doppler = () => {
  const [uploadSrc, setUploadSrc] = useState(null);
  const [storeOriginal, setStoreOriginal] = useState(null);
  const [waveformOriginal, setWaveformOriginal] = useState(null);

  const [passingSrc, setPassingSrc] = useState(null);
  const [passingWaveform, setPassingWaveform] = useState(null);
  const [passingFreq, setPassingFreq] = useState("");
  const [vStart, setVStart] = useState(0.0);
  const [vEnd, setVEnd] = useState(20.0);
  const [fSource, setFSource] = useState(440);

  const [dopplerSrc, setDopplerSrc] = useState(null);
  const [dopplerWaveform, setDopplerWaveform] = useState(null);
  const [dopplerStatus, setDopplerStatus] = useState("");
  const [observedText, setObservedText] = useState("");

  const [prediction, setPrediction] = useState(null);
  const [predError, setPredError] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // For DisplayAudio component
  const [originalAnalysis, setOriginalAnalysis] = useState(null);
  const [dopplerAnalysis, setDopplerAnalysis] = useState(null);

  // Comparison state
  const [showComparison, setShowComparison] = useState(false);

  // States for downsampling with debounce
  const [dopplerOriginalRate, setDopplerOriginalRate] = useState(0);
  const [resampleRate, setResampleRate] = useState(16000);
  const [sliderValue, setSliderValue] = useState(16000);
  const [dopplerDownsampledAudio, setDopplerDownsampledAudio] = useState(null);
  const [dopplerDownsampledAnalysis, setDopplerDownsampledAnalysis] =
    useState(null);
  const [isDopplerDownsampling, setIsDopplerDownsampling] = useState(false);

  const plotFromWaveform = useMemo(() => {
    return (wf) => {
      if (!wf) return { data: [], layout: { height: 300 } };
      const preview = wf.preview || { t: [], y: [] };
      const window = wf.window || { t: [], y: [], range: [0, 1] };
      return {
        data: [
          {
            x: preview.t,
            y: preview.y,
            mode: "lines",
            name: "Full Signal",
            opacity: 0.3,
          },
          { x: window.t, y: window.y, mode: "lines", name: "Zoomed View" },
        ],
        layout: {
          height: 300,
          margin: { l: 40, r: 10, t: 30, b: 40 },
          xaxis: { title: "Time (s)", range: window.range },
          yaxis: { title: "Amplitude", range: [-1.05, 1.05] },
        },
      };
    };
  }, []);

  // Helper to convert Data URI to Blob
  const dataURItoBlob = useCallback((dataURI) => {
    if (!dataURI || !dataURI.includes(",")) {
      console.error("Invalid dataURI provided");
      return new Blob([]);
    }
    const byteString = atob(dataURI.split(",")[1]);
    const mimeString = dataURI.split(",")[0].split(":")[1].split(";")[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  }, []);

  // Handle file selection from AudioUploader
  const handleFileSelect = useCallback(async (file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const contents = reader.result;
      setUploadSrc(contents);

      try {
        setLoading(true);
        const { data } = await apiService.dopplerUpload(contents);
        setStoreOriginal(data.store);
        setWaveformOriginal(data.waveform);

        // Reset all states
        setDopplerSrc(null);
        setDopplerWaveform(null);
        setDopplerAnalysis(null);
        setDopplerOriginalRate(0);
        setDopplerDownsampledAudio(null);
        setDopplerDownsampledAnalysis(null);
        setShowComparison(false);
        setResampleRate(16000);
        setSliderValue(16000);
        setPrediction(null);
        setPredError("");
      } catch (err) {
        console.error(err);
        setError("Upload failed");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const onSimulate = async () => {
    if (!uploadSrc) return;
    try {
      setLoading(true);
      const { data } = await apiService.dopplerSimulate({
        dataUri: uploadSrc,
        vStart,
        vEnd,
        fSource,
      });
      setPassingSrc(data.src);
      setPassingWaveform(data.waveform);
      setPassingFreq(data.frequencies || "");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const onGenerate = async () => {
    if (!uploadSrc) return;
    try {
      setLoading(true);
      const { data } = await apiService.dopplerGenerate({
        dataUri: uploadSrc,
        vStart,
        vEnd,
        fSource,
      });

      setDopplerSrc(data.src);
      setDopplerStatus(data.status || "");
      setObservedText(data.observed || "");

      // Set analysis for DisplayAudio
      const dopplerAnalysisData = {
        initial_waveform: data.initial_waveform || { time: [], amplitude: [] },
        spectrogram: data.spectrogram || null,
        file_id: data.file_id || null,
      };

      setDopplerAnalysis(dopplerAnalysisData);

      // Also keep the old waveform format for the simple plot
      if (data.initial_waveform?.time && data.initial_waveform?.amplitude) {
        const timeArray = data.initial_waveform.time;
        const ampArray = data.initial_waveform.amplitude;
        setDopplerWaveform({
          preview: { t: timeArray, y: ampArray },
          window: {
            t: timeArray,
            y: ampArray,
            range: [
              0,
              timeArray.length > 0 ? timeArray[timeArray.length - 1] : 1,
            ],
          },
        });
      }

      // Capture original sample rate
      const detectedRate = data.initial_waveform?.sr || 48000;
      setDopplerOriginalRate(detectedRate);

      // Reset downsampling states
      setDopplerDownsampledAudio(null);
      setDopplerDownsampledAnalysis(null);
      setResampleRate(16000);
      setSliderValue(16000);
    } catch (e) {
      console.error(e);
      setError("Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const onPredict = async () => {
    if (!uploadSrc) return;
    try {
      setLoading(true);
      setPredError("");
      const { data } = await apiService.dopplerPredict(uploadSrc);
      setPrediction(data);
    } catch (e) {
      console.error(e);
      setPrediction(null);
      const msg = e.response?.data?.error || "Prediction failed.";
      setPredError(msg);
    } finally {
      setLoading(false);
    }
  };

  const analyzeDopplerDownsampledAudio = useCallback(
    async (audioDataUri) => {
      try {
        const response = await fetch(audioDataUri);
        const blob = await response.blob();
        const downsampledFile = new File(
          [blob],
          `downsampled_doppler_${resampleRate}.wav`,
          { type: "audio/wav" }
        );

        const analysisResponse = await apiService.detectDrone(downsampledFile);
        const dataWithoutPrediction = { ...analysisResponse.data };
        delete dataWithoutPrediction.prediction;

        setDopplerDownsampledAnalysis(dataWithoutPrediction);
      } catch (err) {
        console.error("Downsampled Doppler analysis error:", err);
        setError("Failed to analyze downsampled Doppler audio.");
      }
    },
    [resampleRate]
  );

  const handleDopplerDownsample = useCallback(async () => {
    if (!dopplerSrc) {
      setError("Generate Doppler audio first.");
      setIsDopplerDownsampling(false);
      return;
    }
    if (resampleRate <= 0) {
      console.warn("Invalid resampleRate:", resampleRate);
      setIsDopplerDownsampling(false);
      return;
    }

    setIsDopplerDownsampling(true);
    setError("");

    try {
      const audioBlob = dataURItoBlob(dopplerSrc);
      const dopplerFile = new File([audioBlob], "doppler_audio.wav", {
        type: audioBlob.type,
      });

      const response = await apiService.downsampleAudio(
        dopplerFile,
        resampleRate
      );

      let data;
      if (response && response.data) {
        data = response.data;
      } else if (response && typeof response === "object") {
        data = response;
      } else {
        throw new Error("Invalid response structure");
      }

      if (dopplerOriginalRate === 0 && data.original_rate) {
        setDopplerOriginalRate(data.original_rate);
      }

      setDopplerDownsampledAudio(data.downsampled_audio);
      await analyzeDopplerDownsampledAudio(data.downsampled_audio);
    } catch (err) {
      console.error("Doppler downsampling error:", err);
      const errorMessage =
        err.response?.data?.error ||
        err.message ||
        "Doppler downsampling failed.";
      setError(errorMessage);
      setDopplerDownsampledAudio(null);
      setDopplerDownsampledAnalysis(null);
    } finally {
      setIsDopplerDownsampling(false);
    }
  }, [
    dopplerSrc,
    resampleRate,
    dopplerOriginalRate,
    dataURItoBlob,
    analyzeDopplerDownsampledAudio,
  ]);

  const toggleComparison = () => {
    if (!dopplerSrc) {
      setError("Please generate Doppler audio first.");
      return;
    }

    setShowComparison((prev) => {
      const newShowComparison = !prev;
      if (newShowComparison) {
        const initialRate =
          dopplerOriginalRate > 0
            ? Math.min(16000, dopplerOriginalRate)
            : 16000;
        setSliderValue(initialRate);
        setResampleRate(initialRate);
      } else {
        setDopplerDownsampledAudio(null);
        setDopplerDownsampledAnalysis(null);
      }
      return newShowComparison;
    });
  };

  // EFFECT 1: Trigger downsample when resampleRate changes
  useEffect(() => {
    if (showComparison && dopplerSrc && resampleRate > 0) {
      handleDopplerDownsample();
    }
  }, [resampleRate, showComparison, dopplerSrc, handleDopplerDownsample]);

  // EFFECT 2: Debounce slider input
  useEffect(() => {
    if (!showComparison || !dopplerSrc) {
      return;
    }

    const handler = setTimeout(() => {
      if (sliderValue !== resampleRate) {
        setResampleRate(sliderValue);
      }
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [sliderValue, showComparison, dopplerSrc, resampleRate]);

  return (
    <div className="doppler-page" style={{ padding: 16 }}>
      <h2 style={{ textAlign: "center", margin: "16px 0" }}>
        Doppler Effect Audio Simulator & Analyzer
      </h2>
      <div className="page-container">
        <div
          className="card doppler-card"
          style={{ padding: 16, marginBottom: 16 }}
        >
          {/* Use generalized AudioUploader with parameter inputs as children */}
          <AudioUploader
            onFileSelect={handleFileSelect}
            isLoading={loading}
            // acceptedFormats="audio/wav"
            showAnalyzeButton={false}
          >
            {/* Parameter inputs rendered as children */}
            <div
              className="grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
                marginTop: 16,
              }}
            >
              <div className="field">
                <label>Start speed v_i (m/s):</label>
                <input
                  className="input"
                  type="number"
                  value={vStart}
                  onChange={(e) => setVStart(parseFloat(e.target.value))}
                />
              </div>
              <div className="field">
                <label>End speed v_f (m/s):</label>
                <input
                  className="input"
                  type="number"
                  value={vEnd}
                  onChange={(e) => setVEnd(parseFloat(e.target.value))}
                />
              </div>
              <div className="field">
                <label>Source frequency (Hz):</label>
                <input
                  className="input"
                  type="number"
                  value={fSource}
                  onChange={(e) => setFSource(parseFloat(e.target.value))}
                />
              </div>
              <div className="actions" style={{ alignSelf: "flex-end" }}>
                <button
                  className="btn primary"
                  onClick={onGenerate}
                  disabled={!uploadSrc || loading}
                >
                  Apply Doppler (full length)
                </button>
              </div>
            </div>

            <div
              className="toolbar"
              style={{
                marginTop: 8,
                display: "flex",
                gap: 12,
                alignItems: "center",
              }}
            >
              <button
                className="btn success"
                onClick={onSimulate}
                disabled={!uploadSrc || loading}
              >
                Simulate Car Passing By
              </button>
              <div className="status success" style={{ fontWeight: 600 }}>
                {dopplerStatus}
              </div>
            </div>

            <div style={{ marginTop: 8, color: "#6c757d" }}>
              Note: Enter speeds in m/s. Negative speeds correspond to motion
              TOWARD the observer (approaching), positive speeds correspond to
              motion AWAY (receding).
            </div>
          </AudioUploader>
        </div>

        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
          <h4 style={{ margin: 0 }}>AI Prediction</h4>
          <div
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              marginTop: 8,
              flexWrap: "wrap",
            }}
          >
            <button onClick={onPredict} disabled={!uploadSrc || loading}>
              Predict Speed & Frequency from Uploaded File
            </button>
            <div>
              {prediction && (
                <div
                  style={{
                    border: "1px solid #0d6efd",
                    padding: 12,
                    borderRadius: 6,
                    color: "#0d6efd",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>Prediction Results:</div>
                  <div>
                    Predicted Start Speed:{" "}
                    {prediction.predicted_start_speed?.toFixed(2)} m/s (
                    {((prediction.predicted_start_speed || 0) * 3.6).toFixed(2)}{" "}
                    km/h)
                  </div>
                  <div>
                    Predicted End Speed:{" "}
                    {prediction.predicted_end_speed?.toFixed(2)} m/s (
                    {((prediction.predicted_end_speed || 0) * 3.6).toFixed(2)}{" "}
                    km/h)
                  </div>
                  <div>
                    Predicted Source Frequency:{" "}
                    {prediction.predicted_source_frequency?.toFixed(2)} Hz
                  </div>
                </div>
              )}
              {predError && (
                <div
                  style={{
                    border: "1px solid #dc3545",
                    padding: 12,
                    borderRadius: 6,
                    color: "#dc3545",
                  }}
                >
                  {predError}
                </div>
              )}
            </div>
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}

        {/* Original Display Panels with Plot */}
        <div className="panel" style={{ marginBottom: 16 }}>
          <h4>Original Signal</h4>
          <button
            className="btn"
            onClick={() => {
              const a = document.getElementById("audio-original");
              if (a) {
                a.pause();
                a.currentTime = 0;
                a.play();
              }
            }}
          >
            Play Original
          </button>
          <audio
            id="audio-original"
            controls={false}
            src={uploadSrc || undefined}
          />
          <Plot {...plotFromWaveform(waveformOriginal)} />
        </div>

        <div className="panel" style={{ marginBottom: 16 }}>
          <h4>Doppler-Shifted (full length)</h4>
          <div style={{ color: "#0d6efd" }}>{observedText}</div>
          <button
            className="btn"
            onClick={() => {
              const a = document.getElementById("audio-doppler");
              if (a) {
                a.pause();
                a.currentTime = 0;
                a.play();
              }
            }}
          >
            Play Doppler
          </button>
          <audio
            id="audio-doppler"
            controls={false}
            src={dopplerSrc || undefined}
          />
          <Plot {...plotFromWaveform(dopplerWaveform)} />
        </div>

        {/* Comparison Section with DisplayAudio */}
        {dopplerAnalysis && (
          <div className="results-container">
            <div className="comparison-controls">
              <button
                className="btn btn-secondary"
                onClick={toggleComparison}
                disabled={isDopplerDownsampling || loading}
              >
                {isDopplerDownsampling
                  ? "Processing..."
                  : showComparison
                  ? "Hide Comparison"
                  : "Show Comparison"}
              </button>

              {showComparison && (
                <div className="resample-control">
                  <label>
                    Sample Rate: <strong>{sliderValue} Hz</strong>
                  </label>
                  <input
                    type="range"
                    min="8000"
                    max={dopplerOriginalRate > 0 ? dopplerOriginalRate : 48000}
                    step="1000"
                    value={sliderValue}
                    onChange={(e) => setSliderValue(Number(e.target.value))}
                    disabled={isDopplerDownsampling}
                  />
                </div>
              )}
            </div>
            {!showComparison ? (
              <>
                <h3>Doppler-Shifted Audio (Detailed View)</h3>
                <DisplayAudio
                  analysis={dopplerAnalysis}
                  audioSrc={dopplerSrc}
                  setError={setError}
                />
              </>
            ) : (
              <div className="comparison-container">
                <div className="comparison-side">
                  <h3>
                    Doppler Audio (
                    {dopplerOriginalRate > 0 ? dopplerOriginalRate : "N/A"} Hz)
                  </h3>
                  <DisplayAudio
                    analysis={dopplerAnalysis}
                    audioSrc={dopplerSrc}
                    setError={setError}
                  />
                </div>

                <div className="comparison-side">
                  <h3>Resampled Doppler Audio ({resampleRate} Hz)</h3>
                  {isDopplerDownsampling ? (
                    <div className="loading-spinner">Processing...</div>
                  ) : dopplerDownsampledAudio && dopplerDownsampledAnalysis ? (
                    <DisplayAudio
                      analysis={dopplerDownsampledAnalysis}
                      audioSrc={dopplerDownsampledAudio}
                      setError={setError}
                    />
                  ) : (
                    <div className="alert info">
                      Adjust the sample rate slider to generate downsampled
                      audio
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {loading && <div>Loading...</div>}
      </div>
    </div>
  );
};

export default Doppler;
