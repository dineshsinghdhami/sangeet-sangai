import asyncio
import shutil
from pathlib import Path

from app.api.rooms import rooms


# =========================================================
# SETTINGS
# =========================================================

# Keep this at 30 seconds while testing.
# After testing, we will change it to 300 seconds.
ROOM_EMPTY_TTL_SECONDS = 300


# =========================================================
# PATHS
# =========================================================

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
# ACTIVE CLEANUP TASKS
# =========================================================

cleanup_tasks = {}


# =========================================================
# DELETE ROOM
# =========================================================

async def delete_room(
    room_code: str,
):
    room_code = (
        room_code
        .strip()
        .upper()
    )

    room = rooms.get(
        room_code
    )

    if not room:
        return

    # If somebody rejoined,
    # do not delete the room.
    if room.get(
        "members"
    ):
        return

    room_directory = (
        TEMP_ROOMS_DIRECTORY
        / room_code
    )

    if room_directory.exists():
        try:
            shutil.rmtree(
                room_directory
            )

        except Exception as error:
            print(
                "Failed to delete room files:",
                error,
            )

    rooms.pop(
        room_code,
        None,
    )

    cleanup_tasks.pop(
        room_code,
        None,
    )

    print(
        f"Room {room_code} deleted"
    )


# =========================================================
# DELAYED CLEANUP
# =========================================================

async def cleanup_room_after_delay(
    room_code: str,
):
    try:
        await asyncio.sleep(
            ROOM_EMPTY_TTL_SECONDS
        )

        await delete_room(
            room_code
        )

    except asyncio.CancelledError:
        pass


# =========================================================
# SCHEDULE CLEANUP
# =========================================================

def schedule_room_cleanup(
    room_code: str,
):
    room_code = (
        room_code
        .strip()
        .upper()
    )

    existing_task = (
        cleanup_tasks.get(
            room_code
        )
    )

    if (
        existing_task
        and
        not existing_task.done()
    ):
        existing_task.cancel()

    cleanup_tasks[
        room_code
    ] = asyncio.create_task(
        cleanup_room_after_delay(
            room_code
        )
    )

    print(
        f"Cleanup scheduled for room {room_code}"
    )


# =========================================================
# CANCEL CLEANUP
# =========================================================

def cancel_room_cleanup(
    room_code: str,
):
    room_code = (
        room_code
        .strip()
        .upper()
    )

    task = cleanup_tasks.pop(
        room_code,
        None,
    )

    if (
        task
        and
        not task.done()
    ):
        task.cancel()

        print(
            f"Cleanup cancelled for room {room_code}"
        )