import {
  useEffect,
  useRef,
  useState,
} from "react";

import "./App.css";


function App() {
  const [backendMessage, setBackendMessage] = useState(
    "Connecting to backend..."
  );

  const [displayName, setDisplayName] = useState("");

  const [roomCode, setRoomCode] = useState("");
  const [roomMessage, setRoomMessage] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  const [joinCode, setJoinCode] = useState("");
  const [joinMessage, setJoinMessage] = useState("");
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);

  const [currentRoom, setCurrentRoom] = useState("");
  const [members, setMembers] = useState([]);

  const [connectionStatus, setConnectionStatus] = useState(
    "Disconnected"
  );

  const socketRef = useRef(null);


  useEffect(() => {
    fetch(
      "http://127.0.0.1:8000/api/status"
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            "Backend status request failed"
          );
        }

        return response.json();
      })
      .then((data) => {
        setBackendMessage(
          data.message
        );
      })
      .catch((error) => {
        console.error(
          "Backend connection error:",
          error
        );

        setBackendMessage(
          "Failed to connect to backend"
        );
      });
  }, []);


  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);


  const connectToRoom = (
    code,
    name
  ) => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setMembers([]);
    setConnectionStatus(
      "Connecting..."
    );

    const socket = new WebSocket(
      `ws://127.0.0.1:8000/ws/rooms/${code}?name=${encodeURIComponent(
        name
      )}`
    );

    socketRef.current = socket;


    socket.onopen = () => {
      console.log(
        "WebSocket connected"
      );

      setCurrentRoom(
        code
      );

      setConnectionStatus(
        "Connected"
      );
    };


    socket.onmessage = (
      event
    ) => {
      try {
        const data =
          JSON.parse(
            event.data
          );

        console.log(
          "WebSocket message:",
          data
        );


        if (
          data.type ===
          "connected"
        ) {
          setCurrentRoom(
            data.room_code
          );

          setConnectionStatus(
            "Connected"
          );
        }


        if (
          data.type ===
          "members_updated"
        ) {
          setMembers(
            data.members
          );
        }


        if (
          data.type ===
          "error"
        ) {
          setJoinMessage(
            data.message
          );

          setConnectionStatus(
            "Disconnected"
          );
        }

      } catch (error) {
        console.error(
          "Failed to read WebSocket message:",
          error
        );
      }
    };


    socket.onerror = (
      error
    ) => {
      console.error(
        "WebSocket error:",
        error
      );

      setConnectionStatus(
        "Connection Error"
      );
    };


    socket.onclose = (
      event
    ) => {
      console.log(
        "WebSocket disconnected",
        event.code,
        event.reason
      );

      setConnectionStatus(
        "Disconnected"
      );
    };
  };


  const createRoom = async () => {
    const name =
      displayName.trim();

    if (!name) {
      setRoomMessage(
        "Please enter your name first"
      );

      return;
    }

    try {
      setIsCreatingRoom(
        true
      );

      setRoomMessage("");
      setRoomCode("");


      const response =
        await fetch(
          "http://127.0.0.1:8000/api/rooms/create",
          {
            method: "POST",
          }
        );


      const data =
        await response.json();


      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Failed to create room"
        );
      }


      const code =
        data.room.code;


      setRoomCode(
        code
      );

      setRoomMessage(
        "Room created successfully"
      );


      connectToRoom(
        code,
        name
      );

    } catch (error) {
      console.error(
        "Create room error:",
        error
      );

      setRoomMessage(
        "Failed to create room"
      );

    } finally {
      setIsCreatingRoom(
        false
      );
    }
  };


  const joinRoom = async () => {
    const name =
      displayName.trim();

    if (!name) {
      setJoinMessage(
        "Please enter your name first"
      );

      return;
    }


    const code =
      joinCode
        .trim()
        .toUpperCase();


    if (!code) {
      setJoinMessage(
        "Please enter a room code"
      );

      return;
    }


    try {
      setIsJoiningRoom(
        true
      );

      setJoinMessage("");


      const response =
        await fetch(
          `http://127.0.0.1:8000/api/rooms/${code}`
        );


      const data =
        await response.json();


      if (!response.ok) {
        throw new Error(
          data.detail ||
            "Room not found"
        );
      }


      setJoinMessage(
        `Joining room ${code}...`
      );


      connectToRoom(
        code,
        name
      );

    } catch (error) {
      console.error(
        "Join room error:",
        error
      );

      setJoinMessage(
        "Room not found"
      );

    } finally {
      setIsJoiningRoom(
        false
      );
    }
  };


  const leaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }

    setCurrentRoom("");
    setMembers([]);
    setConnectionStatus(
      "Disconnected"
    );

    setJoinCode("");
    setJoinMessage("");
    setRoomCode("");
    setRoomMessage("");
  };


  if (currentRoom) {
    return (
      <main className="app">

        <section className="hero">

          <h1>
            Sangeet Sangai
          </h1>

          <p className="subtitle">
            Listen to music together,
            wherever you are.
          </p>

        </section>


        <section className="active-room">

          <div className="room-header">

            <div>

              <p className="room-label">
                Current Room
              </p>

              <h2>
                {currentRoom}
              </h2>

            </div>


            <button
              className="leave-button"
              onClick={leaveRoom}
            >
              Leave Room
            </button>

          </div>


          <div className="connection-info">

            WebSocket:

            <strong>
              {" "}
              {connectionStatus}
            </strong>

          </div>


          <section className="members-section">

            <div className="members-heading">

              <h3>
                Members
              </h3>

              <span>
                {members.length}
              </span>

            </div>


            {members.length === 0 ? (

              <p className="empty-members">
                Waiting for members...
              </p>

            ) : (

              <div className="members-list">

                {members.map(
                  (member) => (

                    <div
                      className="member"
                      key={member.id}
                    >

                      <div className="member-avatar">

                        {member.name
                          .charAt(0)
                          .toUpperCase()}

                      </div>


                      <span>
                        {member.name}
                      </span>

                    </div>

                  )
                )}

              </div>

            )}

          </section>


          <section className="coming-next">

            <h3>
              Music Player
            </h3>

            <p>
              Temporary music upload
              and synchronized playback
              will be added next.
            </p>

          </section>

        </section>

      </main>
    );
  }


  return (
    <main className="app">

      <section className="hero">

        <h1>
          Sangeet Sangai
        </h1>

        <p className="subtitle">
          Listen to music together,
          wherever you are.
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


      <section className="identity-section">

        <h2>
          Your Name
        </h2>

        <p>
          Enter a name that other
          people in the room can see.
        </p>


        <input
          className="name-input"
          type="text"
          placeholder="Enter your name"
          value={displayName}
          onChange={(event) =>
            setDisplayName(
              event.target.value
            )
          }
          maxLength={30}
        />

      </section>


      <section className="room-section">

        <h2>
          Create a Music Room
        </h2>

        <p>
          Create a temporary room
          and share the code with
          your friends.
        </p>


        <button
          className="primary-button"
          onClick={createRoom}
          disabled={isCreatingRoom}
        >
          {isCreatingRoom
            ? "Creating..."
            : "Create Room"}
        </button>


        {roomMessage && (

          <p className="room-message">
            {roomMessage}
          </p>

        )}


        {roomCode && (

          <div className="room-result">

            <p>
              Your Room Code
            </p>

            <strong>
              {roomCode}
            </strong>

            <small>
              Share this code with
              people you want to
              listen with.
            </small>

          </div>

        )}

      </section>


      <section className="join-section">

        <h2>
          Join a Music Room
        </h2>

        <p>
          Enter the room code
          shared with you.
        </p>


        <div className="join-form">

          <input
            type="text"
            placeholder="Enter room code"
            value={joinCode}
            onChange={(event) =>
              setJoinCode(
                event.target.value.toUpperCase()
              )
            }
            maxLength={6}
          />


          <button
            className="primary-button"
            onClick={joinRoom}
            disabled={isJoiningRoom}
          >
            {isJoiningRoom
              ? "Joining..."
              : "Join Room"}
          </button>

        </div>


        {joinMessage && (

          <p className="join-message">
            {joinMessage}
          </p>

        )}

      </section>

    </main>
  );
}


export default App;