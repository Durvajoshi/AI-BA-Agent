import React, { useState } from "react";

const PreviewApp = () => {
  const [currentView, setCurrentView] = useState("dashboard");
  const [selectedColor, setSelectedColor] = useState(null);
  const [rgbValue, setRgbValue] = useState(null);
  const [confidenceScore, setConfidenceScore] = useState(null);
  const [imageData, setImageData] = useState(null);

  const handleViewChange = (view) => {
    setCurrentView(view);
    if (view === "details") {
      setSelectedColor(null);
      setRgbValue(null);
      setConfidenceScore(null);
    }
  };

  const handleColorRecognition = () => {
    const color = "red";
    setSelectedColor(color);
    setRgbValue({ r: 255, g: 0, b: 0 });
    setConfidenceScore(0.95);
  };

  return (
    <div className="flex w-full h-screen p-4 lg:p-6 bg-gray-100">
      <header className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Color Recognizer</h1>
      </header>
      <main className="flex flex-col lg:flex-row gap-4">
        <section className="w-full lg:w-1/2 p-4 bg-white shadow-md">
          {currentView === "dashboard" && (
            <div className="flex flex-col gap-4">
              <button
                className="px-4 py-2 text-sm text-white bg-gray-800 hover:bg-gray-900 rounded-lg"
                onClick={() => handleViewChange("details")}
              >
                Details
              </button>
              <button
                className="px-4 py-2 text-sm text-gray-800 hover:text-gray-900 rounded-lg"
                onClick={handleColorRecognition}
              >
                Recognize Color
              </button>
            </div>
          )}
          {currentView === "details" && (
            <div className="flex flex-col gap-4">
              <p>
                <b>Selected Color:</b> {selectedColor}
              </p>
              <p>
                <b>RGB Value:</b>{" "}
                {rgbValue && `(${rgbValue.r}, ${rgbValue.g}, ${rgbValue.b})`}
              </p>
              <p>
                <b>Confidence Score:</b>{" "}
                {confidenceScore && Number(confidenceScore.toFixed(2))}
              </p>
            </div>
          )}
        </section>
        <section className="w-full lg:w-1/2 p-4 bg-white shadow-md">
          <h2 className="text-xl font-bold text-gray-800">Image Preview</h2>
          <input
            type="file"
            accept="image/*"
            className="block w-full px-4 py-2 text-sm text-gray-800 border border-gray-800 rounded-lg cursor-pointer"
            onChange={(e) => setImageData(e.target.files[0])}
          />
          {imageData && (
            <img
              src={URL.createObjectURL(imageData)}
              alt="Recognized Color"
              className="object-cover mx-auto w-2/3 rounded-lg shadow-md"
            />
          )}
        </section>
      </main>
    </div>
  );
};

export default PreviewApp;