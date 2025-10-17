import axios from 'axios'

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const signalAPI = {
  // EEG endpoints
  eegDemo: () => api.post('/api/eeg/demo/'),

  eegUpload: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/api/eeg/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  eegGraph: (data, fs, channels, viewerType, position, zoom, chunkDuration, colormap, polarMode, recChX, recChY) =>
    api.post('/api/eeg/graph/', {
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
      rec_ch_y: recChY
    }),

  // ECG endpoints
  ecgDemo: () => api.post('/api/ecg/demo/'),

  ecgUpload: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post('/api/ecg/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  ecgWFDB: (datFile, heaFile) => {
    const formData = new FormData()
    formData.append('dat_file', datFile)
    formData.append('hea_file', heaFile)
    return api.post('/api/ecg/wfdb/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },

  ecgGraph: (data, fs, channels, viewerType, position, zoom, chunkDuration, colormap, polarMode, recChX, recChY) =>
    api.post('/api/ecg/graph/', {
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
      rec_ch_y: recChY
    })
}

export default api
