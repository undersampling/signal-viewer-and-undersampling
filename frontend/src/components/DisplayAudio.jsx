import React, { useState, useEffect, useRef } from "react";
import Plot from "react-plotly.js";
import { apiService } from "../services/api";
import "./Audio.css";

function DisplayAudio({ analysis, audioSrc, setError, zoomRange, onZoomChange }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [waveform, setWaveform] = useState(null);
  const intervalRef = useRef(null);

  // Initialize waveform when analysis changes
  useEffect(() => {
    if (analysis?.initial_waveform) {
      console.log("Setting initial waveform:", analysis.initial_waveform);
      console.log("Spectrogram data:", analysis.spectrogram);
      setWaveform(analysis.initial_waveform);
      setPosition(0);
      setIsPlaying(false);
    }
  }, [analysis]);

  // Handle chunk streaming when playing
  useEffect(() => {
    if (isPlaying && analysis?.file_id) {
      intervalRef.current = setInterval(async () => {
        try {
          // Use unified endpoint for both drone and doppler
          const response = await apiService.getWaveformChunk(
            analysis.file_id,
            position
          );

          if (response.data.completed) {
            setIsPlaying(false);
            setPosition(0);
            // Reset to initial waveform
            setWaveform(analysis.initial_waveform);
          } else {
            // Update waveform with new chunk data
            setWaveform({
              time: response.data.time,
              amplitude: response.data.amplitude,
            });
            setPosition(response.data.new_position);
          }
        } catch (err) {
          console.error("Failed to update waveform:", err);
          setError("Failed to update waveform.");
          setIsPlaying(false);
        }
      }, 100);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPlaying, position, analysis, setError]);

  const handleStartPause = () => {
    if (!isPlaying) {
      setPosition(0); // Reset position when starting
    }
    setIsPlaying(!isPlaying);
  };

  const handleRestart = () => {
    setIsPlaying(false);
    setPosition(0);
    setWaveform(analysis?.initial_waveform);
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

      {/* Waveform Plot */}
      {waveform && waveform.time && waveform.amplitude && (
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
            xaxis: { 
              title: "Time (s)",
              range: zoomRange || undefined
            },
            yaxis: { title: "Amplitude" },
          }}
          style={{ width: "100%", height: "400px" }}
          config={{ responsive: true }}
          onRelayout={(event) => {
            if (onZoomChange && event['xaxis.range']) {
              onZoomChange(event['xaxis.range']);
            }
          }}
        />
      )}

      {/* Spectrogram */}
      {analysis?.spectrogram?.z?.length > 0 && (
        <Plot
          data={[
            {
              z: analysis.spectrogram.z,
              x: analysis.spectrogram.x,
              y: analysis.spectrogram.y,
              type: "heatmap",
              colorscale: "Magma",
              zmin: -80,
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
              gridcolor: "rgba(255, 255, 255, 0)",
            },
            yaxis: {
              title: { text: "Frequency (Hz)", font: { color: "#fff" } },
              tickfont: { color: "#ccc" },
              type: "linear",
              autorange: true,
              showgrid: true,
              gridcolor: "rgba(255, 255, 255, 0)",
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

export default DisplayAudio;
