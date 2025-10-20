import React, { useState, useEffect } from "react";
import { apiService } from "../../services/api";
import "../../components/Audio.css";
import AudioUploader from "../../components/AudioUploader";
import DisplayAudio from "../../components/DisplayAudio";
import "./Human.css";

const Human = () => {
  const [file, setFile] = useState(null);
  const [audioSrc, setAudioSrc] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Comparison state
  const [showComparison, setShowComparison] = useState(false);
  const [originalRate, setOriginalRate] = useState(null);

  // States for resampling logic with debounce
  const [resampleRate, setResampleRate] = useState(null);
  const [sliderValue, setSliderValue] = useState(null);

  // Resampled audio state
  const [resampledAudio, setResampledAudio] = useState(null);
  const [resampledAnalysis, setResampledAnalysis] = useState(null);
  const [isResampling, setIsResampling] = useState(false);

  // Corrected audio state
  const [correctedAudio, setCorrectedAudio] = useState(null);
  const [correctedAnalysis, setCorrectedAnalysis] = useState(null);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [showCorrection, setShowCorrection] = useState(false);

  // Carousel state (0 = Original+Resampled, 1 = Resampled+Corrected)
  const [carouselPosition, setCarouselPosition] = useState(0);

  // Handle file selection
  const handleFileSelected = (selectedFile) => {
    setFile(selectedFile);
    setAudioSrc(URL.createObjectURL(selectedFile));
    setAnalysis(null);
    setError("");
    setShowComparison(false);
    setResampledAudio(null);
    setResampledAnalysis(null);
    setCorrectedAudio(null);
    setCorrectedAnalysis(null);
    setShowCorrection(false);
    setOriginalRate(null);
    setResampleRate(null);
    setSliderValue(null);
    setCarouselPosition(0);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setIsLoading(true);
    setError("");
    try {
      const response = await apiService.detectDrone(file);
      setAnalysis(response.data);
      if (response.data && response.data.original_rate) {
        setOriginalRate(response.data.original_rate);
        setResampleRate(response.data.original_rate);
        setSliderValue(response.data.original_rate);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Analysis failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle resampling of the audio
  const handleResample = async () => {
    if (!file) {
      setError("Please upload an audio file first.");
      return;
    }
    if (!resampleRate || resampleRate <= 0) {
      console.warn("Invalid resampleRate for handleResample:", resampleRate);
      return;
    }

    setIsResampling(true);
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
        console.warn("Original rate not provided in downsample response.");
      }

      setResampledAudio(data.downsampled_audio);

      // Analyze the resampled audio
      await analyzeResampledAudio(data.downsampled_audio);
    } catch (err) {
      console.error("Resampling error:", err);
      const errorMessage =
        err.response?.data?.error || err.message || "Resampling failed.";
      setError(errorMessage);
    } finally {
      setIsResampling(false);
    }
  };

  // Analyze the resampled audio
  const analyzeResampledAudio = async (audioDataUri) => {
    try {
      const response = await fetch(audioDataUri);
      const blob = await response.blob();
      const resampledFile = new File([blob], `resampled_${resampleRate}.wav`, {
        type: "audio/wav",
      });

      const analysisResponse = await apiService.detectDrone(resampledFile);
      setResampledAnalysis(analysisResponse.data);
    } catch (err) {
      console.error("Resampled analysis error:", err);
      setError("Failed to analyze resampled audio.");
    }
  };

  // Handle correction (anti-aliasing)
  const handleCorrection = async () => {
    if (!resampledAudio) {
      setError("Please resample the audio first.");
      return;
    }

    setIsCorrecting(true);
    setError("");

    try {
      // Convert resampledAudio (data URI) to file
      const response = await fetch(resampledAudio);
      const blob = await response.blob();
      const resampledFile = new File([blob], `resampled_${resampleRate}.wav`, {
        type: "audio/wav",
      });

      // Call your API service for correction (adjust endpoint as needed)
      const correctionResponse = await apiService.detectDrone(resampledFile);

      let data;
      if (correctionResponse && correctionResponse.data) {
        data = correctionResponse.data;
      } else if (correctionResponse && typeof correctionResponse === "object") {
        data = correctionResponse;
      } else {
        throw new Error("Invalid response structure");
      }

      setCorrectedAudio(data.corrected_audio);

      // Analyze the corrected audio
      await analyzeCorrectedAudio(data.corrected_audio);
      setShowCorrection(true);
    } catch (err) {
      console.error("Correction error:", err);
      const errorMessage =
        err.response?.data?.error || err.message || "Correction failed.";
      setError(errorMessage);
    } finally {
      setIsCorrecting(false);
    }
  };

  // Analyze the corrected audio
  const analyzeCorrectedAudio = async (audioDataUri) => {
    try {
      const response = await fetch(audioDataUri);
      const blob = await response.blob();
      const correctedFile = new File([blob], `corrected_${resampleRate}.wav`, {
        type: "audio/wav",
      });

      const analysisResponse = await apiService.detectDrone(correctedFile);
      setCorrectedAnalysis(analysisResponse.data);
    } catch (err) {
      console.error("Corrected analysis error:", err);
      setError("Failed to analyze corrected audio.");
    }
  };

  // Toggle comparison mode
  const toggleComparison = () => {
    if (!showComparison) {
      // If turning comparison ON, initialize with originalRate
      const initialRate = originalRate > 0 ? originalRate : 16000;
      setSliderValue(initialRate);
      setResampleRate(initialRate);
    } else {
      // If turning comparison OFF, reset resampled data
      setResampledAudio(null);
      setResampledAnalysis(null);
      setCorrectedAudio(null);
      setCorrectedAnalysis(null);
      setShowCorrection(false);
      setCarouselPosition(0);
    }
    setShowComparison(!showComparison);
  };

  // Navigate carousel
  const moveCarousel = (direction) => {
    if (direction === "right" && carouselPosition < 1) {
      setCarouselPosition(1);
    } else if (direction === "left" && carouselPosition > 0) {
      setCarouselPosition(0);
    }
  };

  // Effect to handle resampling when resampleRate changes
  useEffect(() => {
    if (showComparison && file && resampleRate > 0) {
      handleResample();
    }
  }, [resampleRate, showComparison, file]);

  // Effect to debounce the slider input
  useEffect(() => {
    if (!showComparison || !file) {
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
  }, [sliderValue, showComparison, file, resampleRate]);

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
          {/* Comparison Toggle Button */}
          <div className="comparison-controls">
            <button
              className="btn"
              onClick={toggleComparison}
              disabled={isLoading || isResampling}
            >
              {isResampling
                ? "Processing..."
                : showComparison
                ? "Hide Comparison"
                : "Show Comparison"}
            </button>

            {/* Correction Button */}
            {showComparison && resampledAudio && (
              <button
                className="btn "
                onClick={handleCorrection}
                disabled={isCorrecting || isResampling}
              >
                {isCorrecting ? "Correcting..." : "Correct Aliasing"}
              </button>
            )}

            {/* Resample Rate Slider */}
            {showComparison && originalRate && (
              <div className="resample-control">
                <label>
                  Resample Rate: <strong>{sliderValue} Hz</strong>
                </label>
                <input
                  type="range"
                  min="500"
                  max={originalRate}
                  step="1000"
                  value={sliderValue || originalRate}
                  onChange={(e) => setSliderValue(Number(e.target.value))}
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
            // Side-by-side comparison with carousel
            <div className="comparison-wrapper">
              {/* Navigation Buttons */}
              {showCorrection && (
                <div className="carousel-navigation">
                  <button
                    className="carousel-btn"
                    onClick={() => moveCarousel("left")}
                    disabled={carouselPosition === 0}
                  >
                    ← Left
                  </button>
                  <span className="carousel-indicator">
                    {carouselPosition === 0
                      ? "Original vs Undersampling"
                      : "Undersampling vs Correction"}
                  </span>
                  <button
                    className="carousel-btn"
                    onClick={() => moveCarousel("right")}
                    disabled={carouselPosition === 1}
                  >
                    Right →
                  </button>
                </div>
              )}

              <div className="comparison-container">
                {/* Original Audio - Only visible in position 0 */}
                {carouselPosition === 0 && (
                  <div className="comparison-side">
                    <h3>
                      Original Audio ({originalRate > 0 ? originalRate : "N/A"}{" "}
                      Hz)
                    </h3>
                    <DisplayAudio
                      analysis={analysis}
                      audioSrc={audioSrc}
                      setError={setError}
                    />
                  </div>
                )}

                {/* Resampled Audio - Always visible */}
                <div className="comparison-side">
                  <h3>Undersampling ({resampleRate} Hz)</h3>
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

                {/* Corrected Audio - Only visible in position 1 */}
                {carouselPosition === 1 && showCorrection && (
                  <div className="comparison-side">
                    <h3>Removing Aliasing Effect</h3>
                    {isCorrecting ? (
                      <div className="loading-spinner">Correcting...</div>
                    ) : correctedAudio && correctedAnalysis ? (
                      <DisplayAudio
                        analysis={correctedAnalysis}
                        audioSrc={correctedAudio}
                        setError={setError}
                      />
                    ) : (
                      <div className="alert info">
                        Click "Correct Aliasing" to remove aliasing effects
                      </div>
                    )}
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
