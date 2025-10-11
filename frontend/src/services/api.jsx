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
};
