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
  const [originalRate, setOriginalRate] = useState(null);

  // States for downsampling logic with debounce
  const [resampleRate, setResampleRate] = useState(null);
  const [sliderValue, setSliderValue] = useState(null);

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
    setResampleRate(null);
    setSliderValue(null);
    setOriginalRate(null);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await apiService.detectAudio(file);
      setAnalysis(response.data);
      if (response.data && response.data.original_rate) {
        setOriginalRate(response.data.original_rate);
        setSliderValue(response.data.original_rate);
        setResampleRate(response.data.original_rate);
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
    if (resampleRate <= 0) {
      console.warn("Invalid resampleRate for handleDownsample:", resampleRate);
      return;
    }

    setIsDownsampling(true);
    setError("");

    try {
      const response = await apiService.downsampleAudio(file, resampleRate);

      let data;
      if (response && response.data) {
        data = response.data;
      } else if (response && typeof response === "object") {
        data = response;
      } else {
        throw new Error("Invalid response structure");
      }

      if (!data.original_rate && data.original_rate !== 0) {
        console.warn(
          "Original rate not provided in downsample response, assuming it's already known."
        );
      }

      setDownsampledAudio(data.downsampled_audio);

      // Analyze the downsampled audio
      await analyzeDownsampledAudio(data.downsampled_audio);
    } catch (err) {
      console.error("Downsampling error:", err);
      const errorMessage =
        err.response?.data?.error || err.message || "Downsampling failed.";
      setError(errorMessage);
    } finally {
      setIsDownsampling(false);
    }
  };

  const analyzeDownsampledAudio = async (audioDataUri) => {
    try {
      const response = await fetch(audioDataUri);
      const blob = await response.blob();
      const downsampledFile = new File(
        [blob],
        `downsampled_${resampleRate}.wav`,
        { type: "audio/wav" }
      );

      const analysisResponse = await apiService.detectAudio(downsampledFile);
      setDownsampledAnalysis(analysisResponse.data);
    } catch (err) {
      console.error("Downsampled analysis error:", err);
      setError("Failed to analyze downsampled audio.");
    }
  };

  const toggleComparison = () => {
    if (!showComparison) {
      setSliderValue(originalRate);
      setResampleRate(originalRate);
    } else {
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
  }, [resampleRate, showComparison, file]);

  // EFFECT 2: Debounces the slider input.
  useEffect(() => {
    if (!showComparison || !file) return;

    const handler = setTimeout(() => {
      if (sliderValue !== resampleRate) {
        setResampleRate(sliderValue);
      }
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [sliderValue, showComparison, file, resampleRate]);

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
          {/* Comparison Toggle Button */}
          <div className="comparison-controls">
            <button
              className="btn"
              onClick={toggleComparison}
              disabled={isLoading || isDownsampling}
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
                  Resample Rate: <strong>{sliderValue} Hz</strong>
                </label>
                <input
                  type="range"
                  min="500"
                  max={originalRate}
                  step="1000"
                  value={sliderValue}
                  onChange={(e) => setSliderValue(Number(e.target.value))}
                  disabled={isDownsampling}
                />
              </div>
            )}
          </div>

          {/* Conditional Rendering: Single or Side-by-Side */}
          {!showComparison ? (
            <DisplayAudio
              analysis={analysis}
              audioSrc={audioSrc}
              setError={setError}
            />
          ) : (
            <div className="comparison-container">
              <div className="comparison-side">
                <h3>Original Audio ({originalRate} Hz)</h3>
                <>
                  <div
                    className={`alert ${
                      analysis.prediction === "DRONE" ? "success" : "info"
                    }`}
                  >
                    <h4>Original Prediction: {analysis.prediction}</h4>
                  </div>
                  <DisplayAudio
                    analysis={analysis}
                    audioSrc={audioSrc}
                    setError={setError}
                  />
                </>
              </div>

              <div className="comparison-side">
                <h3>Downsampled Audio ({resampleRate} Hz)</h3>
                {isDownsampling ? (
                  <div className="loading-spinner">Processing...</div>
                ) : downsampledAudio && downsampledAnalysis ? (
                  <>
                    <div
                      className={`alert ${
                        downsampledAnalysis.prediction === "DRONE"
                          ? "success"
                          : "info"
                      }`}
                    >
                      <h4>
                        Downsampled Prediction: {downsampledAnalysis.prediction}
                      </h4>
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
