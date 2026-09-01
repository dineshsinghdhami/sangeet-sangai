import json
import time
import uuid
from pathlib import Path

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


PLAY_START_DELAY = 0.7
CONTROL_DELAY = 0.2


connections = {}


BACKEND_DIRECTORY = (
    Path(__file__)
    .resolve()
    .parents[2]
)

TEMP_ROOMS_DIRECTORY = (
    BACKEND_DIRECTORY
    / "temp"
    / "rooms"
)


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
# HOST
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


def member_is_host(
    room_code: str,
    member_connection: dict,
):
    if room_code not in rooms:
        return False

    return (
        member_connection[
            "id"
        ]
        ==
        rooms[
            room_code
        ].get(
            "host_member_id"
        )
    )


# =========================================================
# MEMBERS
# =========================================================

async def broadcast_members(
    room_code: str,
):
    if room_code not in rooms:
        return

    room_connections = (
        connections.get(
            room_code,
            [],
        )
    )

    room = rooms[
        room_code
    ]

    host_member_id = room.get(
        "host_member_id"
    )

    members = []

    for connection in room_connections:

        is_host = (
            connection[
                "id"
            ]
            ==
            host_member_id
        )

        display_name = (
            f"{connection['name']} (Host)"
            if is_host
            else connection[
                "name"
            ]
        )

        members.append(
            {
                "id":
                    connection[
                        "id"
                    ],

                "name":
                    display_name,

                "raw_name":
                    connection[
                        "name"
                    ],

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

            "max_members":
                room.get(
                    "max_members",
                    8,
                ),
        },
    )


# =========================================================
# ROOM SETTINGS
# =========================================================

async def broadcast_room_settings(
    room_code: str,
):
    if room_code not in rooms:
        return

    room = rooms[
        room_code
    ]

    await broadcast_room_event(
        room_code,
        {
            "type":
                "room_settings",

            "playback_control_mode":
                room.get(
                    "playback_control_mode",
                    "everyone",
                ),

            "host_member_id":
                room.get(
                    "host_member_id"
                ),

            "host_name":
                room.get(
                    "host_name"
                ),

            "max_members":
                room.get(
                    "max_members",
                    8,
                ),

            "is_locked":
                bool(
                    room.get(
                        "is_locked",
                        False,
                    )
                ),
        },
    )


# =========================================================
# QUEUE BROADCAST
# =========================================================

async def broadcast_queue(
    room_code: str,
):
    if room_code not in rooms:
        return

    await broadcast_room_event(
        room_code,
        {
            "type":
                "queue_updated",

            "queue":
                rooms[
                    room_code
                ][
                    "queue"
                ],
        },
    )


# =========================================================
# PLAYBACK PERMISSION
# =========================================================

def member_can_control_playback(
    room_code: str,
    member_connection: dict,
):
    if room_code not in rooms:
        return False

    room = rooms[
        room_code
    ]

    mode = room.get(
        "playback_control_mode",
        "everyone",
    )

    if mode == "everyone":
        return True

    return member_is_host(
        room_code,
        member_connection,
    )


async def send_permission_error(
    websocket: WebSocket,
):
    await websocket.send_json(
        {
            "type":
                "permission_error",

            "message":
                "Only the host can control playback in Host Only mode.",
        }
    )


# =========================================================
# SONG HELPERS
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
        room[
            "queue"
        ]
    ):

        if song[
            "id"
        ] == song_id:
            return index

    return -1


# =========================================================
# DELETE SONG FILE
# =========================================================

def delete_song_file(
    room_code: str,
    song: dict,
):
    song_url = str(
        song.get(
            "url",
            "",
        )
    ).strip()

    if not song_url:
        return

    filename = Path(
        song_url
    ).name

    if not filename:
        return

    room_directory = (
        TEMP_ROOMS_DIRECTORY
        /
        room_code
    ).resolve()

    file_path = (
        room_directory
        /
        filename
    ).resolve()

    if (
        file_path.parent
        !=
        room_directory
    ):
        return

    try:
        file_path.unlink(
            missing_ok=True
        )

    except Exception as error:
        print(
            "Failed to delete song file:",
            error,
        )


# =========================================================
# PLAYBACK STATE
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
            >=
            len(queue) - 1
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
            previous_song = queue[-1]

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
# PLAYBACK MODE
# =========================================================

async def handle_playback_mode_change(
    websocket: WebSocket,
    room_code: str,
    member_connection: dict,
    data: dict,
):
    if not member_is_host(
        room_code,
        member_connection,
    ):

        await websocket.send_json(
            {
                "type":
                    "permission_error",

                "message":
                    "Only the host can change playback permissions.",
            }
        )

        return

    mode = data.get(
        "mode"
    )

    if mode not in {
        "everyone",
        "host_only",
    }:
        return

    rooms[
        room_code
    ][
        "playback_control_mode"
    ] = mode

    await broadcast_room_settings(
        room_code
    )


# =========================================================
# ROOM LOCK
# =========================================================

async def handle_room_lock_change(
    websocket: WebSocket,
    room_code: str,
    member_connection: dict,
    data: dict,
):
    if not member_is_host(
        room_code,
        member_connection,
    ):

        await websocket.send_json(
            {
                "type":
                    "permission_error",

                "message":
                    "Only the host can lock or unlock the room.",
            }
        )

        return

    locked = data.get(
        "locked"
    )

    if not isinstance(
        locked,
        bool,
    ):
        return

    rooms[
        room_code
    ][
        "is_locked"
    ] = locked

    await broadcast_room_settings(
        room_code
    )


# =========================================================
# REMOVE SONG
# =========================================================

async def handle_remove_song(
    websocket: WebSocket,
    room_code: str,
    member_connection: dict,
    data: dict,
):
    if not member_is_host(
        room_code,
        member_connection,
    ):

        await websocket.send_json(
            {
                "type":
                    "permission_error",

                "message":
                    "Only the host can remove songs from the queue.",
            }
        )

        return

    room = rooms[
        room_code
    ]

    song_id = str(
        data.get(
            "song_id",
            "",
        )
    ).strip()

    if not song_id:
        return

    song_index = (
        get_song_index(
            room_code,
            song_id,
        )
    )

    if song_index == -1:

        await websocket.send_json(
            {
                "type":
                    "queue_action_result",

                "message":
                    "Song not found.",
            }
        )

        return

    removed_song = (
        room[
            "queue"
        ].pop(
            song_index
        )
    )

    removed_current_song = (
        room.get(
            "current_song"
        )
        ==
        song_id
    )

    if removed_current_song:

        room[
            "current_song"
        ] = None

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

    delete_song_file(
        room_code,
        removed_song,
    )

    await broadcast_queue(
        room_code
    )

    if removed_current_song:

        await broadcast_playback_state(
            room_code,
            "song_removed",
        )

    await websocket.send_json(
        {
            "type":
                "queue_action_result",

            "message":
                "Song removed from queue.",
        }
    )


# =========================================================
# MOVE SONG
# =========================================================

async def handle_move_song(
    websocket: WebSocket,
    room_code: str,
    member_connection: dict,
    data: dict,
):
    if not member_is_host(
        room_code,
        member_connection,
    ):

        await websocket.send_json(
            {
                "type":
                    "permission_error",

                "message":
                    "Only the host can reorder the queue.",
            }
        )

        return

    room = rooms[
        room_code
    ]

    song_id = str(
        data.get(
            "song_id",
            "",
        )
    ).strip()

    direction = str(
        data.get(
            "direction",
            "",
        )
    ).strip().lower()

    if direction not in {
        "up",
        "down",
    }:
        return

    current_index = (
        get_song_index(
            room_code,
            song_id,
        )
    )

    if current_index == -1:
        return

    queue = room[
        "queue"
    ]

    if direction == "up":

        if current_index == 0:
            return

        target_index = (
            current_index - 1
        )

    else:

        if (
            current_index
            >=
            len(queue) - 1
        ):
            return

        target_index = (
            current_index + 1
        )

    queue[
        current_index
    ], queue[
        target_index
    ] = (
        queue[
            target_index
        ],
        queue[
            current_index
        ],
    )

    await broadcast_queue(
        room_code
    )

    await websocket.send_json(
        {
            "type":
                "queue_action_result",

            "message":
                "Queue order updated.",
        }
    )


# =========================================================
# HANDLE MESSAGE
# =========================================================

async def handle_room_message(
    websocket: WebSocket,
    room_code: str,
    member_connection: dict,
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

        return


    if message_type == "state_request":

        await handle_state_request(
            websocket,
            room_code,
        )

        return


    if message_type == "set_playback_mode":

        await handle_playback_mode_change(
            websocket,
            room_code,
            member_connection,
            data,
        )

        return


    if message_type == "set_room_lock":

        await handle_room_lock_change(
            websocket,
            room_code,
            member_connection,
            data,
        )

        return


    if message_type == "remove_song":

        await handle_remove_song(
            websocket,
            room_code,
            member_connection,
            data,
        )

        return


    if message_type == "move_song":

        await handle_move_song(
            websocket,
            room_code,
            member_connection,
            data,
        )

        return


    playback_commands = {
        "select_song",
        "play",
        "pause",
        "seek",
        "next",
        "previous",
    }


    if (
        message_type
        in
        playback_commands
    ):

        allowed = (
            member_can_control_playback(
                room_code,
                member_connection,
            )
        )

        if not allowed:

            await send_permission_error(
                websocket
            )

            return


    if message_type == "select_song":

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
# WEBSOCKET
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

    name = (
        name.strip()
        or
        "Guest"
    )


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


    room = rooms[
        room_code
    ]

    room_connections = (
        connections.get(
            room_code,
            [],
        )
    )


    if room.get(
        "is_locked",
        False,
    ):

        await websocket.accept()

        await websocket.send_json(
            {
                "type":
                    "room_locked",

                "message":
                    "Room is locked. Ask the host to unlock it.",
            }
        )

        await websocket.close(
            code=1008
        )

        return


    max_members = int(
        room.get(
            "max_members",
            8,
        )
    )

    if (
        len(
            room_connections
        )
        >=
        max_members
    ):

        await websocket.accept()

        await websocket.send_json(
            {
                "type":
                    "room_full",

                "message":
                    (
                        f"Room is full "
                        f"({len(room_connections)}/{max_members})"
                    ),
            }
        )

        await websocket.close(
            code=1008
        )

        return


    cancel_room_cleanup(
        room_code
    )


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


    if not room.get(
        "host_member_id"
    ):

        set_room_host(
            room_code,
            member_connection,
        )


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
                    member_is_host(
                        room_code,
                        member_connection,
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


    await websocket.send_json(
        {
            "type":
                "room_state",

            "server_time":
                time.time(),

            "room": {
                "code":
                    room_code,

                "name":
                    room.get(
                        "name",
                        "Music Room",
                    ),

                "max_members":
                    room.get(
                        "max_members",
                        8,
                    ),

                "is_locked":
                    bool(
                        room.get(
                            "is_locked",
                            False,
                        )
                    ),

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

                "playback_control_mode":
                    room[
                        "playback_control_mode"
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

    await broadcast_room_settings(
        room_code
    )


    try:

        while True:

            message = (
                await websocket.receive_text()
            )

            await handle_room_message(
                websocket,
                room_code,
                member_connection,
                message,
            )


    except WebSocketDisconnect:
        pass


    except Exception as error:

        print(
            "WebSocket error:",
            error,
        )


    finally:

        room_connections = (
            connections.get(
                room_code,
                [],
            )
        )


        if (
            member_connection
            in
            room_connections
        ):

            room_connections.remove(
                member_connection
            )


        if room_code not in rooms:
            return


        room = rooms[
            room_code
        ]


        if (
            room.get(
                "host_member_id"
            )
            ==
            member_id
        ):

            if room_connections:

                set_room_host(
                    room_code,
                    room_connections[0],
                )

            else:

                set_room_host(
                    room_code,
                    None,
                )


        if room_connections:

            await broadcast_members(
                room_code
            )

            await broadcast_room_settings(
                room_code
            )


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