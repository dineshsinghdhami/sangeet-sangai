import random
import string
import time

from fastapi import (
    APIRouter,
    HTTPException,
)


router = APIRouter(
    prefix="/api/rooms",
    tags=["Rooms"],
)


# =========================================================
# TEMPORARY ACTIVE ROOMS
# =========================================================

rooms = {}


# =========================================================
# GENERATE UNIQUE ROOM CODE
# =========================================================

def generate_room_code(
    length: int = 6,
):
    characters = (
        string.ascii_uppercase
        + string.digits
    )

    while True:
        code = "".join(
            random.choices(
                characters,
                k=length,
            )
        )

        if code not in rooms:
            return code


# =========================================================
# CREATE ROOM
# =========================================================

@router.post("/create")
def create_room():
    room_code = (
        generate_room_code()
    )

    rooms[
        room_code
    ] = {
        "code":
            room_code,

        "members":
            [],

        "queue":
            [],

        # First connected member becomes host.
        "host_member_id":
            None,

        "host_name":
            None,

        # Selected song.
        "current_song":
            None,

        # Playback state.
        "is_playing":
            False,

        # Base playback position.
        "current_position":
            0.0,

        # Server time when playback started.
        "playback_started_at":
            None,

        # Last playback update.
        "playback_updated_at":
            time.time(),
    }

    return {
        "status":
            "success",

        "message":
            "Room created successfully",

        "room":
            rooms[
                room_code
            ],
    }


# =========================================================
# GET EFFECTIVE PLAYBACK POSITION
# =========================================================

def get_effective_position(
    room: dict,
):
    position = float(
        room.get(
            "current_position",
            0.0,
        )
    )

    if not room.get(
        "is_playing",
        False,
    ):
        return max(
            0.0,
            position,
        )

    started_at = room.get(
        "playback_started_at"
    )

    if started_at is None:
        return max(
            0.0,
            position,
        )

    elapsed = max(
        0.0,
        time.time()
        -
        started_at,
    )

    return max(
        0.0,
        position
        +
        elapsed,
    )


# =========================================================
# GET ROOM
# =========================================================

@router.get("/{room_code}")
def get_room(
    room_code: str,
):
    room_code = (
        room_code
        .strip()
        .upper()
    )

    if room_code not in rooms:
        raise HTTPException(
            status_code=404,
            detail="Room not found",
        )

    room = rooms[
        room_code
    ]

    return {
        "status":
            "success",

        "room": {
            **room,

            "effective_position":
                get_effective_position(
                    room
                ),
        },
    }