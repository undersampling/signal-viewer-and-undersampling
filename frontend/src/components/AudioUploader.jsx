// import { useState, useRef } from "react";
// import "./Audio.css";

// function AudioUploader({ onFileSelect, onAnalyze, isLoading }) {
//   const [selectedFile, setSelectedFile] = useState(null);
//   const [isDragging, setIsDragging] = useState(false);
//   const fileInputRef = useRef(null);

//   const handleFile = (file) => {
//     if (!file.type.startsWith("audio/")) {
//       alert("Please select an audio file!");
//       return;
//     }
//     setSelectedFile(file);
//     onFileSelect(file);
//   };

//   const handleDragEnter = (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     setIsDragging(true);
//   };
//   const handleDragOver = (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//   };
//   const handleDragLeave = (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     setIsDragging(false);
//   };
//   const handleDrop = (e) => {
//     e.preventDefault();
//     e.stopPropagation();
//     setIsDragging(false);
//     const files = e.dataTransfer.files;
//     if (files && files.length > 0) handleFile(files[0]);
//   };
//   const handleFileInput = (e) => {
//     const files = e.target.files;
//     if (files && files.length > 0) handleFile(files[0]);
//   };
//   const handleClick = () => {
//     fileInputRef.current.click();
//   };

//   return (
//     <div className="audio-uploader">
//       <input
//         ref={fileInputRef}
//         type="file"
//         accept="audio/*"
//         onChange={handleFileInput}
//         style={{ display: "none" }}
//       />

//       <div
//         className={`drop-zone ${isDragging ? "dragging" : ""}`}
//         onDragEnter={handleDragEnter}
//         onDragOver={handleDragOver}
//         onDragLeave={handleDragLeave}
//         onDrop={handleDrop}
//         onClick={handleClick}
//       >
//         {selectedFile ? (
//           <div className="file-info">
//             <p>✅ Selected: {selectedFile.name}</p>
//           </div>
//         ) : (
//           <div className="upload-prompt">
//             <p>🎵 Drag & drop audio file here or click to browse</p>
//           </div>
//         )}
//       </div>

//       {selectedFile && (
//         <div className="analyze-button-container">
//           <button className="btn" onClick={onAnalyze} disabled={isLoading}>
//             {isLoading ? "Analyzing..." : "Analyze Audio"}
//           </button>
//         </div>
//       )}
//     </div>
//   );
// }

// export default AudioUploader;
import { useState, useRef } from "react";
import "./Audio.css";

/**
 * Flexible Audio Uploader Component
 *
 * @param {Function} onFileSelect - Callback when file is selected (receives file object)
 * @param {Function} onAnalyze - Optional callback for "Analyze" button (if not provided, no button shown)
 * @param {Boolean} isLoading - Show loading state
 * @param {String} acceptedFormats - File types to accept (default: "audio/*")
 * @param {String} promptText - Custom prompt text for upload area
 * @param {Boolean} autoUpload - If true, calls onFileSelect immediately on file selection
 * @param {ReactNode} children - Optional custom content to render below uploader (e.g., parameter controls)
 * @param {Boolean} showAnalyzeButton - Whether to show the analyze button (default: true if onAnalyze provided)
 * @param {String} analyzeButtonText - Custom text for analyze button
 */
function AudioUploader({
  onFileSelect,
  onAnalyze,
  isLoading = false,
  acceptedFormats = "audio/*",
  autoUpload = false,
  children,
  showAnalyzeButton = true,
  analyzeButtonText = "Analyze Audio",
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = (file) => {
    if (!file.type.startsWith("audio/")) {
      alert("Please select an audio file!");
      return;
    }

    setSelectedFile(file);

    // Call onFileSelect immediately
    if (onFileSelect) {
      onFileSelect(file);
    }

    // If autoUpload mode, also call onAnalyze
    if (autoUpload && onAnalyze) {
      onAnalyze(file);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) handleFile(files[0]);
  };

  const handleFileInput = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) handleFile(files[0]);
  };

  const handleClick = () => {
    fileInputRef.current.click();
  };

  return (
    <div className="audio-uploader">
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats}
        onChange={handleFileInput}
        style={{ display: "none" }}
      />

      <div
        className={`drop-zone ${isDragging ? "dragging" : ""}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        {selectedFile ? (
          <div className="file-info">
            <p>✅ Selected: {selectedFile.name}</p>
          </div>
        ) : (
          <div className="upload-prompt">
            <p>🎵 Drag & drop audio file here or click to browse</p>
          </div>
        )}
      </div>

      {/* Render custom children (e.g., parameter inputs for Doppler) */}
      {children && selectedFile && (
        <div className="uploader-children">{children}</div>
      )}

      {/* Show analyze button only if conditions are met */}
      {selectedFile && onAnalyze && showAnalyzeButton && !autoUpload && (
        <div className="analyze-button-container">
          <button
            className="btn"
            onClick={() => onAnalyze(selectedFile)}
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : analyzeButtonText}
          </button>
        </div>
      )}
    </div>
  );
}

export default AudioUploader;
