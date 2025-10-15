// import { useState, useRef } from "react";
// import "./Audio.css";

// function AudioUploader({ onFileSelect }) { //prop
//   const [selectedFile, setSelectedFile] = useState(null);
//   const [isDragging, setIsDragging] = useState(false);
//   const fileInputRef = useRef(null); // for hidden input button

//   const handleDragEnter = (e) => {
//     e.preventDefault(); // don't open the file in anew page
//     e.stopPropagation(); // not send to parent
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
//     if (files && files.length > 0) {
//       handleFile(files[0]);
//     }
//   };

//   const handleFileInput = (e) => {
//     const files = e.target.files;
//     if (files && files.length > 0) {
//       handleFile(files[0]);
//     }
//   };

//   const handleFile = (file) => {
//     if (!file.type.startsWith("audio/")) {
//       alert("Please select an audio file!");
//       return;
//     }

//     setSelectedFile(file);
//     onFileSelect(file);
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
//             <p className="file-size">
//               {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
//             </p>
//           </div>
//         ) : (
//           <div className="upload-prompt">
//             <p>🎵 Drag & drop audio file here</p>
//             <p>or click to browse</p>
//             <span className="supported-formats">Supported: MP3, WAV, OGG</span>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }

// export default AudioUploader;
import { useState, useRef } from "react";
import "./Audio.css";

// Props now include onAnalyze and isLoading
function AudioUploader({ onFileSelect, onAnalyze, isLoading }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = (file) => {
    if (!file.type.startsWith("audio/")) {
      alert("Please select an audio file!");
      return;
    }
    setSelectedFile(file);
    onFileSelect(file);
  };

  // ... (all other handler functions like handleDrop, handleClick, etc. are the same)
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
        accept="audio/*"
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

      {selectedFile && (
        <div className="analyze-button-container">
          <button className="btn" onClick={onAnalyze} disabled={isLoading}>
            {isLoading ? "Analyzing..." : "Analyze Audio"}
          </button>
        </div>
      )}
    </div>
  );
}

export default AudioUploader;
