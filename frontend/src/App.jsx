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


const DRIFT_CHECK_INTERVAL =
  3000;

const SOFT_DRIFT_THRESHOLD =
  0.25;

const HARD_DRIFT_THRESHOLD =
  1.0;


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
  // ROOM
  // =====================================================

  const [
    roomMessage,
    setRoomMessage,
  ] = useState("");

  const [
    isCreatingRoom,
    setIsCreatingRoom,
  ] = useState(false);

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
  // UPLOAD
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
  // MUSIC
  // =====================================================

  const [
    queue,
    setQueue,
  ] = useState([]);

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

  const [
    syncQuality,
    setSyncQuality,
  ] = useState(
    "Synchronizing..."
  );


  // =====================================================
  // REFERENCES
  // =====================================================

  const socketRef =
    useRef(null);

  const audioRef =
    useRef(null);

  const fileInputRef =
    useRef(null);

  const queueRef =
    useRef([]);

  const currentSongRef =
    useRef(null);

  const playbackStateRef =
    useRef({
      current_song: null,
      is_playing: false,
      position: 0,
      playback_started_at: null,
    });

  const clockOffsetRef =
    useRef(0);

  const clockSamplesRef =
    useRef([]);

  const scheduledActionRef =
    useRef(null);

  const driftIntervalRef =
    useRef(null);

  const clockSyncIntervalRef =
    useRef(null);


  // =====================================================
  // REF UPDATES
  // =====================================================

  useEffect(() => {
    queueRef.current =
      queue;
  }, [queue]);


  useEffect(() => {
    currentSongRef.current =
      currentSong;
  }, [currentSong]);


  // =====================================================
  // BACKEND STATUS
  // =====================================================

  useEffect(() => {
    fetch(
      `${API_BASE_URL}/api/status`
    )
      .then(
        (response) => {
          if (!response.ok) {
            throw new Error(
              "Backend unavailable"
            );
          }

          return response.json();
        }
      )

      .then(
        (data) => {
          setBackendMessage(
            data.message
          );
        }
      )

      .catch(
        (error) => {
          console.error(
            "Backend error:",
            error
          );

          setBackendMessage(
            "Failed to connect to backend"
          );
        }
      );
  }, []);


  // =====================================================
  // CLEANUP
  // =====================================================

  useEffect(() => {
    return () => {
      if (
        socketRef.current
      ) {
        socketRef.current.close();
      }

      if (
        scheduledActionRef.current
      ) {
        clearTimeout(
          scheduledActionRef.current
        );
      }

      if (
        driftIntervalRef.current
      ) {
        clearInterval(
          driftIntervalRef.current
        );
      }

      if (
        clockSyncIntervalRef.current
      ) {
        clearInterval(
          clockSyncIntervalRef.current
        );
      }
    };
  }, []);


  // =====================================================
  // FORMAT TIME
  // =====================================================

  const formatTime = (
    seconds
  ) => {
    if (
      !Number.isFinite(
        seconds
      )
      ||
      seconds < 0
    ) {
      return "0:00";
    }

    const minutes =
      Math.floor(
        seconds / 60
      );

    const secondPart =
      Math.floor(
        seconds % 60
      );

    return `${minutes}:${secondPart
      .toString()
      .padStart(
        2,
        "0"
      )}`;
  };


  // =====================================================
  // ESTIMATED SERVER TIME
  // =====================================================

  const getEstimatedServerTime =
    () => {
      return (
        Date.now() / 1000
        +
        clockOffsetRef.current
      );
    };


  // =====================================================
  // SEND EVENT
  // =====================================================

  const sendRoomEvent = (
    event
  ) => {
    const socket =
      socketRef.current;

    if (
      !socket
      ||
      socket.readyState
      !== WebSocket.OPEN
    ) {
      return false;
    }

    socket.send(
      JSON.stringify(
        event
      )
    );

    return true;
  };


  // =====================================================
  // CLOCK SYNC REQUEST
  // =====================================================

  const sendClockSyncRequest =
    () => {
      sendRoomEvent(
        {
          type:
            "sync_request",

          client_time:
            Date.now() / 1000,
        }
      );
    };


  // =====================================================
  // PROCESS CLOCK SYNC
  // =====================================================

  const processClockSync = (
    data
  ) => {
    const clientReceiveTime =
      Date.now() / 1000;

    const clientSendTime =
      Number(
        data.client_time
      );

    const serverTime =
      Number(
        data.server_time
      );

    if (
      !Number.isFinite(
        clientSendTime
      )
      ||
      !Number.isFinite(
        serverTime
      )
    ) {
      return;
    }

    const roundTripTime =
      clientReceiveTime
      -
      clientSendTime;

    const midpoint =
      clientSendTime
      +
      roundTripTime / 2;

    const estimatedOffset =
      serverTime
      -
      midpoint;

    clockSamplesRef.current.push(
      estimatedOffset
    );

    if (
      clockSamplesRef.current
        .length > 7
    ) {
      clockSamplesRef.current.shift();
    }

    const sortedSamples =
      [
        ...clockSamplesRef.current
      ].sort(
        (a, b) =>
          a - b
      );

    const middle =
      Math.floor(
        sortedSamples.length / 2
      );

    const medianOffset =
      sortedSamples[
        middle
      ];

    clockOffsetRef.current =
      medianOffset;

    if (
      roundTripTime < 0.1
    ) {
      setSyncQuality(
        "Excellent"
      );

    } else if (
      roundTripTime < 0.25
    ) {
      setSyncQuality(
        "Good"
      );

    } else {
      setSyncQuality(
        "Network delay detected"
      );
    }
  };


  // =====================================================
  // FIND SONG
  // =====================================================

  const findSongById = (
    songId
  ) => {
    return (
      queueRef.current.find(
        (song) =>
          song.id === songId
      )
      ||
      null
    );
  };


  // =====================================================
  // WAIT FOR AUDIO ELEMENT
  // =====================================================

  const waitForAudioElement =
    async () => {
      for (
        let index = 0;
        index < 30;
        index += 1
      ) {
        if (
          audioRef.current
        ) {
          return audioRef.current;
        }

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              20
            )
        );
      }

      return null;
    };


  // =====================================================
  // WAIT FOR AUDIO METADATA
  // =====================================================

  const waitForAudioReady =
    async (
      audio
    ) => {
      if (
        audio.readyState >= 1
      ) {
        return;
      }

      await new Promise(
        (resolve) => {
          let finished =
            false;

          const finish = () => {
            if (finished) {
              return;
            }

            finished = true;

            audio.removeEventListener(
              "loadedmetadata",
              finish
            );

            resolve();
          };

          audio.addEventListener(
            "loadedmetadata",
            finish,
            {
              once: true,
            }
          );

          setTimeout(
            finish,
            1500
          );
        }
      );
    };


  // =====================================================
  // EXPECTED PLAYBACK POSITION
  // =====================================================

  const getExpectedPosition =
    (
      playbackState
    ) => {
      let position =
        Number(
          playbackState.position
          ||
          0
        );

      if (
        !playbackState
          .is_playing
      ) {
        return Math.max(
          0,
          position
        );
      }

      const startedAt =
        Number(
          playbackState
            .playback_started_at
        );

      if (
        !Number.isFinite(
          startedAt
        )
      ) {
        return Math.max(
          0,
          position
        );
      }

      const serverNow =
        getEstimatedServerTime();

      const elapsed =
        Math.max(
          0,
          serverNow
          -
          startedAt
        );

      position += elapsed;

      return Math.max(
        0,
        position
      );
    };


  // =====================================================
  // APPLY SERVER PLAYBACK STATE
  // =====================================================

  const applyPlaybackState =
    async (
      data
    ) => {
      playbackStateRef.current =
        {
          current_song:
            data.current_song,

          is_playing:
            Boolean(
              data.is_playing
            ),

          position:
            Number(
              data.position
              ||
              0
            ),

          playback_started_at:
            data.playback_started_at,
        };


      const song =
        findSongById(
          data.current_song
        );


      if (!song) {
        return;
      }


      const songChanged =
        currentSongRef.current
          ?.id
        !==
        song.id;


      if (songChanged) {
        if (
          audioRef.current
        ) {
          audioRef.current.pause();
        }

        setCurrentSong(
          song
        );

        currentSongRef.current =
          song;

        setCurrentTime(
          0
        );

        setDuration(
          0
        );
      }


      const audio =
        await waitForAudioElement();


      if (!audio) {
        setPlayerMessage(
          "Unable to initialize player"
        );

        return;
      }


      if (songChanged) {
        audio.load();

        await waitForAudioReady(
          audio
        );
      }


      if (
        scheduledActionRef.current
      ) {
        clearTimeout(
          scheduledActionRef.current
        );

        scheduledActionRef.current =
          null;
      }


      const executeAt =
        Number(
          data.execute_at
        );


      const executeAction =
        async () => {
          const activeAudio =
            audioRef.current;

          if (!activeAudio) {
            return;
          }


          let targetPosition =
            getExpectedPosition(
              playbackStateRef.current
            );


          if (
            Number.isFinite(
              activeAudio.duration
            )
            &&
            activeAudio.duration > 0
          ) {
            targetPosition =
              Math.min(
                targetPosition,
                activeAudio.duration
              );
          }


          try {
            activeAudio.currentTime =
              Math.max(
                0,
                targetPosition
              );

          } catch (error) {
            console.warn(
              "Seek failed:",
              error
            );
          }


          setCurrentTime(
            targetPosition
          );


          if (
            playbackStateRef
              .current
              .is_playing
          ) {
            try {
              await activeAudio.play();

              setIsPlaying(
                true
              );

              setPlayerMessage(
                ""
              );

            } catch (error) {
              console.error(
                "Playback blocked:",
                error
              );

              setIsPlaying(
                false
              );

              setPlayerMessage(
                "Browser blocked automatic playback. Click Play once on this device."
              );
            }

          } else {
            activeAudio.pause();

            setIsPlaying(
              false
            );
          }
        };


      if (
        Number.isFinite(
          executeAt
        )
      ) {
        const serverNow =
          getEstimatedServerTime();

        const delayMs =
          Math.max(
            0,
            (
              executeAt
              -
              serverNow
            )
            *
            1000
          );


        if (
          delayMs > 10
        ) {
          scheduledActionRef.current =
            setTimeout(
              executeAction,
              delayMs
            );

        } else {
          await executeAction();
        }

      } else {
        await executeAction();
      }
    };


  // =====================================================
  // DRIFT CORRECTION
  // =====================================================

  const correctPlaybackDrift =
    () => {
      const audio =
        audioRef.current;

      const state =
        playbackStateRef.current;


      if (
        !audio
        ||
        !state.is_playing
        ||
        !state.current_song
        ||
        audio.paused
      ) {
        return;
      }


      let expectedPosition =
        getExpectedPosition(
          state
        );


      if (
        Number.isFinite(
          audio.duration
        )
        &&
        audio.duration > 0
      ) {
        expectedPosition =
          Math.min(
            expectedPosition,
            audio.duration
          );
      }


      const drift =
        expectedPosition
        -
        audio.currentTime;


      if (
        Math.abs(
          drift
        )
        >
        DRIFT_CORRECTION_THRESHOLD
      ) {
        console.log(
          "Correcting playback drift:",
          drift
        );

        try {
          audio.currentTime =
            expectedPosition;

          setCurrentTime(
            expectedPosition
          );

        } catch (error) {
          console.warn(
            "Drift correction failed:",
            error
          );
        }
      }
    };


  // =====================================================
  // START SYNC SERVICES
  // =====================================================

  const startSynchronization =
    () => {
      if (
        driftIntervalRef.current
      ) {
        clearInterval(
          driftIntervalRef.current
        );
      }

      if (
        clockSyncIntervalRef.current
      ) {
        clearInterval(
          clockSyncIntervalRef.current
        );
      }


      // Multiple samples initially.
      sendClockSyncRequest();

      setTimeout(
        sendClockSyncRequest,
        200
      );

      setTimeout(
        sendClockSyncRequest,
        400
      );

      setTimeout(
        sendClockSyncRequest,
        600
      );

      setTimeout(
        sendClockSyncRequest,
        800
      );


      // Refresh clock offset.
      clockSyncIntervalRef.current =
        setInterval(
          sendClockSyncRequest,
          10000
        );


      // Fix playback drift.
      driftIntervalRef.current =
        setInterval(
          correctPlaybackDrift,
          DRIFT_CHECK_INTERVAL
        );
    };


  // =====================================================
  // CONNECT ROOM
  // =====================================================

  const connectToRoom =
    (
      code,
      name
    ) => {
      if (
        socketRef.current
      ) {
        socketRef.current.close();
      }


      setMembers([]);

      setQueue([]);

      queueRef.current =
        [];

      setCurrentSong(
        null
      );

      currentSongRef.current =
        null;

      setIsPlaying(
        false
      );

      setCurrentTime(
        0
      );

      setDuration(
        0
      );

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


      socket.onopen =
        () => {
          setCurrentRoom(
            code
          );

          setConnectionStatus(
            "Connected"
          );

          startSynchronization();
        };


      socket.onmessage =
        async (
          event
        ) => {
          try {
            const data =
              JSON.parse(
                event.data
              );


            if (
              data.type ===
              "sync_response"
            ) {
              processClockSync(
                data
              );

              return;
            }


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
              "room_state"
            ) {
              const roomQueue =
                data.room.queue
                ||
                [];


              setQueue(
                roomQueue
              );

              queueRef.current =
                roomQueue;


              if (
                data.room
                  .current_song
              ) {
                await applyPlaybackState(
                  {
                    current_song:
                      data.room
                        .current_song,

                    is_playing:
                      data.room
                        .is_playing,

                    position:
                      data.room
                        .current_position,

                    playback_started_at:
                      data.room
                        .playback_started_at,

                    execute_at:
                      null,
                  }
                );
              }
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
              "queue_updated"
            ) {
              setQueue(
                data.queue
              );

              queueRef.current =
                data.queue;
            }


            if (
              data.type ===
              "playback_state"
            ) {
              await applyPlaybackState(
                data
              );
            }


            if (
              data.type ===
              "error"
            ) {
              setJoinMessage(
                data.message
              );
            }

          } catch (error) {
            console.error(
              "WebSocket message error:",
              error
            );
          }
        };


      socket.onerror =
        (error) => {
          console.error(
            "WebSocket error:",
            error
          );

          setConnectionStatus(
            "Connection Error"
          );
        };


      socket.onclose =
        () => {
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


        const response =
          await fetch(
            `${API_BASE_URL}/api/rooms/create`,
            {
              method:
                "POST",
            }
          );


        const data =
          await response.json();


        if (!response.ok) {
          throw new Error(
            data.detail
          );
        }


        connectToRoom(
          data.room.code,
          name
        );

      } catch (error) {
        console.error(
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

      const code =
        joinCode
          .trim()
          .toUpperCase();


      if (!name) {
        setJoinMessage(
          "Please enter your name first"
        );

        return;
      }


      if (!code) {
        setJoinMessage(
          "Please enter room code"
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
            data.detail
          );
        }


        connectToRoom(
          code,
          name
        );

      } catch (error) {
        console.error(
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
  // FILE SELECTION
  // =====================================================

  const handleFileChange =
    (
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
        25
        *
        1024
        *
        1024;


      if (
        file.size > maxSize
      ) {
        setUploadMessage(
          "Maximum file size is 25 MB."
        );

        setSelectedFile(
          null
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
  // UPLOAD
  // =====================================================

  const uploadSong =
    async () => {
      if (!selectedFile) {
        setUploadMessage(
          "Please select a song"
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
              method:
                "POST",

              body:
                formData,
            }
          );


        const data =
          await response.json();


        if (!response.ok) {
          throw new Error(
            data.detail
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
          error
        );

        setUploadMessage(
          error.message
          ||
          "Upload failed"
        );

      } finally {
        setIsUploading(
          false
        );
      }
    };


  // =====================================================
  // PLAYER COMMANDS
  // =====================================================

  const selectSong =
    (song) => {
      sendRoomEvent(
        {
          type:
            "select_song",

          song_id:
            song.id,
        }
      );
    };


  const togglePlayPause =
    () => {
      if (!currentSong) {
        setPlayerMessage(
          "Select a song first"
        );

        return;
      }


      const audio =
        audioRef.current;


      if (!audio) {
        return;
      }


      if (isPlaying) {
        sendRoomEvent(
          {
            type:
              "pause",
          }
        );

      } else {
        sendRoomEvent(
          {
            type:
              "play",

            song_id:
              currentSong.id,

            position:
              audio.currentTime,
          }
        );
      }
    };


  const handleSeek =
    (
      event
    ) => {
      if (!currentSong) {
        return;
      }


      const position =
        Number(
          event.target.value
        );


      setCurrentTime(
        position
      );


      sendRoomEvent(
        {
          type:
            "seek",

          song_id:
            currentSong.id,

          position,
        }
      );
    };


  const playNextSong =
    () => {
      sendRoomEvent(
        {
          type:
            "next",
        }
      );
    };


  const playPreviousSong =
    () => {
      sendRoomEvent(
        {
          type:
            "previous",
        }
      );
    };


  // =====================================================
  // AUDIO EVENTS
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
          ?
          audio.duration
          :
          0
      );
    };


  const handleTimeUpdate =
    () => {
      if (
        !audioRef.current
      ) {
        return;
      }

      setCurrentTime(
        audioRef.current
          .currentTime
      );
    };


  const handleAudioPlay =
    () => {
      setIsPlaying(
        true
      );
    };


  const handleAudioPause =
    () => {
      setIsPlaying(
        false
      );
    };


  const handleAudioError =
    () => {
      setIsPlaying(
        false
      );

      setPlayerMessage(
        "Unable to load audio"
      );
    };


  const handleSongEnded =
    () => {
      sendRoomEvent(
        {
          type:
            "next",
        }
      );
    };


  // =====================================================
  // LEAVE
  // =====================================================

  const leaveRoom =
    () => {
      if (
        scheduledActionRef.current
      ) {
        clearTimeout(
          scheduledActionRef.current
        );
      }

      if (
        driftIntervalRef.current
      ) {
        clearInterval(
          driftIntervalRef.current
        );
      }

      if (
        clockSyncIntervalRef.current
      ) {
        clearInterval(
          clockSyncIntervalRef.current
        );
      }

      if (
        socketRef.current
      ) {
        socketRef.current.close();

        socketRef.current =
          null;
      }

      if (
        audioRef.current
      ) {
        audioRef.current.pause();
      }


      setCurrentRoom("");

      setMembers([]);

      setQueue([]);

      queueRef.current =
        [];

      setCurrentSong(
        null
      );

      currentSongRef.current =
        null;

      setIsPlaying(
        false
      );

      setCurrentTime(
        0
      );

      setDuration(
        0
      );

      setUploadMessage("");

      setPlayerMessage("");

      setConnectionStatus(
        "Disconnected"
      );

      setSyncQuality(
        "Synchronizing..."
      );
    };


  // =====================================================
  // ROOM SCREEN
  // =====================================================

  if (currentRoom) {
    return (
      <main className="app">

        <section className="hero">

          <h1>
            Sangeet Sangai
          </h1>

          <p className="subtitle">
            Listen together,
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
              onClick={
                leaveRoom
              }
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

            {" · "}

            Sync:

            <strong>
              {" "}
              {syncQuality}
            </strong>

          </div>


          <section className="members-section">

            <div className="section-heading">

              <h3>
                Members
              </h3>

              <span>
                {members.length}
              </span>

            </div>


            <div className="members-list">

              {members.map(
                (member) => (

                  <div
                    className="member"
                    key={
                      member.id
                    }
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

          </section>


          <section className="upload-section">

            <h3>
              Add Music
            </h3>

            <p>
              Uploaded music exists
              only temporarily.
            </p>


            <div className="upload-controls">

              <input
                ref={
                  fileInputRef
                }

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
                  ?
                  "Uploading..."
                  :
                  "Upload Song"}

              </button>

            </div>


            {uploadMessage && (

              <p className="upload-message">
                {uploadMessage}
              </p>

            )}

          </section>


          <section className="player-section">

            <div className="section-heading">

              <h3>
                Synchronized Player
              </h3>

              <span className="sync-badge">
                LIVE
              </span>

            </div>


            {!currentSong ? (

              <div className="player-empty">

                <p>
                  Select a song from
                  the shared queue.
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

                      {
                        currentSong
                          .uploaded_by
                      }

                    </span>

                  </div>

                </div>


                <audio
                  ref={
                    audioRef
                  }

                  src={
                    `${API_BASE_URL}${currentSong.url}`
                  }

                  preload="auto"

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
                      ?
                      "Pause"
                      :
                      "Play"}

                  </button>


                  <button
                    className="control-button"

                    onClick={
                      playNextSong
                    }

                    disabled={
                      queue.length === 0
                    }
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
                No songs added yet.
              </p>

            ) : (

              <div className="queue-list">

                {queue.map(
                  (
                    song,
                    index
                  ) => {

                    const selected =
                      currentSong?.id
                      ===
                      song.id;


                    return (

                      <button
                        type="button"

                        key={
                          song.id
                        }

                        className={
                          selected
                            ?
                            "queue-item queue-item-active"
                            :
                            "queue-item"
                        }

                        onClick={() =>
                          selectSong(
                            song
                          )
                        }
                      >

                        <div className="queue-number">

                          {selected
                            ?
                            "♪"
                            :
                            index + 1}

                        </div>


                        <div className="song-information">

                          <strong>
                            {song.title}
                          </strong>

                          <span>

                            Uploaded by{" "}

                            {
                              song.uploaded_by
                            }

                          </span>

                        </div>


                        <span className="queue-action">

                          {selected
                            ?
                            "Selected"
                            :
                            "Select"}

                        </span>

                      </button>

                    );

                  }
                )}

              </div>

            )}

          </section>


          <section className="sync-note">

            <strong>
              Precision synchronization active
            </strong>

            <p>
              Playback uses server-time
              scheduling and automatic drift
              correction to keep connected
              players aligned.
            </p>

          </section>

        </section>

      </main>
    );
  }


  // =====================================================
  // HOME
  // =====================================================

  return (
    <main className="app">

      <section className="hero">

        <h1>
          Sangeet Sangai
        </h1>

        <p className="subtitle">
          Listen together,
          wherever you are.
        </p>

      </section>


      <section className="status-section">

        <p>

          Backend Status:

          <strong>
            {" "}
            {backendMessage}
          </strong>

        </p>

      </section>


      <section className="identity-section">

        <h2>
          Your Name
        </h2>

        <p>
          Enter a name other members
          can see.
        </p>


        <input
          className="name-input"

          type="text"

          placeholder="Enter your name"

          maxLength={30}

          value={
            displayName
          }

          onChange={(event) =>
            setDisplayName(
              event.target.value
            )
          }
        />

      </section>


      <section className="room-section">

        <h2>
          Create a Music Room
        </h2>

        <p>
          Create a temporary room
          and share its code.
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
            ?
            "Creating..."
            :
            "Create Room"}

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


        <div className="join-form">

          <input
            type="text"

            placeholder="Room code"

            maxLength={6}

            value={
              joinCode
            }

            onChange={(event) =>
              setJoinCode(
                event.target.value
                  .toUpperCase()
              )
            }
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
              ?
              "Joining..."
              :
              "Join Room"}

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