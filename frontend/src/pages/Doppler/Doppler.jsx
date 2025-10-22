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
  const [passingAnalysis, setPassingAnalysis] = useState(null);
  const [passingOriginalRate, setPassingOriginalRate] = useState(null);
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
  const [sharedZoomRange, setSharedZoomRange] = useState(null);

  // States for downsampling with debounce
  const [dopplerOriginalRate, setDopplerOriginalRate] = useState(null); // Initialized as null
  const [resampleRate, setResampleRate] = useState(null); // Initialized as null
  const [sliderValue, setSliderValue] = useState(null); // Initialized as null
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

        // Reset all states related to Doppler audio
        setDopplerSrc(null);
        setDopplerWaveform(null);
        setDopplerAnalysis(null);
        setDopplerOriginalRate(null); // Reset to null
        setDopplerDownsampledAudio(null);
        setDopplerDownsampledAnalysis(null);
        setResampleRate(null); // Reset to null
        setSliderValue(null); // Reset to null
        setPrediction(null);
        setPredError("");
        setShowComparison(false); // Hide comparison on new upload
        
        // Reset all states related to passing simulation
        setPassingSrc(null);
        setPassingWaveform(null);
        setPassingFreq("");
        setPassingAnalysis(null);
        setPassingOriginalRate(null);
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

      // Set analysis for DisplayAudio (similar to onGenerate)
      const passingAnalysisData = {
        initial_waveform: data.initial_waveform || { time: [], amplitude: [] },
        spectrogram: data.spectrogram || null,
        file_id: data.file_id || null,
        original_rate: data.initial_waveform?.sr || null,
      };

      // Store the analysis data for passing simulation
      setPassingAnalysis(passingAnalysisData);

      // Also keep the old waveform format for the simple plot
      if (data.initial_waveform?.time && data.initial_waveform?.amplitude) {
        const timeArray = data.initial_waveform.time;
        const ampArray = data.initial_waveform.amplitude;
        setPassingWaveform({
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

      // Capture original sample rate for passing simulation
      const detectedRate = data.initial_waveform?.sr || null;
      setPassingOriginalRate(detectedRate);
    } catch (e) {
      console.error("Simulation error:", e);
      setError("Simulation failed");
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
        original_rate: data.initial_waveform?.sr || null, // Assuming original_rate comes under initial_waveform
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
      const detectedRate = data.initial_waveform?.sr || null; // Set to null if not provided
      setDopplerOriginalRate(detectedRate);

      // Reset downsampling states
      setDopplerDownsampledAudio(null);
      setDopplerDownsampledAnalysis(null);
      setResampleRate(null);
      setSliderValue(null);
      setPrediction(null);
      setPredError("");
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
    // Use passingSrc if available, otherwise use dopplerSrc
    const sourceToUse = passingSrc || dopplerSrc;
    
    if (!sourceToUse) {
      setError("Generate Doppler audio or simulate car passing first.");
      setIsDopplerDownsampling(false);
      return;
    }
    if (!resampleRate || resampleRate <= 0) {
      console.warn("Invalid resampleRate:", resampleRate);
      setIsDopplerDownsampling(false);
      return;
    }

    setIsDopplerDownsampling(true);
    setError("");

    try {
      const audioBlob = dataURItoBlob(sourceToUse);
      const audioFile = new File([audioBlob], "audio.wav", {
        type: audioBlob.type,
      });

      const response = await apiService.downsampleAudio(
        audioFile,
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

      if (!dopplerOriginalRate && data.original_rate) {
        setDopplerOriginalRate(data.original_rate);
      }

      setDopplerDownsampledAudio(data.downsampled_audio);
      setDopplerDownsampledAnalysis(data.downsampled_analysis || null);

      // Analyze the downsampled audio if analysis data is not already provided
      if (!data.downsampled_analysis) {
        await analyzeDopplerDownsampledAudio(data.downsampled_audio);
      }
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
    passingSrc,
    dopplerSrc,
    resampleRate,
    dopplerOriginalRate,
    dataURItoBlob,
    analyzeDopplerDownsampledAudio,
  ]);

  const handleZoomChange = (zoomRange) => {
    setSharedZoomRange(zoomRange);
  };

  const toggleComparison = () => {
    // Check if we have either dopplerSrc or passingSrc
    if (!dopplerSrc && !passingSrc) {
      setError("Please generate Doppler audio or simulate car passing first.");
      return;
    }

    setShowComparison((prev) => {
      const newShowComparison = !prev;
      if (newShowComparison) {
        // Use the appropriate original rate based on which source is available
        const sourceToUse = passingSrc || dopplerSrc;
        const originalRate = passingSrc ? passingOriginalRate : dopplerOriginalRate;
        const initialRate = originalRate > 0 ? originalRate : 48000; // Adjust default if necessary
        setSliderValue(initialRate);
        setResampleRate(initialRate);
        // Reset zoom when starting comparison
        setSharedZoomRange(null);
      } else {
        // If disabling comparison, reset downsampled states
        setDopplerDownsampledAudio(null);
        setDopplerDownsampledAnalysis(null);
        setResampleRate(null);
        setSliderValue(null);
        setSharedZoomRange(null);
      }
      return newShowComparison;
    });
  };

  // EFFECT 1: Trigger downsample when resampleRate changes
  useEffect(() => {
    const sourceToUse = passingSrc || dopplerSrc;
    if (showComparison && sourceToUse && resampleRate > 0) {
      handleDopplerDownsample();
    }
  }, [resampleRate, showComparison, passingSrc, dopplerSrc, handleDopplerDownsample]);

  // EFFECT 2: Debounce slider input
  useEffect(() => {
    const sourceToUse = passingSrc || dopplerSrc;
    if (!showComparison || !sourceToUse) {
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
  }, [sliderValue, showComparison, passingSrc, dopplerSrc, resampleRate]);

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

        <div className="panel" style={{ marginBottom: 16 }}>
          <h4>Car Passing Simulation</h4>
          <div style={{ color: "#28a745" }}>{passingFreq}</div>
          <button
            className="btn"
            onClick={() => {
              const a = document.getElementById("audio-passing");
              if (a) {
                a.pause();
                a.currentTime = 0;
                a.play();
              }
            }}
            disabled={!passingSrc}
          >
            Play Car Passing
          </button>
          <audio
            id="audio-passing"
            controls={false}
            src={passingSrc || undefined}
          />
          <Plot {...plotFromWaveform(passingWaveform)} />
        </div>

        {/* Comparison Section with DisplayAudio */}
        {(dopplerAnalysis || passingAnalysis) && (
          <div className="results-container">
            <div className="comparison-controls">
              {/* Toggle Comparison Visibility */}
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

              {/* Resample Rate Slider */}
              {showComparison && (passingOriginalRate || dopplerOriginalRate) && (
                <div className="resample-control">
                  <label>
                    Sample Rate: <strong>{sliderValue} Hz</strong>
                  </label>
                  <input
                    type="range"
                    min="500" // Adjusted min value for more flexibility
                    max={passingSrc ? passingOriginalRate : dopplerOriginalRate} // Set max to appropriate original rate
                    step="1000"
                    value={sliderValue || (passingSrc ? passingOriginalRate : dopplerOriginalRate)} // Use appropriate original rate if sliderValue is null
                    onChange={(e) => setSliderValue(Number(e.target.value))}
                    disabled={isDopplerDownsampling}
                  />
                </div>
              )}
            </div>
            {!showComparison ? (
              <>
                <h3>Simulate Car Pass</h3>
                <DisplayAudio
                  analysis={passingAnalysis || dopplerAnalysis}
                  audioSrc={passingSrc || dopplerSrc}
                  setError={setError}
                />
              </>
            ) : (
              <div className="comparison-container">
                <div className="comparison-side">
                  <h3>
                    {passingSrc ? "Car Passing Simulation" : "Doppler Audio"} 
                    ({passingSrc ? passingOriginalRate : dopplerOriginalRate} Hz)
                  </h3>
                  <DisplayAudio
                    analysis={passingSrc ? passingAnalysis : dopplerAnalysis}
                    audioSrc={passingSrc || dopplerSrc}
                    setError={setError}
                    zoomRange={sharedZoomRange}
                    onZoomChange={handleZoomChange}
                  />
                </div>

                <div className="comparison-side">
                  <h3>
                    Resampled {passingSrc ? "Car Passing" : "Doppler"} Audio 
                    ({resampleRate} Hz)
                  </h3>
                  {isDopplerDownsampling ? (
                    <div className="loading-spinner">Processing...</div>
                  ) : dopplerDownsampledAudio && dopplerDownsampledAnalysis ? (
                    <DisplayAudio
                      analysis={dopplerDownsampledAnalysis}
                      audioSrc={dopplerDownsampledAudio}
                      setError={setError}
                      zoomRange={sharedZoomRange}
                      onZoomChange={handleZoomChange}
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
