import { useState, useEffect, useRef } from "react";
import Plot from "react-plotly.js";
import { apiService } from "../services/api";
import "./SignalViewer.css";

export default function SignalViewer({ isECG = false }) {
  const [signalData, setSignalData] = useState(null);
  const [channels, setChannels] = useState([0, 1, 2, 3]);
  const [viewerType, setViewerType] = useState("continuous");
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Control parameters
  const [speed, setSpeed] = useState(1);
  const [zoom, setZoom] = useState(5);
  const [chunkDuration, setChunkDuration] = useState(2);
  const [colormap, setColormap] = useState("Viridis");
  const [polarMode, setPolarMode] = useState("fixed");
  const [recChX, setRecChX] = useState(0);
  const [recChY, setRecChY] = useState(1);
  const [undersampleFreq, setUndersampleFreq] = useState(null);

  const [graphData, setGraphData] = useState(null);
  const [currentTime, setCurrentTime] = useState("");
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);

  const maxChannels = isECG ? 12 : 8;
  const leadNames = isECG
    ? [
        "I",
        "II",
        "III",
        "aVR",
        "aVL",
        "aVF",
        "V1",
        "V2",
        "V3",
        "V4",
        "V5",
        "V6",
      ]
    : Array.from({ length: 19 }, (_, i) => `Ch ${i + 1}`);

  const API = isECG ? apiService.ecgDemo : apiService.eegDemo;
  const uploadAPI = isECG ? apiService.ecgUpload : apiService.eegUpload;
  const graphAPI = isECG ? apiService.ecgGraph : apiService.eegGraph;

  // Load demo data
  const loadDemoData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await API();
      console.log("Demo data loaded:", response.data);
      setSignalData(response.data);
      setPrediction({
        label: response.data.prediction,
        confidence: response.data.confidence,
      });
      setPosition(0);
      setChannels(
        Array.from(
          {
            length: Math.min(4, response.data.channels || response.data.leads),
          },
          (_, i) => i
        )
      );
    } catch (error) {
      console.error("Error loading demo:", error);
      setError("Error loading demo data: " + error.message);
      alert("Error loading demo data: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (file) => {
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const response = await uploadAPI(file);
      console.log("File uploaded:", response.data);
      setSignalData(response.data);
      setPrediction({
        label: response.data.prediction,
        confidence: response.data.confidence,
      });
      setPosition(0);
      setChannels(
        Array.from(
          {
            length: Math.min(4, response.data.channels || response.data.leads),
          },
          (_, i) => i
        )
      );
    } catch (error) {
      console.error("Error uploading file:", error);
      setError("Error uploading file: " + error.message);
      alert("Error uploading file: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.csv') || file.name.endsWith('.npy')) {
        handleFileUpload(file);
      } else {
        alert('Please drop a .csv or .npy file');
      }
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleUploadAreaClick = () => {
    fileInputRef.current?.click();
  };

  // Handle WFDB upload (ECG only)
  const handleWFDBUpload = async (e) => {
    if (!isECG) return;

    const datFile = document.getElementById("dat-file")?.files?.[0];
    const heaFile = document.getElementById("hea-file")?.files?.[0];

    if (!datFile || !heaFile) {
      alert("Please select both .dat and .hea files");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await apiService.ecgWFDB(datFile, heaFile);
      console.log("WFDB uploaded:", response.data);
      setSignalData(response.data);
      setPrediction({
        label: response.data.prediction,
        confidence: response.data.confidence,
      });
      setPosition(0);
      setChannels(
        Array.from({ length: Math.min(4, response.data.leads) }, (_, i) => i)
      );
    } catch (error) {
      console.error("Error uploading WFDB:", error);
      setError("Error uploading WFDB files: " + error.message);
      alert("Error uploading WFDB files: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Update graph
  useEffect(() => {
    if (!signalData || !channels.length) {
      console.log("Skipping graph update - no signal data or channels");
      return;
    }

    const updateGraph = async () => {
      try {
        console.log("Updating graph with params:", {
          viewerType,
          position,
          zoom,
          channels,
          undersampleFreq,
          polarMode,
        });

        const response = await graphAPI(
          signalData.data,
          signalData.fs,
          channels,
          viewerType,
          position,
          zoom,
          chunkDuration,
          colormap,
          polarMode,
          recChX,
          recChY,
          undersampleFreq
        );

        console.log("Graph response:", response.data);

        if (response.data && response.data.traces) {
          setGraphData(response.data.traces);
          setCurrentTime(response.data.current_time);
          setError(null);
        } else {
          console.error("Invalid response format:", response.data);
          setError("Invalid graph data received");
        }
      } catch (error) {
        console.error("Error updating graph:", error);
        console.error("Error details:", error.response?.data);
        setError(
          "Error updating graph: " +
            (error.response?.data?.error || error.message)
        );
        setGraphData(null);
      }
    };

    updateGraph();
  }, [
    signalData,
    channels,
    viewerType,
    position,
    zoom,
    chunkDuration,
    colormap,
    polarMode,
    recChX,
    recChY,
    undersampleFreq,
  ]);

  // Playback interval
  useEffect(() => {
    if (!playing || !signalData) return;

    const interval = setInterval(() => {
      setPosition((prev) => {
        const newPos = prev + speed * 0.1;
        return newPos >= signalData.duration ? 0 : newPos;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [playing, speed, signalData]);

  const colorSchemes = ["Viridis", "Plasma", "Hot", "Cool", "Jet", "Rainbow"];

  if (!signalData) {
    return (
      <div className="signal-container">
        <div className="header">
          <h1>
            <i className={isECG ? "fas fa-heart-pulse" : "fas fa-brain"}></i>
            {isECG ? "ECG" : "EEG"} Multi-Channel Viewer & Analyzer
          </h1>
          <h1 className="page-title">
            Advanced signal processing and analysis platform
          </h1>
        </div>

        <div className="upload-section">
          <input
            ref={fileInputRef}
            id="file-input"
            type="file"
            onChange={handleFileInputChange}
            accept=".csv,.npy"
            disabled={loading}
            style={{ display: "none" }}
          />

          <div
            className={`upload-area ${isDragging ? "dragging" : ""}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleUploadAreaClick}
            style={{ cursor: loading ? "not-allowed" : "pointer" }}
          >
            <i className="fas fa-cloud-upload-alt"></i>
            <label style={{ pointerEvents: "none" }}>
              Drag and drop or <span className="link">select file</span>
            </label>
            <p style={{ fontSize: "0.9em", color: "#666", marginTop: "10px" }}>
              Supported formats: .csv, .npy
            </p>
          </div>

          {isECG && (
            <div className="wfdb-section">
              <h4>WFDB Format Upload</h4>
              <div className="wfdb-uploads">
                <div className="wfdb-upload">
                  <label htmlFor="dat-file">.dat file</label>
                  <input id="dat-file" type="file" accept=".dat" />
                </div>
                <div className="wfdb-upload">
                  <label htmlFor="hea-file">.hea file</label>
                  <input id="hea-file" type="file" accept=".hea" />
                </div>
              </div>
              <button
                onClick={handleWFDBUpload}
                disabled={loading}
                className="btn "
              >
                <i className="fas fa-check-circle"></i> Load WFDB Files
              </button>
            </div>
          )}

          <button onClick={loadDemoData} disabled={loading} className="btn ">
            <i className={isECG ? "fas fa-heartbeat" : "fas fa-flask"}></i>
            {loading ? "Loading..." : `Load Demo ${isECG ? "ECG" : "EEG"} Data`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="signal-container">
      <div className="header">
        <h1>
          <i className={isECG ? "fas fa-heart-pulse" : "fas fa-brain"}></i>
          {isECG ? "ECG" : "EEG"} Multi-Channel Viewer
        </h1>
      </div>

      {error && (
        <div
          style={{
            background: "#fee",
            border: "2px solid #f88",
            padding: "15px",
            borderRadius: "8px",
            marginBottom: "20px",
            color: "#c00",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {prediction && (
        <div className="prediction-card">
          <div className="prediction-content">
            <i className="fas fa-check-circle"></i>
            <div>
              <h3>AI Analysis Complete</h3>
              <p>Status: {prediction.label}</p>
              <p>Confidence: {(prediction.confidence * 100).toFixed(1)}%</p>
            </div>
          </div>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <i className={isECG ? "fas fa-heartbeat" : "fas fa-signal"}></i>
          <div className="stat-content">
            <div className="stat-value">
              {signalData.channels || signalData.leads}
            </div>
            <div className="stat-label">{isECG ? "Leads" : "Channels"}</div>
          </div>
        </div>
        <div className="stat-card">
          <i className="fas fa-clock"></i>
          <div className="stat-content">
            <div className="stat-value">{signalData.duration.toFixed(1)}s</div>
            <div className="stat-label">Duration</div>
          </div>
        </div>
        <div className="stat-card">
          <i className="fas fa-tachometer-alt"></i>
          <div className="stat-content">
            <div className="stat-value">{signalData.fs} Hz</div>
            <div className="stat-label">Sampling Rate</div>
          </div>
        </div>
      </div>

      <div className="controls-section">
        <div className="control-group">
          <label>Visualization Mode</label>
          <select
            value={viewerType}
            onChange={(e) => setViewerType(e.target.value)}
          >
            <option value="continuous">📈 Continuous Time Signal</option>
            <option value="xor">⚡ XOR Graph</option>
            <option value="polar">🎯 Polar Graph</option>
            <option value="recurrence">📊 Recurrence Graph</option>
          </select>
        </div>

        <div className="control-group">
          <label>{isECG ? "Lead" : "Channel"} Selection</label>
          <div className="channels-grid">
            {Array.from({ length: maxChannels }, (_, i) => (
              <label key={i} className="channel-checkbox">
                <input
                  type="checkbox"
                  checked={channels.includes(i)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setChannels([...channels, i]);
                    } else {
                      setChannels(channels.filter((c) => c !== i));
                    }
                  }}
                />
                {isECG ? leadNames[i] : `Ch ${i + 1}`}
              </label>
            ))}
          </div>
        </div>

        <div className="sliders-grid">
          <div className="slider-group">
            <label>Playback Speed: {speed.toFixed(1)}x</label>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
            />
          </div>

          <div className="slider-group">
            <label>Time Window (Zoom): {zoom.toFixed(1)}s</label>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
            />
          </div>

          <div className="slider-group">
            <label>XOR Chunk Duration: {chunkDuration.toFixed(1)}s</label>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.5"
              value={chunkDuration}
              onChange={(e) => setChunkDuration(parseFloat(e.target.value))}
            />
          </div>

          <div className="slider-group">
            <label>
              Nyquist Undersampling: {undersampleFreq || signalData.fs} Hz
            </label>
            <input
              type="range"
              min="1"
              max={Math.min(501, signalData.fs)}
              step="1"
              value={undersampleFreq || signalData.fs}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setUndersampleFreq(val === signalData.fs ? null : val);
              }}
            />
          </div>
        </div>

        <div className="additional-controls">
          <div className="control-group">
            <label>Color Scheme</label>
            <select
              value={colormap}
              onChange={(e) => setColormap(e.target.value)}
            >
              {colorSchemes.map((scheme) => (
                <option key={scheme} value={scheme}>
                  {scheme}
                </option>
              ))}
            </select>
          </div>

          {viewerType === "polar" && (
            <div className="control-group">
              <label>Polar Mode</label>
              <select
                value={polarMode}
                onChange={(e) => setPolarMode(e.target.value)}
              >
                <option value="fixed">Fixed Time</option>
                <option value="cumulative">Cumulative</option>
                {isECG && <option value="cycles">ECG Cycles (360°)</option>}
              </select>
            </div>
          )}

          {viewerType === "recurrence" && (
            <div className="control-group">
              <label>Recurrence {isECG ? "Leads" : "Channels"}</label>
              <div style={{ display: "flex", gap: "10px" }}>
                <select
                  value={recChX}
                  onChange={(e) => setRecChX(parseInt(e.target.value))}
                >
                  {Array.from({ length: maxChannels }, (_, i) => (
                    <option key={i} value={i}>
                      {isECG ? leadNames[i] : `Ch ${i + 1}`}
                    </option>
                  ))}
                </select>
                <span>vs</span>
                <select
                  value={recChY}
                  onChange={(e) => setRecChY(parseInt(e.target.value))}
                >
                  {Array.from({ length: maxChannels }, (_, i) => (
                    <option key={i} value={i}>
                      {isECG ? leadNames[i] : `Ch ${i + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="playback-controls">
        <button
          onClick={() => setPlaying(!playing)}
          className="btn btn-success"
        >
          <i className={`fas fa-${playing ? "pause" : "play"}`}></i>
          {playing ? "Pause" : "Play"}
        </button>
        <button onClick={() => setPosition(0)} className="btn btn-info">
          <i className="fas fa-redo"></i> Reset
        </button>
        <span className="time-display">{currentTime}</span>
      </div>

      <div className="graph-container">
        {graphData && graphData.length > 0 ? (
          <Plot
            data={graphData}
            layout={{
              title:
                viewerType === "recurrence"
                  ? graphData[0].name
                  : "Signal Visualization",
              height: 600,
              plot_bgcolor: "#f8f9ff",
              paper_bgcolor: "white",
              hovermode: "x unified",
              ...(graphData[0].type === "heatmap"
                ? { xaxis_title: "X", yaxis_title: "Y" }
                : {}),
            }}
            style={{ width: "100%", height: "600px" }}
          />
        ) : (
          <div className="loading">
            {error ? `Error: ${error}` : "Loading graph..."}
            <div
              style={{ marginTop: "10px", fontSize: "0.9em", color: "#666" }}
            >
              Check browser console for details
            </div>
          </div>
        )}
      </div>
    </div>
  );
}