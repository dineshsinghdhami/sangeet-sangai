import {
  useEffect,
  useRef,
  useState,
} from "react";

import "./App.css";


const API_BASE_URL =
  "http://127.0.0.1:8000";

const WS_BASE_URL =
  "ws://127.0.0.1:8000";


function App() {
  // -------------------------------------------------------
  // BACKEND
  // -------------------------------------------------------

  const [
    backendMessage,
    setBackendMessage,
  ] = useState(
    "Connecting to backend..."
  );


  // -------------------------------------------------------
  // USER
  // -------------------------------------------------------

  const [
    displayName,
    setDisplayName,
  ] = useState("");


  // -------------------------------------------------------
  // CREATE ROOM
  // -------------------------------------------------------

  const [
    roomCode,
    setRoomCode,
  ] = useState("");

  const [
    roomMessage,
    setRoomMessage,
  ] = useState("");

  const [
    isCreatingRoom,
    setIsCreatingRoom,
  ] = useState(false);


  // -------------------------------------------------------
  // JOIN ROOM
  // -------------------------------------------------------

  const [
    joinCode,
    setJoinCode,
  ] = useState("");

  const [
    joinMessage,
    setJoinMessage,
  ] = useState("");

  const [
    isJoiningRoom,
    setIsJoiningRoom,
  ] = useState(false);


  // -------------------------------------------------------
  // ACTIVE ROOM
  // -------------------------------------------------------

  const [
    currentRoom,
    setCurrentRoom,
  ] = useState("");

  const [
    members,
    setMembers,
  ] = useState([]);

  const [
    connectionStatus,
    setConnectionStatus,
  ] = useState(
    "Disconnected"
  );


  // -------------------------------------------------------
  // MUSIC
  // -------------------------------------------------------

  const [
    selectedFile,
    setSelectedFile,
  ] = useState(null);

  const [
    uploadMessage,
    setUploadMessage,
  ] = useState("");

  const [
    isUploading,
    setIsUploading,
  ] = useState(false);

  const [
    queue,
    setQueue,
  ] = useState([]);


  // -------------------------------------------------------
  // REFS
  // -------------------------------------------------------

  const socketRef =
    useRef(null);

  const fileInputRef =
    useRef(null);


  // -------------------------------------------------------
  // CHECK BACKEND
  // -------------------------------------------------------

  useEffect(() => {

    fetch(
      `${API_BASE_URL}/api/status`
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


  // -------------------------------------------------------
  // CLEANUP WEBSOCKET
  // -------------------------------------------------------

  useEffect(() => {

    return () => {

      if (socketRef.current) {

        socketRef.current.close();

      }

    };

  }, []);


  // -------------------------------------------------------
  // CONNECT TO ROOM
  // -------------------------------------------------------

  const connectToRoom = (
    code,
    name
  ) => {

    if (socketRef.current) {

      socketRef.current.close();

      socketRef.current = null;

    }


    setMembers([]);

    setQueue([]);

    setConnectionStatus(
      "Connecting..."
    );


    const socket =
      new WebSocket(
        `${WS_BASE_URL}/ws/rooms/${code}?name=${encodeURIComponent(
          name
        )}`
      );


    socketRef.current =
      socket;


    // -----------------------------------------------------
    // OPEN
    // -----------------------------------------------------

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


    // -----------------------------------------------------
    // MESSAGE
    // -----------------------------------------------------

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


        // -----------------------------------------------
        // CONNECTED
        // -----------------------------------------------

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


        // -----------------------------------------------
        // ROOM STATE
        // -----------------------------------------------

        if (
          data.type ===
          "room_state"
        ) {

          setQueue(
            data.room.queue || []
          );

        }


        // -----------------------------------------------
        // MEMBERS
        // -----------------------------------------------

        if (
          data.type ===
          "members_updated"
        ) {

          setMembers(
            data.members
          );

        }


        // -----------------------------------------------
        // QUEUE
        // -----------------------------------------------

        if (
          data.type ===
          "queue_updated"
        ) {

          setQueue(
            data.queue
          );

        }


        // -----------------------------------------------
        // ERROR
        // -----------------------------------------------

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


    // -----------------------------------------------------
    // ERROR
    // -----------------------------------------------------

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


    // -----------------------------------------------------
    // CLOSE
    // -----------------------------------------------------

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


  // -------------------------------------------------------
  // CREATE ROOM
  // -------------------------------------------------------

  const createRoom =
    async () => {

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
            `${API_BASE_URL}/api/rooms/create`,
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


  // -------------------------------------------------------
  // JOIN ROOM
  // -------------------------------------------------------

  const joinRoom =
    async () => {

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
            `${API_BASE_URL}/api/rooms/${code}`
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


  // -------------------------------------------------------
  // SELECT AUDIO FILE
  // -------------------------------------------------------

  const handleFileChange = (
    event
  ) => {

    const file =
      event.target.files[0];


    setUploadMessage("");


    if (!file) {

      setSelectedFile(
        null
      );

      return;

    }


    const maxSize =
      25 * 1024 * 1024;


    if (
      file.size > maxSize
    ) {

      setSelectedFile(
        null
      );

      setUploadMessage(
        "File is too large. Maximum size is 25 MB."
      );


      event.target.value = "";

      return;

    }


    setSelectedFile(
      file
    );

  };


  // -------------------------------------------------------
  // UPLOAD AUDIO
  // -------------------------------------------------------

  const uploadSong =
    async () => {

      if (!selectedFile) {

        setUploadMessage(
          "Please select an audio file"
        );

        return;

      }


      if (!currentRoom) {

        setUploadMessage(
          "You are not connected to a room"
        );

        return;

      }


      try {

        setIsUploading(
          true
        );

        setUploadMessage(
          "Uploading..."
        );


        const formData =
          new FormData();


        formData.append(
          "file",
          selectedFile
        );


        formData.append(
          "uploader_name",
          displayName
        );


        const response =
          await fetch(
            `${API_BASE_URL}/api/rooms/${currentRoom}/songs`,
            {
              method: "POST",
              body: formData,
            }
          );


        const data =
          await response.json();


        if (!response.ok) {

          throw new Error(
            data.detail ||
              "Failed to upload song"
          );

        }


        setUploadMessage(
          "Song uploaded successfully"
        );


        setSelectedFile(
          null
        );


        if (
          fileInputRef.current
        ) {

          fileInputRef.current.value =
            "";

        }

      } catch (error) {

        console.error(
          "Upload error:",
          error
        );

        setUploadMessage(
          error.message ||
            "Failed to upload song"
        );

      } finally {

        setIsUploading(
          false
        );

      }

    };


  // -------------------------------------------------------
  // LEAVE ROOM
  // -------------------------------------------------------

  const leaveRoom = () => {

    if (socketRef.current) {

      socketRef.current.close();

      socketRef.current =
        null;

    }


    setCurrentRoom("");

    setMembers([]);

    setQueue([]);

    setConnectionStatus(
      "Disconnected"
    );

    setJoinCode("");

    setJoinMessage("");

    setRoomCode("");

    setRoomMessage("");

    setSelectedFile(
      null
    );

    setUploadMessage("");


    if (
      fileInputRef.current
    ) {

      fileInputRef.current.value =
        "";

    }

  };


  // -------------------------------------------------------
  // ACTIVE ROOM SCREEN
  // -------------------------------------------------------

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

              <p className="empty-message">
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


          <section className="upload-section">

            <h3>
              Add Music
            </h3>

            <p>
              Upload music temporarily
              to this room.
            </p>


            <div className="upload-controls">

              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.wav,.ogg,.m4a,audio/*"
                onChange={
                  handleFileChange
                }
              />


              <button
                className="primary-button"
                onClick={
                  uploadSong
                }
                disabled={
                  isUploading
                }
              >

                {isUploading
                  ? "Uploading..."
                  : "Upload Song"}

              </button>

            </div>


            {selectedFile && (

              <p className="selected-file">

                Selected:

                <strong>
                  {" "}
                  {selectedFile.name}
                </strong>

              </p>

            )}


            {uploadMessage && (

              <p className="upload-message">

                {uploadMessage}

              </p>

            )}

          </section>


          <section className="queue-section">

            <div className="queue-heading">

              <h3>
                Shared Queue
              </h3>

              <span>
                {queue.length}
              </span>

            </div>


            {queue.length === 0 ? (

              <p className="empty-message">

                No songs have been
                added yet.

              </p>

            ) : (

              <div className="queue-list">

                {queue.map(
                  (
                    song,
                    index
                  ) => (

                    <div
                      className="queue-item"
                      key={song.id}
                    >

                      <div className="queue-number">

                        {index + 1}

                      </div>


                      <div className="song-information">

                        <strong>
                          {song.title}
                        </strong>

                        <span>

                          Uploaded by{" "}

                          {song.uploaded_by}

                        </span>

                        <small>

                          {(
                            song.size_bytes
                            /
                            1024
                            /
                            1024
                          ).toFixed(2)}{" "}

                          MB

                        </small>

                      </div>

                    </div>

                  )
                )}

              </div>

            )}

          </section>


          <section className="coming-next">

            <h3>
              Synchronized Player
            </h3>

            <p>
              The shared queue is now
              real-time. Play, pause,
              seek and synchronized
              playback will be added
              in the next stage.
            </p>

          </section>

        </section>

      </main>

    );

  }


  // -------------------------------------------------------
  // HOME SCREEN
  // -------------------------------------------------------

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
          onClick={
            createRoom
          }
          disabled={
            isCreatingRoom
          }
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
            onClick={
              joinRoom
            }
            disabled={
              isJoiningRoom
            }
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