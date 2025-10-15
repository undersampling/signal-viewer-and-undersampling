import React, { useState } from "react";
import { apiService } from "../../services/api";
import "./SAR.css";

const SAR = () => {
  const [imageUri, setImageUri] = useState(null);
  const [features, setFeatures] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const contents = reader.result; // data URI
      try {
        setLoading(true);
        setError("");
        const { data } = await apiService.sarUpload(contents);
        setImageUri(data.image_uri);
        setFeatures(data.features);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to process image.");
        setImageUri(null);
        setFeatures(null);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="sar-page" style={{ padding: 16 }}>
      <h2 style={{ textAlign: "center", margin: "16px 0" }}>SAR Image Viewer & Feature Extractor</h2>

      <div className="card sar-card" style={{ padding: 16, marginBottom: 16 }}>
        <input type="file" accept=".tif,.tiff,.ntf" onChange={onUpload} />
      </div>

      {error && (
        <div className="alert" style={{ border: '1px solid #dc3545', color: '#dc3545', padding: 12, borderRadius: 6 }}>{error}</div>
      )}

      <div className="sar-output" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div>
          {imageUri && (
            <div>
              <img src={imageUri} alt="SAR" style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: 'auto' }} />
            </div>
          )}
        </div>
        <div>
          {features && (
            <div className="card" style={{ padding: 12 }}>
              <h4 style={{ marginTop: 0, textAlign: 'center' }}>Extracted Information</h4>
              <table style={{ width: '100%', border: '1px solid #ccc', marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(features).map(([k, v]) => (
                    <tr key={k}>
                      <td>{k}</td>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {loading && <div>Loading...</div>}
    </div>
  );
};

export default SAR;


