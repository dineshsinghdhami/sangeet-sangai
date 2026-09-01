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
  // =====================================================
  // BACKEND
  // =====================================================

  const [
    backendMessage,
    setBackendMessage,
  ] = useState(
    "Connecting to backend..."
  );


  // =====================================================
  // USER
  // =====================================================

  const [
    displayName,
    setDisplayName,
  ] = useState("");


  // =====================================================
  // CREATE ROOM
  // =====================================================

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


  // =====================================================
  // JOIN ROOM
  // =====================================================

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


  // =====================================================
  // ACTIVE ROOM
  // =====================================================

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


  // =====================================================
  // MUSIC UPLOAD
  // =====================================================

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


  // =====================================================
  // SHARED QUEUE
  // =====================================================

  const [
    queue,
    setQueue,
  ] = useState([]);


  // =====================================================
  // AUDIO PLAYER
  // =====================================================

  const [
    currentSong,
    setCurrentSong,
  ] = useState(null);

  const [
    isPlaying,
    setIsPlaying,
  ] = useState(false);

  const [
    currentTime,
    setCurrentTime,
  ] = useState(0);

  const [
    duration,
    setDuration,
  ] = useState(0);

  const [
    playerMessage,
    setPlayerMessage,
  ] = useState("");


  // =====================================================
  // REFERENCES
  // =====================================================

  const socketRef =
    useRef(null);

  const fileInputRef =
    useRef(null);

  const audioRef =
    useRef(null);


  // =====================================================
  // BACKEND STATUS
  // =====================================================

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


  // =====================================================
  // CLEAN UP WEBSOCKET
  // =====================================================

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);


  // =====================================================
  // FORMAT AUDIO TIME
  // =====================================================

  const formatTime = (
    seconds
  ) => {
    if (
      !Number.isFinite(seconds)
      ||
      seconds < 0
    ) {
      return "0:00";
    }

    const minutes =
      Math.floor(
        seconds / 60
      );

    const remainingSeconds =
      Math.floor(
        seconds % 60
      );

    return `${minutes}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };


  // =====================================================
  // CONNECT TO ROOM
  // =====================================================

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
    setCurrentSong(null);

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


    // ---------------------------------------------------
    // OPEN
    // ---------------------------------------------------

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


    // ---------------------------------------------------
    // MESSAGE
    // ---------------------------------------------------

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
        // INITIAL ROOM STATE
        // -----------------------------------------------

        if (
          data.type ===
          "room_state"
        ) {
          const roomQueue =
            data.room.queue || [];

          setQueue(
            roomQueue
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


    // ---------------------------------------------------
    // ERROR
    // ---------------------------------------------------

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


    // ---------------------------------------------------
    // CLOSE
    // ---------------------------------------------------

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


  // =====================================================
  // CREATE ROOM
  // =====================================================

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


  // =====================================================
  // JOIN ROOM
  // =====================================================

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


  // =====================================================
  // SELECT FILE
  // =====================================================

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

      event.target.value =
        "";

      return;
    }


    setSelectedFile(
      file
    );
  };


  // =====================================================
  // UPLOAD SONG
  // =====================================================

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


  // =====================================================
  // LOAD SONG INTO PLAYER
  // =====================================================

  const loadSong = (
    song
  ) => {
    if (!song) {
      return;
    }


    const audio =
      audioRef.current;


    if (
      audio
      &&
      !audio.paused
    ) {
      audio.pause();
    }


    setCurrentSong(
      song
    );

    setIsPlaying(
      false
    );

    setCurrentTime(
      0
    );

    setDuration(
      0
    );

    setPlayerMessage(
      `Loaded "${song.title}"`
    );
  };


  // =====================================================
  // PLAY / PAUSE
  // =====================================================

  const togglePlayPause =
    async () => {
      if (!currentSong) {
        setPlayerMessage(
          "Select a song from the queue first"
        );

        return;
      }


      const audio =
        audioRef.current;


      if (!audio) {
        return;
      }


      try {
        if (audio.paused) {
          await audio.play();

          setIsPlaying(
            true
          );

          setPlayerMessage(
            ""
          );

        } else {
          audio.pause();

          setIsPlaying(
            false
          );
        }

      } catch (error) {
        console.error(
          "Audio playback error:",
          error
        );

        setPlayerMessage(
          "Unable to play this audio file"
        );
      }
    };


  // =====================================================
  // SEEK
  // =====================================================

  const handleSeek = (
    event
  ) => {
    const value =
      Number(
        event.target.value
      );


    const audio =
      audioRef.current;


    if (!audio) {
      return;
    }


    audio.currentTime =
      value;


    setCurrentTime(
      value
    );
  };


  // =====================================================
  // PREVIOUS SONG
  // =====================================================

  const playPreviousSong =
    () => {
      if (
        queue.length === 0
      ) {
        return;
      }


      if (!currentSong) {
        loadSong(
          queue[0]
        );

        return;
      }


      const currentIndex =
        queue.findIndex(
          (song) =>
            song.id ===
            currentSong.id
        );


      if (
        currentIndex <= 0
      ) {
        loadSong(
          queue[
            queue.length - 1
          ]
        );

        return;
      }


      loadSong(
        queue[
          currentIndex - 1
        ]
      );
    };


  // =====================================================
  // NEXT SONG
  // =====================================================

  const playNextSong =
    () => {
      if (
        queue.length === 0
      ) {
        return;
      }


      if (!currentSong) {
        loadSong(
          queue[0]
        );

        return;
      }


      const currentIndex =
        queue.findIndex(
          (song) =>
            song.id ===
            currentSong.id
        );


      if (
        currentIndex === -1
        ||
        currentIndex ===
          queue.length - 1
      ) {
        loadSong(
          queue[0]
        );

        return;
      }


      loadSong(
        queue[
          currentIndex + 1
        ]
      );
    };


  // =====================================================
  // AUDIO METADATA
  // =====================================================

  const handleLoadedMetadata =
    () => {
      const audio =
        audioRef.current;


      if (!audio) {
        return;
      }


      setDuration(
        Number.isFinite(
          audio.duration
        )
          ? audio.duration
          : 0
      );
    };


  // =====================================================
  // AUDIO TIME UPDATE
  // =====================================================

  const handleTimeUpdate =
    () => {
      const audio =
        audioRef.current;


      if (!audio) {
        return;
      }


      setCurrentTime(
        audio.currentTime
      );
    };


  // =====================================================
  // AUDIO PLAY
  // =====================================================

  const handleAudioPlay =
    () => {
      setIsPlaying(
        true
      );
  };


  // =====================================================
  // AUDIO PAUSE
  // =====================================================

  const handleAudioPause =
    () => {
      setIsPlaying(
        false
      );
  };


  // =====================================================
  // SONG FINISHED
  // =====================================================

  const handleSongEnded =
    () => {
      setIsPlaying(
        false
      );


      if (
        queue.length > 1
      ) {
        playNextSong();
      }
    };


  // =====================================================
  // AUDIO ERROR
  // =====================================================

  const handleAudioError =
    () => {
      setIsPlaying(
        false
      );

      setPlayerMessage(
        "Could not load this audio file"
      );
  };


  // =====================================================
  // LEAVE ROOM
  // =====================================================

  const leaveRoom =
    () => {
      if (socketRef.current) {
        socketRef.current.close();

        socketRef.current =
          null;
      }


      if (
        audioRef.current
      ) {
        audioRef.current.pause();

        audioRef.current.currentTime =
          0;
      }


      setCurrentRoom("");

      setMembers([]);

      setQueue([]);

      setCurrentSong(
        null
      );

      setIsPlaying(
        false
      );

      setCurrentTime(
        0
      );

      setDuration(
        0
      );

      setPlayerMessage("");

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


  // =====================================================
  // ACTIVE ROOM SCREEN
  // =====================================================

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


          {/* =============================================
              MEMBERS
          ============================================= */}

          <section className="members-section">

            <div className="section-heading">

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


          {/* =============================================
              UPLOAD
          ============================================= */}

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


          {/* =============================================
              PLAYER
          ============================================= */}

          <section className="player-section">

            <div className="section-heading">

              <h3>
                Music Player
              </h3>

            </div>


            {!currentSong ? (

              <div className="player-empty">

                <p>
                  Select a song from
                  the shared queue to
                  start listening.
                </p>

              </div>

            ) : (

              <div className="player">

                <div className="now-playing">

                  <div className="music-icon">
                    ♪
                  </div>


                  <div className="now-playing-info">

                    <small>
                      Now Playing
                    </small>

                    <strong>
                      {currentSong.title}
                    </strong>

                    <span>
                      Uploaded by{" "}
                      {currentSong.uploaded_by}
                    </span>

                  </div>

                </div>


                <audio
                  ref={audioRef}
                  src={
                    `${API_BASE_URL}${currentSong.url}`
                  }
                  preload="metadata"
                  onLoadedMetadata={
                    handleLoadedMetadata
                  }
                  onTimeUpdate={
                    handleTimeUpdate
                  }
                  onPlay={
                    handleAudioPlay
                  }
                  onPause={
                    handleAudioPause
                  }
                  onEnded={
                    handleSongEnded
                  }
                  onError={
                    handleAudioError
                  }
                />


                <div className="progress-area">

                  <span>
                    {formatTime(
                      currentTime
                    )}
                  </span>


                  <input
                    className="seek-slider"
                    type="range"
                    min="0"
                    max={
                      duration || 0
                    }
                    step="0.1"
                    value={
                      Math.min(
                        currentTime,
                        duration || 0
                      )
                    }
                    onChange={
                      handleSeek
                    }
                    disabled={
                      !duration
                    }
                  />


                  <span>
                    {formatTime(
                      duration
                    )}
                  </span>

                </div>


                <div className="player-controls">

                  <button
                    className="control-button"
                    onClick={
                      playPreviousSong
                    }
                    disabled={
                      queue.length === 0
                    }
                    title="Previous song"
                  >
                    Previous
                  </button>


                  <button
                    className="play-button"
                    onClick={
                      togglePlayPause
                    }
                  >

                    {isPlaying
                      ? "Pause"
                      : "Play"}

                  </button>


                  <button
                    className="control-button"
                    onClick={
                      playNextSong
                    }
                    disabled={
                      queue.length === 0
                    }
                    title="Next song"
                  >
                    Next
                  </button>

                </div>

              </div>

            )}


            {playerMessage && (

              <p className="player-message">
                {playerMessage}
              </p>

            )}

          </section>


          {/* =============================================
              QUEUE
          ============================================= */}

          <section className="queue-section">

            <div className="section-heading">

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
                  ) => {

                    const isCurrent =
                      currentSong?.id ===
                      song.id;


                    return (

                      <button
                        type="button"
                        className={
                          isCurrent
                            ? "queue-item queue-item-active"
                            : "queue-item"
                        }
                        key={song.id}
                        onClick={() =>
                          loadSong(
                            song
                          )
                        }
                      >

                        <div className="queue-number">

                          {isCurrent
                            ? "♪"
                            : index + 1}

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


                        <span className="queue-action">

                          {isCurrent
                            ? "Selected"
                            : "Select"}

                        </span>

                      </button>

                    );

                  }
                )}

              </div>

            )}

          </section>


          <section className="stage-note">

            <h3>
              Current Stage
            </h3>

            <p>
              Playback is currently
              local to each browser.
              Real-time synchronized
              play, pause, seek and
              song changes will be
              added next.
            </p>

          </section>

        </section>

      </main>
    );
  }


  // =====================================================
  // HOME SCREEN
  // =====================================================

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