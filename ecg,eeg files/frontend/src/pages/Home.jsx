export default function Home() {
  return (
    <div className="home-container">
      <h1>Welcome to Signal Viewer Pro</h1>
      <p>Advanced Neural and Cardiac Signal Processing Platform</p>
      <div className="feature-grid">
        <div className="feature-card">
          <i className="fas fa-brain"></i>
          <h3>EEG Analysis</h3>
          <p>Analyze electroencephalography signals with multiple visualization modes</p>
        </div>
        <div className="feature-card">
          <i className="fas fa-heart-pulse"></i>
          <h3>ECG Analysis</h3>
          <p>Visualize cardiac signals with AI-powered diagnostics</p>
        </div>
      </div>
    </div>
  )
}
