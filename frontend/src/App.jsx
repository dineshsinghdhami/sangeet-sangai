import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [message, setMessage] = useState("Connecting to backend...");

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/status")
      .then((response) => response.json())
      .then((data) => {
        setMessage(data.message);
      })
      .catch((error) => {
        console.error("Backend connection error:", error);
        setMessage("Failed to connect to backend");
      });
  }, []);

  return (
    <main>
      <h1>Sangeet Sangai</h1>
      <p>Real-Time Synchronized Music Platform</p>

      <h2>Backend Status</h2>
      <p>{message}</p>
    </main>
  );
}

export default App;