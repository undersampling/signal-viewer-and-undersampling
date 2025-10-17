import React, { useState, useEffect, useRef } from "react";
import Plot from "react-plotly.js";
import { apiService } from "../services/api"; // Needs apiService for fetching chunks
import "./Audio.css";
function AudioDisplay({ analysis, audioSrc, setError }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [waveform, setWaveform] = useState(analysis.initial_waveform);
  const intervalRef = useRef(null);

  useEffect(() => {
    setWaveform(analysis.initial_waveform);
    setPosition(0);
    setIsPlaying(false);
  }, [analysis]);

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
            setWaveform(response.data);
            setPosition(response.data.new_position);
          }
        } catch (err) {
          setError("Failed to update waveform.");
          setIsPlaying(false);
        }
      }, 100);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, position, analysis, setError]);

  //           resampleRate // 🆕 Pass resampleRate to backend
  // }, [isPlaying, position, analysis, setError, resampleRate]);
  const handleStartPause = () => setIsPlaying(!isPlaying);

  const handleRestart = () => {
    setIsPlaying(false);
    setPosition(0);
    setWaveform(analysis.initial_waveform);
  };

  return (
    <div className="results-section">
      <div className="player-container">
        {audioSrc && (
          <audio
            key={audioSrc}
            controls
            src={audioSrc}
            style={{ width: "100%" }}
          />
        )}
      </div>

      <div className="controls">
        <button className="btn" onClick={handleStartPause} disabled={!analysis}>
          {isPlaying ? "Pause Scroll" : "Start Scroll"}
        </button>
        <button className="btn" onClick={handleRestart} disabled={!analysis}>
          Restart Scroll
        </button>
      </div>
      {/* <p className ="">amplitude</p> */}
      {waveform && (
        <Plot
          data={[
            {
              x: waveform.time,
              y: waveform.amplitude,
              type: "scatter",
              mode: "lines",
              marker: { color: "royalblue" },
              name: "Amplitude",
            },
          ]}
          layout={{
            title: "Waveform (Amplitude vs. Time)",
            template: "plotly_white",
            margin: { l: 60, r: 20, t: 50, b: 60 },
            xaxis: { title: "Time (s)" },
            yaxis: { title: "Amplitude" },
          }}
          style={{ width: "100%", height: "400px" }}
          config={{ responsive: true }}
        />
      )}

      {/* Plot 2: Frequency vs. Time
      {analysis.freq_time_data && (
        <Plot
          data={[
            {
              x: analysis.freq_time_data.time,
              y: analysis.freq_time_data.frequency,
              type: "scatter",
              mode: "lines",
              marker: { color: "firebrick" },
              name: "Frequency",
            },
          ]}
          layout={{
            title: "Frequency vs. Time",
            template: "plotly_white",
            margin: { l: 60, r: 20, t: 50, b: 60 },
            xaxis: { title: "Time (s)" },
            yaxis: { title: "Frequency (Hz)" },
          }}
          style={{ width: "100%", height: "400px" }}
          config={{ responsive: true }}
        />
      )} */}

      {/* Plot 3: Spectrogram */}
{analysis?.spectrogram?.z?.length > 0 && (
  <Plot
    data={[
      {
        z: analysis.spectrogram.z,
        x: analysis.spectrogram.x,
        y: analysis.spectrogram.y,
        type: "heatmap",
        colorscale: "Magma", // Retaining Magma colorscale as it matches the image
        zmin: -80, // Matches backend clipping range
        zmax: 0,
        reversescale: false,
        colorbar: {
          title: "Amplitude (dB)",
          titleside: "right",
          tickvals: [-80, -60, -40, -20, 0],
        },
      },
    ]}
    layout={{
      title: {
        text: "Spectrogram (Time vs Frequency)",
        font: { size: 16, color: "#fff" },
      },
      xaxis: {
        title: { text: "Time (s)", font: { color: "#fff" } },
        tickfont: { color: "#ccc" },
        gridcolor: "rgba(255, 255, 255, 0)", // No grid lines, consistent with image
      },
      yaxis: {
        title: { text: "Frequency (Hz)", font: { color: "#fff" } },
        tickfont: { color: "#ccc" },
        type: "linear", // CHANGED: From "log" to "linear" for a better visual match to the example image
        autorange: true, // Will automatically set the range based on data from backend (up to 8000 Hz)
        showgrid: true,
        gridcolor: "rgba(255, 255, 255, 0)", // No grid lines, consistent with image
      },
      margin: { l: 70, r: 40, t: 50, b: 50 },
      paper_bgcolor: "transparent",
      plot_bgcolor: "transparent",
      height: 420,
    }}
    config={{
      responsive: true,
      displayModeBar: false,
    }}
    style={{ width: "100%" }}
  />
)}
</div>
  );
}

export default AudioDisplay;