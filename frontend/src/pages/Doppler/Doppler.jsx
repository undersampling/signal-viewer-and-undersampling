import React, { useMemo, useState } from "react";
import { apiService } from "../../services/api";
import Plot from "react-plotly.js";
import "./Doppler.css";

const Doppler = () => {
  const [uploadSrc, setUploadSrc] = useState(null);
  const [storeOriginal, setStoreOriginal] = useState(null);
  const [waveformOriginal, setWaveformOriginal] = useState(null);

  const [vStart, setVStart] = useState(0.0);
  const [vEnd, setVEnd] = useState(20.0);
  const [fSource, setFSource] = useState(440);

  const [dopplerSrc, setDopplerSrc] = useState(null);
  const [dopplerWaveform, setDopplerWaveform] = useState(null);
  const [dopplerStatus, setDopplerStatus] = useState("");
  const [observedText, setObservedText] = useState("");

  const [passingSrc, setPassingSrc] = useState(null);
  const [passingWaveform, setPassingWaveform] = useState(null);
  const [passingFreq, setPassingFreq] = useState("");

  const [prediction, setPrediction] = useState(null);
  const [predError, setPredError] = useState("");
  const [loading, setLoading] = useState(false);

  const plotFromWaveform = useMemo(() => {
    return (wf) => {
      if (!wf) return { data: [], layout: { height: 300 } };
      const preview = wf.preview || { t: [], y: [] };
      const window = wf.window || { t: [], y: [], range: [0, 1] };
      return {
        data: [
          { x: preview.t, y: preview.y, mode: "lines", name: "Full Signal", opacity: 0.3 },
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

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const contents = reader.result; // data URI
      setUploadSrc(contents);
      try {
        setLoading(true);
        const { data } = await apiService.dopplerUpload(contents);
        setStoreOriginal(data.store);
        setWaveformOriginal(data.waveform);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
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
      setDopplerWaveform(data.waveform);
      setDopplerStatus(data.status || "");
      setObservedText(data.observed || "");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="doppler-page" style={{ padding: 16 }}>
      <h2 style={{ textAlign: "center", margin: "16px 0" }}>
        Doppler Effect Audio Simulator & Analyzer
      </h2>

      <div className="card doppler-card" style={{ padding: 16, marginBottom: 16 }}>
        <div className="upload-section">
          <div className="drop-zone" onClick={() => document.getElementById('doppler-file-input').click()}>
            <input
              id="doppler-file-input"
              type="file"
              accept="audio/wav"
              onChange={onUpload}
              style={{ display: 'none' }}
            />
            <div className="upload-prompt">
              <p>🎵 Drag & drop WAV file here or click to browse</p>
            </div>
          </div>
        </div>
        <div className="grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div className="field">
            <label>Start speed v_i (m/s):</label>
            <input className="input" type="number" value={vStart} onChange={(e) => setVStart(parseFloat(e.target.value))} />
          </div>
          <div className="field">
            <label>End speed v_f (m/s):</label>
            <input className="input" type="number" value={vEnd} onChange={(e) => setVEnd(parseFloat(e.target.value))} />
          </div>
          <div className="field">
            <label>Source frequency (Hz):</label>
            <input className="input" type="number" value={fSource} onChange={(e) => setFSource(parseFloat(e.target.value))} />
          </div>
          <div className="actions" style={{ alignSelf: "flex-end" }}>
            <button className="btn primary" onClick={onGenerate}>Apply Doppler (full length)</button>
          </div>
        </div>
        <div className="toolbar" style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center" }}>
          <button className="btn success" onClick={onSimulate}>
            Simulate Car Passing By
          </button>
          <div className="status success" style={{ fontWeight: 600 }}>{dopplerStatus}</div>
        </div>
        <div style={{ marginTop: 8, color: "#6c757d" }}>
          Note: Enter speeds in m/s. Negative speeds correspond to motion TOWARD the observer (approaching), positive speeds correspond to motion AWAY (receding).
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <h4 style={{ margin: 0 }}>AI Prediction</h4>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
          <button onClick={onPredict}>Predict Speed & Frequency from Uploaded File</button>
          <div>
            {prediction && (
              <div style={{ border: "1px solid #0d6efd", padding: 12, borderRadius: 6, color: "#0d6efd" }}>
                <div style={{ fontWeight: 700 }}>Prediction Results:</div>
                <div>
                  Predicted Start Speed: {prediction.predicted_start_speed?.toFixed(2)} m/s ({((prediction.predicted_start_speed || 0) * 3.6).toFixed(2)} km/h)
                </div>
                <div>
                  Predicted End Speed: {prediction.predicted_end_speed?.toFixed(2)} m/s ({((prediction.predicted_end_speed || 0) * 3.6).toFixed(2)} km/h)
                </div>
                <div>Predicted Source Frequency: {prediction.predicted_source_frequency?.toFixed(2)} Hz</div>
              </div>
            )}
            {predError && (
              <div style={{ border: "1px solid #dc3545", padding: 12, borderRadius: 6, color: "#dc3545" }}>
                {predError}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h4>Original Signal</h4>
        <button className="btn" onClick={() => { const a = document.getElementById('audio-original'); if (a) { a.pause(); a.currentTime = 0; a.play(); }}}>Play Original</button>
        <audio id="audio-original" controls={false} src={uploadSrc || undefined} />
        <Plot {...plotFromWaveform(waveformOriginal)} />
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h4>Doppler-Shifted (full length)</h4>
        <div style={{ color: "#0d6efd" }}>{observedText}</div>
        <button className="btn" onClick={() => { const a = document.getElementById('audio-doppler'); if (a) { a.pause(); a.currentTime = 0; a.play(); }}}>Play Doppler</button>
        <audio id="audio-doppler" controls={false} src={dopplerSrc || undefined} />
        <Plot {...plotFromWaveform(dopplerWaveform)} />
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <h4>Car Passing By Simulation</h4>
        <div style={{ color: "#0dcaf0" }}>{passingFreq}</div>
        <button className="btn" onClick={() => { const a = document.getElementById('audio-passing'); if (a) { a.pause(); a.currentTime = 0; a.play(); }}}>Play Passing Simulation</button>
        <audio id="audio-passing" controls={false} src={passingSrc || undefined} />
        <Plot {...plotFromWaveform(passingWaveform)} />
      </div>

      {loading && <div>Loading...</div>}
    </div>
  );
};

export default Doppler;



