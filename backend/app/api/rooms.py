import random
import string
import time

from fastapi import (
    APIRouter,
    HTTPException,
)
from pydantic import (
    BaseModel,
    Field,
)


router = APIRouter(
    prefix="/api/rooms",
    tags=["Rooms"],
)


rooms = {}


class CreateRoomRequest(BaseModel):
    name: str = ""
    max_members: int = Field(
        default=8,
        ge=2,
        le=20,
    )


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


@router.post("/create")
def create_room(
    request: CreateRoomRequest,
):
    room_code = (
        generate_room_code()
    )

    room_name = (
        request.name
        .strip()
    )

    if not room_name:
        room_name = "Music Room"

    room_name = room_name[:40]

    rooms[
        room_code
    ] = {
        "code":
            room_code,

        "name":
            room_name,

        "max_members":
            request.max_members,

        "members":
            [],

        "queue":
            [],

        "host_member_id":
            None,

        "host_name":
            None,

        "playback_control_mode":
            "everyone",

        "is_locked":
            False,

        "current_song":
            None,

        "is_playing":
            False,

        "current_position":
            0.0,

        "playback_started_at":
            None,

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
