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
  downsampleAudio: async (file, newRate) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("new_rate", newRate);
    try {
      const response = await axios.post(
        "http://localhost:8000/api/audio/downsample/",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return response.data;
    } catch (error) {
      console.error(
        "Downsampling failed:",
        error.response?.data || error.message
      );
      throw error;
    }
  },
  eegDemo: () => apiClient.post("/api/eeg/demo/"),

  eegUpload: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("/api/eeg/upload/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  eegGraph: (
    data,
    fs,
    channels,
    viewerType,
    position,
    zoom,
    chunkDuration,
    colormap,
    polarMode,
    recChX,
    recChY
  ) =>
    apiClient.post("/api/eeg/graph/", {
      data,
      fs,
      channels,
      viewer_type: viewerType,
      position,
      zoom,
      chunk_duration: chunkDuration,
      colormap,
      polar_mode: polarMode,
      rec_ch_x: recChX,
      rec_ch_y: recChY,
    }),

  // ECG endpoints
  ecgDemo: () => apiClient.post("/api/ecg/demo/"),

  ecgUpload: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiClient.post("/api/ecg/upload/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  ecgWFDB: (datFile, heaFile) => {
    const formData = new FormData();
    formData.append("dat_file", datFile);
    formData.append("hea_file", heaFile);
    return apiClient.post("/api/ecg/wfdb/", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },

  ecgGraph: (
    data,
    fs,
    channels,
    viewerType,
    position,
    zoom,
    chunkDuration,
    colormap,
    polarMode,
    recChX,
    recChY
  ) =>
    apiClient.post("/api/ecg/graph/", {
      data,
      fs,
      channels,
      viewer_type: viewerType,
      position,
      zoom,
      chunk_duration: chunkDuration,
      colormap,
      polar_mode: polarMode,
      rec_ch_x: recChX,
      rec_ch_y: recChY,
    }),
};
