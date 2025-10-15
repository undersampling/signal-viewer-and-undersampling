// frontend/src/services/apiService.js

import axios from "axios";

const apiClient = axios.create({
  baseURL: "http://localhost:8000/api",
});

export const apiService = {
  detectDrone: (audioFile) => {
    const formData = new FormData();
    formData.append("audio", audioFile);
    return apiClient.post("/drone/detect/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  getWaveformChunk: (fileId, position) => {
    return apiClient.post("/drone/waveform-chunk/", {
      file_id: fileId,
      position,
    });
  },

  resampleAudio: (fileId, newSr) => {
    return apiClient.post("/drone/resample/", {
      file_id: fileId,
      new_sr: newSr,
    });
  },

  // Doppler endpoints
  dopplerUpload: (dataUri) => {
    return apiClient.post("/doppler/upload/", { contents: dataUri });
  },
  dopplerGenerate: ({ dataUri, vStart, vEnd, fSource }) => {
    return apiClient.post("/doppler/generate/", {
      contents: dataUri,
      v_start: vStart,
      v_end: vEnd,
      f_source: fSource,
    });
  },
  dopplerSimulate: ({ dataUri, vStart, vEnd, fSource }) => {
    return apiClient.post("/doppler/simulate/", {
      contents: dataUri,
      v_start: vStart,
      v_end: vEnd,
      f_source: fSource,
    });
  },
  dopplerPredict: (dataUri) => {
    return apiClient.post("/doppler/predict/", { contents: dataUri });
  },

  // SAR endpoints
  sarUpload: (dataUri) => {
    return apiClient.post("/sar/upload/", { contents: dataUri });
  },
};
