import json
import time
import uuid

from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
)

from app.api.rooms import (
    get_effective_position,
    rooms,
)

from app.core.room_cleanup import (
    cancel_room_cleanup,
    schedule_room_cleanup,
)


router = APIRouter(
    tags=["Realtime"],
)


# =========================================================
# SYNCHRONIZATION SETTINGS
# =========================================================

PLAY_START_DELAY = 0.7

CONTROL_DELAY = 0.2


# =========================================================
# ACTIVE CONNECTIONS
# =========================================================

connections = {}


# =========================================================
# BROADCAST EVENT
# =========================================================

async def broadcast_room_event(
    room_code: str,
    message: dict,
):
    room_connections = (
        connections.get(
            room_code,
            [],
        )
    )

    broken_connections = []

    for connection in room_connections:
        try:
            await connection[
                "websocket"
            ].send_json(
                message
            )

        except Exception:
            broken_connections.append(
                connection
            )

    for connection in broken_connections:
        if connection in room_connections:
            room_connections.remove(
                connection
            )


# =========================================================
# SET HOST
# =========================================================

def set_room_host(
    room_code: str,
    member_connection,
):
    if room_code not in rooms:
        return

    room = rooms[
        room_code
    ]

    if member_connection is None:
        room[
            "host_member_id"
        ] = None

        room[
            "host_name"
        ] = None

        return

    room[
        "host_member_id"
    ] = member_connection[
        "id"
    ]

    room[
        "host_name"
    ] = member_connection[
        "name"
    ]

    print(
        f"Room {room_code} host: "
        f"{member_connection['name']}"
    )


# =========================================================
# BROADCAST MEMBERS
# =========================================================

async def broadcast_members(
    room_code: str,
):
    room_connections = (
        connections.get(
            room_code,
            [],
        )
    )

    if room_code not in rooms:
        return

    room = rooms[
        room_code
    ]

    host_member_id = room.get(
        "host_member_id"
    )

    members = []

    for connection in room_connections:
        is_host = (
            connection["id"]
            ==
            host_member_id
        )

        display_name = (
            f"{connection['name']} (Host)"
            if is_host
            else connection["name"]
        )

        members.append(
            {
                "id":
                    connection["id"],

                "name":
                    display_name,

                "raw_name":
                    connection["name"],

                "is_host":
                    is_host,
            }
        )

    room[
        "members"
    ] = members

    await broadcast_room_event(
        room_code,
        {
            "type":
                "members_updated",

            "members":
                members,

            "host_member_id":
                room.get(
                    "host_member_id"
                ),

            "host_name":
                room.get(
                    "host_name"
                ),
        },
    )


# =========================================================
# FIND SONG
# =========================================================

def find_song(
    room_code: str,
    song_id: str,
):
    room = rooms.get(
        room_code
    )

    if not room:
        return None

    for song in room[
        "queue"
    ]:
        if song[
            "id"
        ] == song_id:
            return song

    return None


# =========================================================
# GET SONG INDEX
# =========================================================

def get_song_index(
    room_code: str,
    song_id: str,
):
    room = rooms.get(
        room_code
    )

    if not room:
        return -1

    for index, song in enumerate(
        room["queue"]
    ):
        if song[
            "id"
        ] == song_id:
            return index

    return -1


# =========================================================
# BROADCAST PLAYBACK STATE
# =========================================================

async def broadcast_playback_state(
    room_code: str,
    action: str,
    execute_at=None,
):
    room = rooms[
        room_code
    ]

    await broadcast_room_event(
        room_code,
        {
            "type":
                "playback_state",

            "action":
                action,

            "current_song":
                room[
                    "current_song"
                ],

            "is_playing":
                room[
                    "is_playing"
                ],

            "position":
                room[
                    "current_position"
                ],

            "playback_started_at":
                room[
                    "playback_started_at"
                ],

            "playback_updated_at":
                room[
                    "playback_updated_at"
                ],

            "execute_at":
                execute_at,

            "server_time":
                time.time(),
        },
    )


# =========================================================
# SELECT SONG
# =========================================================

async def handle_select_song(
    room_code: str,
    data: dict,
):
    song_id = data.get(
        "song_id"
    )

    song = find_song(
        room_code,
        song_id,
    )

    if not song:
        return

    room = rooms[
        room_code
    ]

    room[
        "current_song"
    ] = song_id

    room[
        "current_position"
    ] = 0.0

    room[
        "is_playing"
    ] = False

    room[
        "playback_started_at"
    ] = None

    room[
        "playback_updated_at"
    ] = time.time()

    await broadcast_playback_state(
        room_code,
        "select_song",
    )


# =========================================================
# PLAY
# =========================================================

async def handle_play(
    room_code: str,
    data: dict,
):
    room = rooms[
        room_code
    ]

    song_id = data.get(
        "song_id"
    )

    song = find_song(
        room_code,
        song_id,
    )

    if not song:
        return

    try:
        position = float(
            data.get(
                "position",
                room[
                    "current_position"
                ],
            )
        )

    except (
        TypeError,
        ValueError,
    ):
        position = 0.0

    position = max(
        0.0,
        position,
    )

    start_at = (
        time.time()
        +
        PLAY_START_DELAY
    )

    room[
        "current_song"
    ] = song_id

    room[
        "current_position"
    ] = position

    room[
        "is_playing"
    ] = True

    room[
        "playback_started_at"
    ] = start_at

    room[
        "playback_updated_at"
    ] = time.time()

    await broadcast_playback_state(
        room_code,
        "play",
        execute_at=start_at,
    )


# =========================================================
# PAUSE
# =========================================================

async def handle_pause(
    room_code: str,
):
    room = rooms[
        room_code
    ]

    execute_at = (
        time.time()
        +
        CONTROL_DELAY
    )

    position = (
        get_effective_position(
            room
        )
    )

    if room[
        "is_playing"
    ]:
        position += (
            CONTROL_DELAY
        )

    room[
        "current_position"
    ] = position

    room[
        "is_playing"
    ] = False

    room[
        "playback_started_at"
    ] = None

    room[
        "playback_updated_at"
    ] = time.time()

    await broadcast_playback_state(
        room_code,
        "pause",
        execute_at=execute_at,
    )


# =========================================================
# SEEK
# =========================================================

async def handle_seek(
    room_code: str,
    data: dict,
):
    room = rooms[
        room_code
    ]

    try:
        position = float(
            data.get(
                "position",
                0.0,
            )
        )

    except (
        TypeError,
        ValueError,
    ):
        position = 0.0

    position = max(
        0.0,
        position,
    )

    execute_at = (
        time.time()
        +
        CONTROL_DELAY
    )

    was_playing = room[
        "is_playing"
    ]

    room[
        "current_position"
    ] = position

    room[
        "is_playing"
    ] = was_playing

    if was_playing:
        room[
            "playback_started_at"
        ] = execute_at

    else:
        room[
            "playback_started_at"
        ] = None

    room[
        "playback_updated_at"
    ] = time.time()

    await broadcast_playback_state(
        room_code,
        "seek",
        execute_at=execute_at,
    )


# =========================================================
# NEXT
# =========================================================

async def handle_next(
    room_code: str,
):
    room = rooms[
        room_code
    ]

    queue = room[
        "queue"
    ]

    if not queue:
        return

    current_song_id = room[
        "current_song"
    ]

    if not current_song_id:
        next_song = queue[0]

    else:
        current_index = (
            get_song_index(
                room_code,
                current_song_id,
            )
        )

        if (
            current_index == -1
            or
            current_index
            >= len(queue) - 1
        ):
            next_song = queue[0]

        else:
            next_song = queue[
                current_index + 1
            ]

    was_playing = room[
        "is_playing"
    ]

    room[
        "current_song"
    ] = next_song[
        "id"
    ]

    room[
        "current_position"
    ] = 0.0

    room[
        "is_playing"
    ] = was_playing

    if was_playing:
        start_at = (
            time.time()
            +
            PLAY_START_DELAY
        )

        room[
            "playback_started_at"
        ] = start_at

    else:
        start_at = None

        room[
            "playback_started_at"
        ] = None

    room[
        "playback_updated_at"
    ] = time.time()

    await broadcast_playback_state(
        room_code,
        "next",
        execute_at=start_at,
    )


# =========================================================
# PREVIOUS
# =========================================================

async def handle_previous(
    room_code: str,
):
    room = rooms[
        room_code
    ]

    queue = room[
        "queue"
    ]

    if not queue:
        return

    current_song_id = room[
        "current_song"
    ]

    if not current_song_id:
        previous_song = queue[0]

    else:
        current_index = (
            get_song_index(
                room_code,
                current_song_id,
            )
        )

        if current_index <= 0:
            previous_song = queue[
                len(queue) - 1
            ]

        else:
            previous_song = queue[
                current_index - 1
            ]

    was_playing = room[
        "is_playing"
    ]

    room[
        "current_song"
    ] = previous_song[
        "id"
    ]

    room[
        "current_position"
    ] = 0.0

    room[
        "is_playing"
    ] = was_playing

    if was_playing:
        start_at = (
            time.time()
            +
            PLAY_START_DELAY
        )

        room[
            "playback_started_at"
        ] = start_at

    else:
        start_at = None

        room[
            "playback_started_at"
        ] = None

    room[
        "playback_updated_at"
    ] = time.time()

    await broadcast_playback_state(
        room_code,
        "previous",
        execute_at=start_at,
    )


# =========================================================
# CLOCK SYNC
# =========================================================

async def handle_sync_request(
    websocket: WebSocket,
    data: dict,
):
    await websocket.send_json(
        {
            "type":
                "sync_response",

            "client_time":
                data.get(
                    "client_time"
                ),

            "server_time":
                time.time(),
        }
    )


# =========================================================
# STATE REQUEST
# =========================================================

async def handle_state_request(
    websocket: WebSocket,
    room_code: str,
):
    room = rooms[
        room_code
    ]

    await websocket.send_json(
        {
            "type":
                "playback_state",

            "action":
                "state_sync",

            "current_song":
                room[
                    "current_song"
                ],

            "is_playing":
                room[
                    "is_playing"
                ],

            "position":
                room[
                    "current_position"
                ],

            "playback_started_at":
                room[
                    "playback_started_at"
                ],

            "playback_updated_at":
                room[
                    "playback_updated_at"
                ],

            "execute_at":
                None,

            "server_time":
                time.time(),
        }
    )


# =========================================================
# HANDLE MESSAGE
# =========================================================

async def handle_room_message(
    websocket: WebSocket,
    room_code: str,
    message: str,
):
    try:
        data = json.loads(
            message
        )

    except json.JSONDecodeError:
        return

    message_type = data.get(
        "type"
    )

    if message_type == "sync_request":
        await handle_sync_request(
            websocket,
            data,
        )

    elif message_type == "state_request":
        await handle_state_request(
            websocket,
            room_code,
        )

    elif message_type == "select_song":
        await handle_select_song(
            room_code,
            data,
        )

    elif message_type == "play":
        await handle_play(
            room_code,
            data,
        )

    elif message_type == "pause":
        await handle_pause(
            room_code,
        )

    elif message_type == "seek":
        await handle_seek(
            room_code,
            data,
        )

    elif message_type == "next":
        await handle_next(
            room_code,
        )

    elif message_type == "previous":
        await handle_previous(
            room_code,
        )


# =========================================================
# WEBSOCKET ENDPOINT
# =========================================================

@router.websocket(
    "/ws/rooms/{room_code}"
)
async def room_websocket(
    websocket: WebSocket,
    room_code: str,
    name: str = "Guest",
):
    room_code = (
        room_code
        .strip()
        .upper()
    )

    name = name.strip()

    if not name:
        name = "Guest"


    # -----------------------------------------------------
    # ROOM CHECK
    # -----------------------------------------------------

    if room_code not in rooms:
        await websocket.accept()

        await websocket.send_json(
            {
                "type":
                    "error",

                "message":
                    "Room not found",
            }
        )

        await websocket.close(
            code=1008
        )

        return


    # -----------------------------------------------------
    # CANCEL CLEANUP
    # -----------------------------------------------------

    cancel_room_cleanup(
        room_code
    )


    # -----------------------------------------------------
    # ACCEPT CONNECTION
    # -----------------------------------------------------

    await websocket.accept()

    member_id = str(
        uuid.uuid4()
    )

    member_connection = {
        "id":
            member_id,

        "name":
            name,

        "websocket":
            websocket,
    }

    if room_code not in connections:
        connections[
            room_code
        ] = []

    connections[
        room_code
    ].append(
        member_connection
    )


    room = rooms[
        room_code
    ]


    # -----------------------------------------------------
    # FIRST MEMBER BECOMES HOST
    # -----------------------------------------------------

    if not room.get(
        "host_member_id"
    ):
        set_room_host(
            room_code,
            member_connection,
        )


    # -----------------------------------------------------
    # CONNECTED MESSAGE
    # -----------------------------------------------------

    await websocket.send_json(
        {
            "type":
                "connected",

            "room_code":
                room_code,

            "member": {
                "id":
                    member_id,

                "name":
                    name,

                "is_host":
                    (
                        room[
                            "host_member_id"
                        ]
                        ==
                        member_id
                    ),
            },

            "host_member_id":
                room[
                    "host_member_id"
                ],

            "host_name":
                room[
                    "host_name"
                ],
        }
    )


    # -----------------------------------------------------
    # ROOM STATE
    # -----------------------------------------------------

    await websocket.send_json(
        {
            "type":
                "room_state",

            "server_time":
                time.time(),

            "room": {
                "code":
                    room_code,

                "members":
                    room[
                        "members"
                    ],

                "host_member_id":
                    room[
                        "host_member_id"
                    ],

                "host_name":
                    room[
                        "host_name"
                    ],

                "queue":
                    room[
                        "queue"
                    ],

                "current_song":
                    room[
                        "current_song"
                    ],

                "is_playing":
                    room[
                        "is_playing"
                    ],

                "current_position":
                    room[
                        "current_position"
                    ],

                "playback_started_at":
                    room[
                        "playback_started_at"
                    ],

                "playback_updated_at":
                    room[
                        "playback_updated_at"
                    ],
            },
        }
    )


    await broadcast_members(
        room_code
    )


    # -----------------------------------------------------
    # RECEIVE EVENTS
    # -----------------------------------------------------

    try:
        while True:
            message = (
                await websocket.receive_text()
            )

            await handle_room_message(
                websocket,
                room_code,
                message,
            )

    except WebSocketDisconnect:
        pass

    except Exception as error:
        print(
            "WebSocket error:",
            error,
        )


    # -----------------------------------------------------
    # DISCONNECT
    # -----------------------------------------------------

    finally:
        room_connections = (
            connections.get(
                room_code,
                [],
            )
        )

        if (
            member_connection
            in room_connections
        ):
            room_connections.remove(
                member_connection
            )


        if room_code not in rooms:
            return


        room = rooms[
            room_code
        ]


        # -------------------------------------------------
        # HOST LEFT
        # -------------------------------------------------

        if (
            room.get(
                "host_member_id"
            )
            ==
            member_id
        ):

            if room_connections:
                new_host = (
                    room_connections[0]
                )

                set_room_host(
                    room_code,
                    new_host,
                )

            else:
                set_room_host(
                    room_code,
                    None,
                )


        # -------------------------------------------------
        # MEMBERS STILL INSIDE
        # -------------------------------------------------

        if room_connections:
            await broadcast_members(
                room_code
            )


        # -------------------------------------------------
        # ROOM EMPTY
        # -------------------------------------------------

        else:
            connections.pop(
                room_code,
                None,
            )

            room[
                "members"
            ] = []

            schedule_room_cleanup(
                room_code
            )