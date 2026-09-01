import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import (
    APIRouter,
    File,
    Form,
    HTTPException,
    UploadFile,
)

from app.api.rooms import rooms
from app.api.websocket import broadcast_room_event


router = APIRouter(
    prefix="/api/rooms",
    tags=["Audio"],
)


# ---------------------------------------------------------
# STORAGE PATH
# ---------------------------------------------------------

BACKEND_DIRECTORY = Path(__file__).resolve().parents[2]

TEMP_ROOMS_DIRECTORY = (
    BACKEND_DIRECTORY
    / "temp"
    / "rooms"
)


# ---------------------------------------------------------
# UPLOAD SETTINGS
# ---------------------------------------------------------

ALLOWED_AUDIO_EXTENSIONS = {
    ".mp3",
    ".wav",
    ".ogg",
    ".m4a",
}

MAX_FILE_SIZE = 25 * 1024 * 1024

CHUNK_SIZE = 1024 * 1024


# ---------------------------------------------------------
# UPLOAD SONG
# ---------------------------------------------------------

@router.post("/{room_code}/songs")
async def upload_song(
    room_code: str,
    file: UploadFile = File(...),
    uploader_name: str = Form("Guest"),
):
    room_code = room_code.strip().upper()

    uploader_name = uploader_name.strip()

    if not uploader_name:
        uploader_name = "Guest"


    # -----------------------------------------------------
    # CHECK ROOM
    # -----------------------------------------------------

    if room_code not in rooms:
        raise HTTPException(
            status_code=404,
            detail="Room not found",
        )


    # -----------------------------------------------------
    # CHECK FILE NAME
    # -----------------------------------------------------

    original_filename = Path(
        file.filename or ""
    ).name

    if not original_filename:
        raise HTTPException(
            status_code=400,
            detail="Invalid file name",
        )


    # -----------------------------------------------------
    # CHECK EXTENSION
    # -----------------------------------------------------

    extension = Path(
        original_filename
    ).suffix.lower()

    if extension not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported audio format. "
                "Allowed formats: MP3, WAV, OGG and M4A"
            ),
        )


    # -----------------------------------------------------
    # CREATE ROOM STORAGE DIRECTORY
    # -----------------------------------------------------

    room_directory = (
        TEMP_ROOMS_DIRECTORY
        / room_code
    )

    room_directory.mkdir(
        parents=True,
        exist_ok=True,
    )


    # -----------------------------------------------------
    # GENERATE UNIQUE SONG ID
    # -----------------------------------------------------

    song_id = uuid.uuid4().hex

    stored_filename = (
        f"{song_id}{extension}"
    )

    destination = (
        room_directory
        / stored_filename
    )


    # -----------------------------------------------------
    # SAVE FILE TEMPORARILY
    # -----------------------------------------------------

    total_size = 0

    try:
        with destination.open("wb") as output_file:

            while True:
                chunk = await file.read(
                    CHUNK_SIZE
                )

                if not chunk:
                    break

                total_size += len(chunk)

                if total_size > MAX_FILE_SIZE:

                    output_file.close()

                    if destination.exists():
                        destination.unlink()

                    raise HTTPException(
                        status_code=413,
                        detail=(
                            "Audio file is too large. "
                            "Maximum size is 25 MB."
                        ),
                    )

                output_file.write(chunk)

    finally:
        await file.close()


    # -----------------------------------------------------
    # SONG TITLE
    # -----------------------------------------------------

    title = Path(
        original_filename
    ).stem


    # -----------------------------------------------------
    # PUBLIC TEMPORARY AUDIO URL
    # -----------------------------------------------------

    audio_url = (
        f"/temp/rooms/"
        f"{room_code}/"
        f"{stored_filename}"
    )


    # -----------------------------------------------------
    # SONG INFORMATION
    # -----------------------------------------------------

    song = {
        "id": song_id,
        "title": title,
        "original_name": original_filename,
        "url": audio_url,
        "size_bytes": total_size,
        "uploaded_by": uploader_name,
        "uploaded_at": datetime.now(
            timezone.utc
        ).isoformat(),
    }


    # -----------------------------------------------------
    # ADD SONG TO ROOM QUEUE
    # -----------------------------------------------------

    rooms[
        room_code
    ]["queue"].append(
        song
    )


    # -----------------------------------------------------
    # REAL-TIME QUEUE UPDATE
    # -----------------------------------------------------

    await broadcast_room_event(
        room_code,
        {
            "type": "queue_updated",
            "queue": rooms[
                room_code
            ]["queue"],
        },
    )


    # -----------------------------------------------------
    # RESPONSE
    # -----------------------------------------------------

    return {
        "status": "success",
        "message": "Song uploaded successfully",
        "song": song,
        "queue": rooms[
            room_code
        ]["queue"],
    }