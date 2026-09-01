import random
import string

from fastapi import APIRouter, HTTPException

router = APIRouter(
    prefix="/api/rooms",
    tags=["Rooms"]
)

rooms = {}


def generate_room_code(length: int = 6):
    characters = string.ascii_uppercase + string.digits

    while True:
        code = "".join(
            random.choices(characters, k=length)
        )

        if code not in rooms:
            return code


@router.post("/create")
def create_room():
    room_code = generate_room_code()

    rooms[room_code] = {
        "code": room_code,
        "members": [],
        "queue": [],
        "current_song": None,
        "is_playing": False,
    }

    return {
        "status": "success",
        "message": "Room created successfully",
        "room": rooms[room_code],
    }


@router.get("/{room_code}")
def get_room(room_code: str):
    room_code = room_code.upper()

    if room_code not in rooms:
        raise HTTPException(
            status_code=404,
            detail="Room not found"
        )

    return {
        "status": "success",
        "room": rooms[room_code],
    }