import { useEffect, useState } from "react";
import "./App.css";

function App() {
  const [backendMessage, setBackendMessage] = useState(
    "Connecting to backend..."
  );

  const [roomCode, setRoomCode] = useState("");
  const [roomMessage, setRoomMessage] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/status")
      .then((response) => response.json())
      .then((data) => {
        setBackendMessage(data.message);
      })
      .catch((error) => {
        console.error("Backend connection error:", error);
        setBackendMessage("Failed to connect to backend");
      });
  }, []);

  const createRoom = async () => {
    try {
      setIsCreatingRoom(true);
      setRoomMessage("");

      const response = await fetch(
        "http://127.0.0.1:8000/api/rooms/create",
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to create room");
      }

      setRoomCode(data.room.code);
      setRoomMessage("Room created successfully");
    } catch (error) {
      console.error("Create room error:", error);
      setRoomMessage("Failed to create room");
    } finally {
      setIsCreatingRoom(false);
    }
  };

  return (
    <main className="app">
      <section className="hero">
        <h1>Sangeet Sangai</h1>

        <p className="subtitle">
          Listen to music together, wherever you are.
        </p>
      </section>

      <section className="status-section">
        <p>
          Backend Status:
          <span className="backend-status">
            {" "}
            {backendMessage}
          </span>
        </p>
      </section>

      <section className="room-section">
        <h2>Create a Music Room</h2>

        <p>
          Create a temporary room and share the code with your friends.
        </p>

        <button
          className="create-room-button"
          onClick={createRoom}
          disabled={isCreatingRoom}
        >
          {isCreatingRoom ? "Creating..." : "Create Room"}
        </button>

        {roomMessage && (
          <p className="room-message">{roomMessage}</p>
        )}

        {roomCode && (
          <div className="room-result">
            <p>Your Room Code</p>

            <strong>{roomCode}</strong>

            <small>
              Share this code with people you want to listen with.
            </small>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;