import {
  useEffect,
  useRef,
  useState,
} from "react";

import "./App.css";


/* =========================================================
   CONFIG
========================================================= */

const API_BASE_URL =
  "http://127.0.0.1:8000";

const WS_BASE_URL =
  "ws://127.0.0.1:8000";

const DRIFT_CHECK_INTERVAL =
  3000;

const DRIFT_CORRECTION_THRESHOLD =
  0.75;


/* =========================================================
   SESSION STORAGE

   sessionStorage is used instead of localStorage.

   This means:
   - Refresh same tab -> reconnect
   - New tab -> homepage
   - Leave Room -> clear room
========================================================= */

const ROOM_STORAGE_KEY =
  "sangeet_sangai_room";

const NAME_STORAGE_KEY =
  "sangeet_sangai_name";


function App() {
  /* =======================================================
     GENERAL STATE
  ======================================================= */

  const [
    backendMessage,
    setBackendMessage,
  ] = useState(
    "Connecting to backend..."
  );

  const [
    displayName,
    setDisplayName,
  ] = useState(() => {
    return (
      sessionStorage.getItem(
        NAME_STORAGE_KEY
      ) || ""
    );
  });

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

  const [
    currentMemberId,
    setCurrentMemberId,
  ] = useState(null);

  const [
    hostMemberId,
    setHostMemberId,
  ] = useState(null);

  const [
    playbackControlMode,
    setPlaybackControlMode,
  ] = useState(
    "everyone"
  );

  const [
    newRoomName,
    setNewRoomName,
  ] = useState("");

  const [
    roomName,
    setRoomName,
  ] = useState("");

  const [
    newRoomMaxMembers,
    setNewRoomMaxMembers,
  ] = useState(8);

  const [
    roomMaxMembers,
    setRoomMaxMembers,
  ] = useState(8);

  const [
    isRoomLocked,
    setIsRoomLocked,
  ] = useState(false);


  /* =======================================================
     UPLOAD STATE
  ======================================================= */

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


  /* =======================================================
     MUSIC STATE
  ======================================================= */

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


  /* =======================================================
     REFS
  ======================================================= */

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

  const reconnectAttemptedRef =
    useRef(false);

  const playbackStateRef =
    useRef({
      current_song: null,
      is_playing: false,
      position: 0,
      playback_started_at:
        null,
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


  /* =======================================================
     KEEP REFS UPDATED
  ======================================================= */

  useEffect(
    () => {
      queueRef.current =
        queue;
    },
    [queue]
  );

  useEffect(
    () => {
      currentSongRef.current =
        currentSong;
    },
    [currentSong]
  );


  /* =======================================================
     SAVE NAME IN CURRENT TAB ONLY
  ======================================================= */

  useEffect(
    () => {
      const name =
        displayName.trim();

      if (name) {
        sessionStorage.setItem(
          NAME_STORAGE_KEY,
          name
        );
      }
    },
    [displayName]
  );


  /* =======================================================
     BACKEND STATUS
  ======================================================= */

  useEffect(
    () => {
      fetch(
        `${API_BASE_URL}/api/status`
      )
        .then(
          (response) => {
            if (
              !response.ok
            ) {
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
    },
    []
  );


  /* =======================================================
     CLEANUP
  ======================================================= */

  useEffect(
    () => {
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
    },
    []
  );


  /* =======================================================
     HELPERS
  ======================================================= */

  const formatTime =
    (seconds) => {
      if (
        !Number.isFinite(
          seconds
        ) ||
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


  const getInitial =
    (text) => {
      return (
        text
          ?.trim()
          ?.charAt(0)
          ?.toUpperCase() ||
        "?"
      );
    };


  const clampMaxMembers =
    (value) => {
      const numericValue =
        Number(value);

      if (
        !Number.isFinite(
          numericValue
        )
      ) {
        return 8;
      }

      return Math.min(
        20,
        Math.max(
          2,
          numericValue
        )
      );
    };


  const getEstimatedServerTime =
    () => {
      return (
        Date.now() /
          1000 +
        clockOffsetRef.current
      );
    };


  /* =======================================================
     WEBSOCKET HELPERS
  ======================================================= */

  const sendRoomEvent =
    (event) => {
      const socket =
        socketRef.current;

      if (
        !socket ||
        socket.readyState !==
          WebSocket.OPEN
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


  const sendClockSyncRequest =
    () => {
      sendRoomEvent({
        type:
          "sync_request",

        client_time:
          Date.now() /
          1000,
      });
    };


  const processClockSync =
    (data) => {
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
        ) ||
        !Number.isFinite(
          serverTime
        )
      ) {
        return;
      }

      const roundTripTime =
        clientReceiveTime -
        clientSendTime;

      const midpoint =
        clientSendTime +
        roundTripTime / 2;

      const estimatedOffset =
        serverTime -
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
          ...clockSamplesRef.current,
        ].sort(
          (a, b) =>
            a - b
        );

      const middle =
        Math.floor(
          sortedSamples.length /
            2
        );

      clockOffsetRef.current =
        sortedSamples[
          middle
        ];

      if (
        roundTripTime <
        0.1
      ) {
        setSyncQuality(
          "Excellent"
        );
      } else if (
        roundTripTime <
        0.25
      ) {
        setSyncQuality(
          "Good"
        );
      } else {
        setSyncQuality(
          "Network delay"
        );
      }
    };


  const findSongById =
    (songId) => {
      return (
        queueRef.current.find(
          (song) =>
            song.id ===
            songId
        ) || null
      );
    };


  /* =======================================================
     AUDIO WAIT HELPERS
  ======================================================= */

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


  const waitForAudioReady =
    async (audio) => {
      if (
        audio.readyState >= 1
      ) {
        return;
      }

      await new Promise(
        (resolve) => {
          let finished =
            false;

          const finish =
            () => {
              if (
                finished
              ) {
                return;
              }

              finished =
                true;

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


  /* =======================================================
     PLAYBACK POSITION
  ======================================================= */

  const getExpectedPosition =
    (playbackState) => {
      let position =
        Number(
          playbackState.position ||
            0
        );

      if (
        !playbackState.is_playing
      ) {
        return Math.max(
          0,
          position
        );
      }

      const startedAt =
        Number(
          playbackState.playback_started_at
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
          serverNow -
            startedAt
        );

      position +=
        elapsed;

      return Math.max(
        0,
        position
      );
    };


  /* =======================================================
     CLEAR SONG
  ======================================================= */

  const clearCurrentSong =
    () => {
      if (
        scheduledActionRef.current
      ) {
        clearTimeout(
          scheduledActionRef.current
        );

        scheduledActionRef.current =
          null;
      }

      if (
        audioRef.current
      ) {
        audioRef.current.pause();
      }

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
    };


  /* =======================================================
     APPLY PLAYBACK STATE
  ======================================================= */

  const applyPlaybackState =
    async (data) => {
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
              data.position ||
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
        clearCurrentSong();
        return;
      }

      const songChanged =
        currentSongRef.current
          ?.id !==
        song.id;

      if (
        songChanged
      ) {
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

      if (
        songChanged
      ) {
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

          if (
            !activeAudio
          ) {
            return;
          }

          let targetPosition =
            getExpectedPosition(
              playbackStateRef.current
            );

          if (
            Number.isFinite(
              activeAudio.duration
            ) &&
            activeAudio.duration >
              0
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
          } catch (
            error
          ) {
            console.warn(
              "Seek failed:",
              error
            );
          }

          setCurrentTime(
            targetPosition
          );

          if (
            playbackStateRef.current
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
            } catch (
              error
            ) {
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
              executeAt -
              serverNow
            ) * 1000
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


  /* =======================================================
     DRIFT CORRECTION
  ======================================================= */

  const correctPlaybackDrift =
    () => {
      const audio =
        audioRef.current;

      const state =
        playbackStateRef.current;

      if (
        !audio ||
        !state.is_playing ||
        !state.current_song ||
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
        ) &&
        audio.duration >
          0
      ) {
        expectedPosition =
          Math.min(
            expectedPosition,
            audio.duration
          );
      }

      const drift =
        expectedPosition -
        audio.currentTime;

      if (
        Math.abs(
          drift
        ) >
        DRIFT_CORRECTION_THRESHOLD
      ) {
        try {
          audio.currentTime =
            expectedPosition;

          setCurrentTime(
            expectedPosition
          );
        } catch (
          error
        ) {
          console.warn(
            "Drift correction failed:",
            error
          );
        }
      }
    };


  /* =======================================================
     START SYNC
  ======================================================= */

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

      clockSyncIntervalRef.current =
        setInterval(
          sendClockSyncRequest,
          10000
        );

      driftIntervalRef.current =
        setInterval(
          correctPlaybackDrift,
          DRIFT_CHECK_INTERVAL
        );
    };


  /* =======================================================
     CONNECT TO ROOM
  ======================================================= */

  const connectToRoom =
    (
      code,
      name
    ) => {
      const normalizedCode =
        code
          .trim()
          .toUpperCase();

      const normalizedName =
        name.trim();

      if (
        socketRef.current
      ) {
        try {
          socketRef.current.close();
        } catch (
          error
        ) {
          console.warn(
            "Previous socket close failed:",
            error
          );
        }
      }

      setMembers(
        []
      );

      setQueue(
        []
      );

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

      setPlayerMessage(
        ""
      );

      setUploadMessage(
        ""
      );

      setJoinMessage(
        ""
      );

      setRoomMessage(
        ""
      );

      /*
       * Set immediately so refresh does not flash homepage.
       */
      setCurrentRoom(
        normalizedCode
      );

      const socket =
        new WebSocket(
          `${WS_BASE_URL}/ws/rooms/${normalizedCode}?name=${encodeURIComponent(
            normalizedName
          )}`
        );

      socketRef.current =
        socket;


      /* ---------------------------------------------------
         SOCKET OPEN
      --------------------------------------------------- */

      socket.onopen =
        () => {
          setCurrentRoom(
            normalizedCode
          );

          /*
           * IMPORTANT:
           * Save only in current browser tab.
           */
          sessionStorage.setItem(
            ROOM_STORAGE_KEY,
            normalizedCode
          );

          sessionStorage.setItem(
            NAME_STORAGE_KEY,
            normalizedName
          );

          setConnectionStatus(
            "Connected"
          );

          startSynchronization();
        };


      /* ---------------------------------------------------
         SOCKET MESSAGE
      --------------------------------------------------- */

      socket.onmessage =
        async (event) => {
          try {
            const data =
              JSON.parse(
                event.data
              );


            /* CLOCK SYNC */

            if (
              data.type ===
              "sync_response"
            ) {
              processClockSync(
                data
              );

              return;
            }


            /* CONNECTED */

            if (
              data.type ===
              "connected"
            ) {
              setCurrentRoom(
                data.room_code
              );

              sessionStorage.setItem(
                ROOM_STORAGE_KEY,
                data.room_code
              );

              sessionStorage.setItem(
                NAME_STORAGE_KEY,
                normalizedName
              );

              setConnectionStatus(
                "Connected"
              );

              setCurrentMemberId(
                data.member?.id ||
                  null
              );

              setHostMemberId(
                data.host_member_id ||
                  null
              );
            }


            /* ROOM STATE */

            if (
              data.type ===
              "room_state"
            ) {
              setRoomName(
                data.room.name ||
                  "Music Room"
              );

              setRoomMaxMembers(
                Number(
                  data.room
                    .max_members ||
                    8
                )
              );

              setIsRoomLocked(
                Boolean(
                  data.room
                    .is_locked
                )
              );

              const roomQueue =
                Array.isArray(
                  data.room.queue
                )
                  ? data.room.queue
                  : [];

              setQueue(
                roomQueue
              );

              queueRef.current =
                roomQueue;

              setHostMemberId(
                data.room
                  .host_member_id ||
                  null
              );

              setPlaybackControlMode(
                data.room
                  .playback_control_mode ||
                  "everyone"
              );

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
              } else {
                clearCurrentSong();
              }
            }


            /* MEMBERS */

            if (
              data.type ===
              "members_updated"
            ) {
              setMembers(
                data.members ||
                  []
              );

              setHostMemberId(
                data.host_member_id ||
                  null
              );

              if (
                data.max_members
              ) {
                setRoomMaxMembers(
                  Number(
                    data.max_members
                  )
                );
              }
            }


            /* QUEUE */

            if (
              data.type ===
              "queue_updated"
            ) {
              const updatedQueue =
                Array.isArray(
                  data.queue
                )
                  ? data.queue
                  : [];

              setQueue(
                updatedQueue
              );

              queueRef.current =
                updatedQueue;

              if (
                currentSongRef.current &&
                !updatedQueue.some(
                  (song) =>
                    song.id ===
                    currentSongRef
                      .current.id
                )
              ) {
                clearCurrentSong();
              }
            }


            if (
              data.type ===
              "queue_action_result"
            ) {
              setPlayerMessage(
                data.message ||
                  "Queue updated"
              );
            }


            /* ROOM SETTINGS */

            if (
              data.type ===
              "room_settings"
            ) {
              setPlaybackControlMode(
                data.playback_control_mode ||
                  "everyone"
              );

              setHostMemberId(
                data.host_member_id ||
                  null
              );

              setIsRoomLocked(
                Boolean(
                  data.is_locked
                )
              );

              if (
                data.max_members
              ) {
                setRoomMaxMembers(
                  Number(
                    data.max_members
                  )
                );
              }
            }


            /* ROOM LOCKED */

            if (
              data.type ===
              "room_locked"
            ) {
              setJoinMessage(
                data.message ||
                  "Room is locked"
              );

              sessionStorage.removeItem(
                ROOM_STORAGE_KEY
              );

              setCurrentRoom(
                ""
              );

              setConnectionStatus(
                "Disconnected"
              );

              socket.close();

              return;
            }


            /* ROOM FULL */

            if (
              data.type ===
              "room_full"
            ) {
              setJoinMessage(
                data.message ||
                  "Room is full"
              );

              sessionStorage.removeItem(
                ROOM_STORAGE_KEY
              );

              setCurrentRoom(
                ""
              );

              setConnectionStatus(
                "Disconnected"
              );

              socket.close();

              return;
            }


            /* PERMISSION ERROR */

            if (
              data.type ===
              "permission_error"
            ) {
              setPlayerMessage(
                data.message
              );
            }


            /* PLAYBACK */

            if (
              data.type ===
              "playback_state"
            ) {
              await applyPlaybackState(
                data
              );
            }


            /* ERROR */

            if (
              data.type ===
              "error"
            ) {
              setJoinMessage(
                data.message
              );
            }
          } catch (
            error
          ) {
            console.error(
              "WebSocket message error:",
              error
            );
          }
        };


      /* ---------------------------------------------------
         SOCKET ERROR
      --------------------------------------------------- */

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


      /* ---------------------------------------------------
         SOCKET CLOSE
      --------------------------------------------------- */

      socket.onclose =
        () => {
          setConnectionStatus(
            "Disconnected"
          );
        };
    };


  /* =======================================================
     RESTORE SAME TAB AFTER REFRESH
  ======================================================= */

  useEffect(
    () => {
      if (
        reconnectAttemptedRef.current
      ) {
        return;
      }

      reconnectAttemptedRef.current =
        true;

      const savedRoom =
        sessionStorage.getItem(
          ROOM_STORAGE_KEY
        );

      const savedName =
        sessionStorage.getItem(
          NAME_STORAGE_KEY
        );

      /*
       * New tab does not have these values,
       * therefore it stays on homepage.
       */
      if (
        !savedRoom ||
        !savedName
      ) {
        return;
      }

      /*
       * Same tab refresh:
       * show room while reconnecting.
       */
      setCurrentRoom(
        savedRoom
      );

      setDisplayName(
        savedName
      );

      setConnectionStatus(
        "Reconnecting..."
      );


      const reconnect =
        async () => {
          try {
            const response =
              await fetch(
                `${API_BASE_URL}/api/rooms/${savedRoom}`
              );

            if (
              !response.ok
            ) {
              throw new Error(
                "Room no longer exists"
              );
            }

            const data =
              await response.json();

            setRoomName(
              data.room.name ||
                "Music Room"
            );

            setRoomMaxMembers(
              Number(
                data.room
                  .max_members ||
                  8
              )
            );

            setIsRoomLocked(
              Boolean(
                data.room
                  .is_locked
              )
            );

            setPlaybackControlMode(
              data.room
                .playback_control_mode ||
                "everyone"
            );

            connectToRoom(
              savedRoom,
              savedName
            );
          } catch (
            error
          ) {
            console.error(
              "Room reconnect failed:",
              error
            );

            /*
             * Room doesn't exist anymore.
             * Clear only current tab.
             */
            sessionStorage.removeItem(
              ROOM_STORAGE_KEY
            );

            setCurrentRoom(
              ""
            );

            setConnectionStatus(
              "Disconnected"
            );
          }
        };

      reconnect();
    },
    []
  );


  /* =======================================================
     CREATE ROOM
  ======================================================= */

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

        setRoomMessage(
          ""
        );

        const response =
          await fetch(
            `${API_BASE_URL}/api/rooms/create`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  {
                    name:
                      newRoomName.trim(),

                    max_members:
                      clampMaxMembers(
                        newRoomMaxMembers
                      ),
                  }
                ),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok
        ) {
          throw new Error(
            data.detail
          );
        }

        const code =
          data.room.code;

        setRoomName(
          data.room.name ||
            "Music Room"
        );

        setRoomMaxMembers(
          Number(
            data.room
              .max_members ||
              newRoomMaxMembers
          )
        );

        setIsRoomLocked(
          Boolean(
            data.room
              .is_locked
          )
        );

        /*
         * Save only for this tab.
         */
        sessionStorage.setItem(
          ROOM_STORAGE_KEY,
          code
        );

        sessionStorage.setItem(
          NAME_STORAGE_KEY,
          name
        );

        connectToRoom(
          code,
          name
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        setRoomMessage(
          error.message ||
            "Failed to create room"
        );
      } finally {
        setIsCreatingRoom(
          false
        );
      }
    };


  /* =======================================================
     JOIN ROOM
  ======================================================= */

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

        setJoinMessage(
          ""
        );

        const response =
          await fetch(
            `${API_BASE_URL}/api/rooms/${code}`
          );

        const data =
          await response.json();

        if (
          !response.ok
        ) {
          throw new Error(
            data.detail
          );
        }

        if (
          data.room.is_locked
        ) {
          throw new Error(
            "Room is locked. Ask the host to unlock it."
          );
        }

        const maximumMembers =
          Number(
            data.room
              .max_members ||
              8
          );

        const currentMembers =
          Array.isArray(
            data.room.members
          )
            ? data.room.members
                .length
            : 0;

        if (
          currentMembers >=
          maximumMembers
        ) {
          throw new Error(
            `Room is full (${currentMembers}/${maximumMembers})`
          );
        }

        setRoomMaxMembers(
          maximumMembers
        );

        sessionStorage.setItem(
          ROOM_STORAGE_KEY,
          code
        );

        sessionStorage.setItem(
          NAME_STORAGE_KEY,
          name
        );

        connectToRoom(
          code,
          name
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        setJoinMessage(
          error.message ||
            "Unable to join room"
        );
      } finally {
        setIsJoiningRoom(
          false
        );
      }
    };


  /* =======================================================
     FILE SELECT
  ======================================================= */

  const handleFileChange =
    (event) => {
      const file =
        event.target.files[0];

      setUploadMessage(
        ""
      );

      if (!file) {
        setSelectedFile(
          null
        );

        return;
      }

      const maxSize =
        25 *
        1024 *
        1024;

      if (
        file.size >
        maxSize
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


  /* =======================================================
     UPLOAD SONG
  ======================================================= */

  const uploadSong =
    async () => {
      if (
        !selectedFile
      ) {
        setUploadMessage(
          "Please choose a song first"
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

        if (
          !response.ok
        ) {
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
      } catch (
        error
      ) {
        console.error(
          error
        );

        setUploadMessage(
          error.message ||
            "Upload failed"
        );
      } finally {
        setIsUploading(
          false
        );
      }
    };


  /* =======================================================
     ROLE / PERMISSIONS
  ======================================================= */

  const isHost =
    Boolean(
      currentMemberId &&
        hostMemberId &&
        currentMemberId ===
          hostMemberId
    );

  const canControlPlayback =
    playbackControlMode ===
      "everyone" ||
    isHost;


  /* =======================================================
     ROOM SETTINGS
  ======================================================= */

  const changePlaybackMode =
    (mode) => {
      if (!isHost) {
        return;
      }

      sendRoomEvent({
        type:
          "set_playback_mode",

        mode,
      });
    };


  const changeRoomLock =
    () => {
      if (!isHost) {
        return;
      }

      sendRoomEvent({
        type:
          "set_room_lock",

        locked:
          !isRoomLocked,
      });
    };


  /* =======================================================
     QUEUE / PLAYER
  ======================================================= */

  const selectSong =
    (song) => {
      if (
        !canControlPlayback
      ) {
        setPlayerMessage(
          "Only the host can control playback."
        );

        return;
      }

      sendRoomEvent({
        type:
          "select_song",

        song_id:
          song.id,
      });
    };


  const togglePlayPause =
    () => {
      if (
        !canControlPlayback
      ) {
        setPlayerMessage(
          "Only the host can control playback."
        );

        return;
      }

      if (
        !currentSong
      ) {
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

      if (
        isPlaying
      ) {
        sendRoomEvent({
          type:
            "pause",
        });
      } else {
        sendRoomEvent({
          type:
            "play",

          song_id:
            currentSong.id,

          position:
            audio.currentTime,
        });
      }
    };


  const handleSeek =
    (event) => {
      if (
        !canControlPlayback
      ) {
        setPlayerMessage(
          "Only the host can control playback."
        );

        return;
      }

      if (
        !currentSong
      ) {
        return;
      }

      const position =
        Number(
          event.target.value
        );

      setCurrentTime(
        position
      );

      sendRoomEvent({
        type:
          "seek",

        song_id:
          currentSong.id,

        position,
      });
    };


  const playNextSong =
    () => {
      if (
        !canControlPlayback
      ) {
        setPlayerMessage(
          "Only the host can control playback."
        );

        return;
      }

      sendRoomEvent({
        type:
          "next",
      });
    };


  const playPreviousSong =
    () => {
      if (
        !canControlPlayback
      ) {
        setPlayerMessage(
          "Only the host can control playback."
        );

        return;
      }

      sendRoomEvent({
        type:
          "previous",
      });
    };


  const removeSong =
    (song) => {
      if (!isHost) {
        setPlayerMessage(
          "Only the host can remove songs."
        );

        return;
      }

      sendRoomEvent({
        type:
          "remove_song",

        song_id:
          song.id,
      });
    };


  const moveSong =
    (
      song,
      direction
    ) => {
      if (!isHost) {
        setPlayerMessage(
          "Only the host can reorder songs."
        );

        return;
      }

      sendRoomEvent({
        type:
          "move_song",

        song_id:
          song.id,

        direction,
      });
    };


  /* =======================================================
     AUDIO EVENTS
  ======================================================= */

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


  const handleTimeUpdate =
    () => {
      if (
        audioRef.current
      ) {
        setCurrentTime(
          audioRef.current
            .currentTime
        );
      }
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
      if (!isHost) {
        return;
      }

      sendRoomEvent({
        type:
          "next",
      });
    };


  /* =======================================================
     LEAVE ROOM

     This is where the current tab's session is cleared.
  ======================================================= */

  const leaveRoom =
    () => {
      sessionStorage.removeItem(
        ROOM_STORAGE_KEY
      );

      sessionStorage.removeItem(
        NAME_STORAGE_KEY
      );

      if (
        scheduledActionRef.current
      ) {
        clearTimeout(
          scheduledActionRef.current
        );

        scheduledActionRef.current =
          null;
      }

      if (
        driftIntervalRef.current
      ) {
        clearInterval(
          driftIntervalRef.current
        );

        driftIntervalRef.current =
          null;
      }

      if (
        clockSyncIntervalRef.current
      ) {
        clearInterval(
          clockSyncIntervalRef.current
        );

        clockSyncIntervalRef.current =
          null;
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

      setCurrentRoom(
        ""
      );

      setDisplayName(
        ""
      );

      setMembers(
        []
      );

      setCurrentMemberId(
        null
      );

      setHostMemberId(
        null
      );

      setPlaybackControlMode(
        "everyone"
      );

      setRoomName(
        ""
      );

      setRoomMaxMembers(
        8
      );

      setIsRoomLocked(
        false
      );

      setQueue(
        []
      );

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

      setUploadMessage(
        ""
      );

      setPlayerMessage(
        ""
      );

      setConnectionStatus(
        "Disconnected"
      );

      setSyncQuality(
        "Synchronizing..."
      );
    };


  /* =======================================================
     ROOM PAGE
  ======================================================= */

  if (
    currentRoom
  ) {
    return (
      <main className="app-page room-app">
        {/* HEADER */}

        <header className="room-topbar">
          <div className="brand-block">
            <div className="brand-logo">
              ♪
            </div>

            <div className="brand-text">
              <h1>
                Sangeet Sangai
              </h1>

              <p>
                {roomName ||
                  "Music Room"}
                {" • "}
                {currentRoom}
              </p>
            </div>
          </div>


          <div className="topbar-right">
            <div className="connection-inline">
              <span className="dot-green" />

              <span>
                {
                  connectionStatus
                }
              </span>
            </div>

            <button
              className="btn btn-danger-outline"
              onClick={
                leaveRoom
              }
            >
              Leave Room
            </button>
          </div>
        </header>


        {/* MAIN ROOM */}

        <section className="music-room-layout">
          {/* =============================================
              LEFT SIDEBAR
          ============================================= */}

          <aside className="music-sidebar">
            {/* ROOM CODE */}

            <div className="sidebar-room">
              <span className="sidebar-small-label">
                ROOM CODE
              </span>

              <button
                className="sidebar-room-code copy-room-code"
                onClick={
                  async () => {
                    try {
                      await navigator.clipboard.writeText(
                        currentRoom
                      );

                      setPlayerMessage(
                        "Room code copied"
                      );
                    } catch (
                      error
                    ) {
                      console.error(
                        "Copy failed:",
                        error
                      );
                    }
                  }
                }
                title="Click to copy room code"
              >
                <span>
                  {
                    currentRoom
                  }
                </span>

                <span className="copy-hint">
                  Copy
                </span>
              </button>


              <div className="sidebar-room-meta">
                <span
                  className={
                    isHost
                      ? "simple-role host"
                      : "simple-role"
                  }
                >
                  {isHost
                    ? "Host"
                    : "Member"}
                </span>

                <span>
                  {
                    members.length
                  }
                  /
                  {
                    roomMaxMembers
                  }
                </span>
              </div>
            </div>


            <div className="sidebar-divider" />


            {/* MEMBERS */}

            <div className="sidebar-section members-section">
              <div className="sidebar-section-head">
                <span>
                  Members
                </span>

                <span className="sidebar-count">
                  {
                    members.length
                  }
                </span>
              </div>


              <div className="sidebar-members">
                {members.map(
                  (
                    member
                  ) => (
                    <div
                      key={
                        member.id
                      }
                      className="sidebar-member"
                    >
                      <div className="sidebar-avatar">
                        {getInitial(
                          member.raw_name ||
                            member.name
                        )}
                      </div>

                      <div className="sidebar-member-info">
                        <strong>
                          {member.raw_name ||
                            member.name}
                        </strong>

                        <span>
                          {member.is_host
                            ? "Host"
                            : "Member"}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>


            <div className="sidebar-divider" />


            {/* ADD MUSIC */}

            <div className="sidebar-section upload-section">
              <div className="sidebar-section-head">
                <span>
                  Add Music
                </span>
              </div>


              <input
                ref={
                  fileInputRef
                }
                className="sidebar-file-input"
                type="file"
                accept=".mp3,.wav,.ogg,.m4a,audio/*"
                onChange={
                  handleFileChange
                }
              />


              <button
                className="btn btn-primary full-btn sidebar-upload-btn"
                onClick={
                  uploadSong
                }
                disabled={
                  isUploading
                }
              >
                {isUploading
                  ? "Uploading..."
                  : "+ Add to Queue"}
              </button>


              {uploadMessage && (
                <p className="sidebar-message">
                  {
                    uploadMessage
                  }
                </p>
              )}
            </div>


            {/* SETTINGS */}

            <div className="sidebar-bottom settings-section">
              <div className="sidebar-divider" />


              <div className="sidebar-section-head settings-title">
                <span>
                  Room Settings
                </span>
              </div>


              <div className="simple-setting">
                <div>
                  <strong>
                    Room Access
                  </strong>

                  <span>
                    {isRoomLocked
                      ? "Locked"
                      : "Open"}
                  </span>
                </div>

                {isHost && (
                  <button
                    className="text-action"
                    onClick={
                      changeRoomLock
                    }
                  >
                    {isRoomLocked
                      ? "Unlock"
                      : "Lock"}
                  </button>
                )}
              </div>


              <div className="simple-setting playback-setting">
                <div>
                  <strong>
                    Playback
                  </strong>

                  {!isHost && (
                    <span>
                      {playbackControlMode ===
                      "host_only"
                        ? "Host only"
                        : "Everyone"}
                    </span>
                  )}
                </div>


                {isHost && (
                  <select
                    value={
                      playbackControlMode
                    }
                    onChange={(
                      event
                    ) =>
                      changePlaybackMode(
                        event.target.value
                      )
                    }
                  >
                    <option value="everyone">
                      Everyone
                    </option>

                    <option value="host_only">
                      Host only
                    </option>
                  </select>
                )}
              </div>
            </div>
          </aside>


          {/* =============================================
              CENTER PLAYER
          ============================================= */}

          <section className="center-player">
            <div className="player-status-row">
              <span className="player-small-label">
                NOW PLAYING
              </span>

              <span className="sync-inline">
                <span className="dot-green" />

                {
                  syncQuality
                }
              </span>
            </div>


            {!currentSong ? (
              <div className="center-empty-player">
                <div className="album-placeholder">
                  <div className="album-inner">
                    ♪
                  </div>
                </div>

                <h2>
                  Nothing playing yet
                </h2>

                <p>
                  Choose a song from the queue or add music to start listening together.
                </p>
              </div>
            ) : (
              <div className="center-player-content">
                <div className="album-placeholder active">
                  <div className="album-inner">
                    ♪
                  </div>
                </div>


                <div className="center-song-info">
                  <h2>
                    {
                      currentSong.title
                    }
                  </h2>

                  <p>
                    Uploaded by{" "}
                    {
                      currentSong.uploaded_by
                    }
                  </p>
                </div>


                <audio
                  ref={
                    audioRef
                  }
                  src={`${API_BASE_URL}${currentSong.url}`}
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


                <div className="modern-progress">
                  <input
                    className="timeline-slider"
                    type="range"
                    min="0"
                    max={
                      duration ||
                      0
                    }
                    step="0.1"
                    value={Math.min(
                      currentTime,
                      duration || 0
                    )}
                    onChange={
                      handleSeek
                    }
                    disabled={
                      !duration ||
                      !canControlPlayback
                    }
                  />


                  <div className="progress-times">
                    <span>
                      {formatTime(
                        currentTime
                      )}
                    </span>

                    <span>
                      {formatTime(
                        duration
                      )}
                    </span>
                  </div>
                </div>


                <div className="modern-controls">
                  <button
                    className="control-button side-control"
                    onClick={
                      playPreviousSong
                    }
                    disabled={
                      queue.length ===
                        0 ||
                      !canControlPlayback
                    }
                    title="Previous"
                  >
                    ◀
                  </button>


                  <button
                    className="control-button main-control"
                    onClick={
                      togglePlayPause
                    }
                    disabled={
                      !canControlPlayback
                    }
                    title={
                      isPlaying
                        ? "Pause"
                        : "Play"
                    }
                  >
                    {isPlaying
                      ? "Ⅱ"
                      : "▶"}
                  </button>


                  <button
                    className="control-button side-control"
                    onClick={
                      playNextSong
                    }
                    disabled={
                      queue.length ===
                        0 ||
                      !canControlPlayback
                    }
                    title="Next"
                  >
                    ▶
                  </button>
                </div>


                {playerMessage && (
                  <p className="center-player-message">
                    {
                      playerMessage
                    }
                  </p>
                )}
              </div>
            )}
          </section>


          {/* =============================================
              QUEUE
          ============================================= */}

          <aside className="queue-panel">
            <div className="queue-panel-header">
              <div>
                <span className="player-small-label">
                  PLAYLIST
                </span>

                <h2>
                  Up Next
                </h2>
              </div>

              <span className="queue-number">
                {
                  queue.length
                }
              </span>
            </div>


            {queue.length ===
            0 ? (
              <div className="modern-queue-empty">
                <div>
                  ♪
                </div>

                <strong>
                  Queue is empty
                </strong>

                <span>
                  Add music to start listening.
                </span>
              </div>
            ) : (
              <div className="modern-queue-list">
                {queue.map(
                  (
                    song,
                    index
                  ) => {
                    const selected =
                      currentSong
                        ?.id ===
                      song.id;

                    return (
                      <div
                        key={
                          song.id
                        }
                        className={
                          selected
                            ? "modern-queue-item active"
                            : "modern-queue-item"
                        }
                      >
                        <button
                          type="button"
                          className="queue-song-button"
                          onClick={() =>
                            selectSong(
                              song
                            )
                          }
                          disabled={
                            !canControlPlayback
                          }
                        >
                          <div className="queue-song-number">
                            {selected
                              ? "♪"
                              : String(
                                  index +
                                    1
                                ).padStart(
                                  2,
                                  "0"
                                )}
                          </div>


                          <div className="queue-song-details">
                            <strong>
                              {
                                song.title
                              }
                            </strong>

                            <span>
                              {
                                song.uploaded_by
                              }
                            </span>
                          </div>
                        </button>


                        {isHost && (
                          <div className="queue-menu">
                            <button
                              type="button"
                              onClick={() =>
                                moveSong(
                                  song,
                                  "up"
                                )
                              }
                              disabled={
                                index ===
                                0
                              }
                              title="Move up"
                            >
                              ↑
                            </button>


                            <button
                              type="button"
                              onClick={() =>
                                moveSong(
                                  song,
                                  "down"
                                )
                              }
                              disabled={
                                index ===
                                queue.length -
                                  1
                              }
                              title="Move down"
                            >
                              ↓
                            </button>


                            <button
                              type="button"
                              className="remove-queue-btn"
                              onClick={() =>
                                removeSong(
                                  song
                                )
                              }
                              title="Remove"
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </aside>
        </section>


        {/* FOOTER */}

        <footer className="room-footer">
          <span className="dot-green" />

          <span>
            Synchronized in real time
          </span>

          <span className="footer-separator">
            •
          </span>

          <span>
            {isRoomLocked
              ? "Room locked"
              : "Room open"}
          </span>

          <span className="footer-separator">
            •
          </span>

          <span>
            {playbackControlMode ===
            "host_only"
              ? "Host controls playback"
              : "Everyone can control playback"}
          </span>
        </footer>
      </main>
    );
  }


  /* =======================================================
     HOME PAGE
  ======================================================= */

  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-logo">
          ♪
        </div>

        <h1>
          Sangeet Sangai
        </h1>

        <p>
          Create a room, share the room code, upload songs, and listen together in real time.
        </p>
      </section>


      <section className="home-shell">
        <div className="home-top">
          <div className="field-block">
            <label>
              Your Name
            </label>

            <input
              type="text"
              placeholder="Enter your display name"
              maxLength={
                30
              }
              value={
                displayName
              }
              onChange={(
                event
              ) =>
                setDisplayName(
                  event.target.value
                )
              }
            />
          </div>


          <div className="backend-box">
            <span className="dot-green" />

            <span>
              {
                backendMessage
              }
            </span>
          </div>
        </div>


        <div className="home-grid">
          {/* CREATE ROOM */}

          <section className="home-card">
            <span className="eyebrow">
              Step 1
            </span>

            <h2>
              Create Room
            </h2>

            <p>
              Start a new music room and invite others with a generated code.
            </p>


            <div className="form-group">
              <label>
                Room Name
              </label>

              <input
                type="text"
                placeholder="Optional room name"
                maxLength={
                  40
                }
                value={
                  newRoomName
                }
                onChange={(
                  event
                ) =>
                  setNewRoomName(
                    event.target.value
                  )
                }
              />
            </div>


            <div className="form-group">
              <label>
                Maximum Members
              </label>

              <input
                type="number"
                min="2"
                max="20"
                value={
                  newRoomMaxMembers
                }
                onChange={(
                  event
                ) =>
                  setNewRoomMaxMembers(
                    clampMaxMembers(
                      event.target.value
                    )
                  )
                }
              />
            </div>


            <button
              className="btn btn-primary full-btn"
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
              <p className="message-text error-text">
                {
                  roomMessage
                }
              </p>
            )}
          </section>


          {/* JOIN ROOM */}

          <section className="home-card">
            <span className="eyebrow">
              Step 2
            </span>

            <h2>
              Join Room
            </h2>

            <p>
              Enter a room code shared by your friend and join instantly.
            </p>


            <div className="form-group">
              <label>
                Room Code
              </label>

              <input
                type="text"
                placeholder="Enter room code"
                maxLength={
                  6
                }
                value={
                  joinCode
                }
                onChange={(
                  event
                ) =>
                  setJoinCode(
                    event.target.value.toUpperCase()
                  )
                }
              />
            </div>


            <button
              className="btn btn-secondary-dark full-btn"
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


            {joinMessage && (
              <p className="message-text error-text">
                {
                  joinMessage
                }
              </p>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}


export default App;