import uuid

from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect,
)

from app.api.rooms import rooms


router = APIRouter(
    tags=["Realtime"],
)


# ---------------------------------------------------------
# ACTIVE CONNECTIONS
# ---------------------------------------------------------

connections = {}


# ---------------------------------------------------------
# GENERIC ROOM BROADCAST
# ---------------------------------------------------------

async def broadcast_room_event(
    room_code: str,
    message: dict,
):
    room_connections = connections.get(
        room_code,
        [],
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


# ---------------------------------------------------------
# BROADCAST MEMBERS
# ---------------------------------------------------------

async def broadcast_members(
    room_code: str,
):
    room_connections = connections.get(
        room_code,
        [],
    )

    members = [
        {
            "id": connection["id"],
            "name": connection["name"],
        }

        for connection
        in room_connections
    ]


    if room_code in rooms:

        rooms[
            room_code
        ]["members"] = members


    await broadcast_room_event(
        room_code,
        {
            "type": "members_updated",
            "members": members,
        },
    )


# ---------------------------------------------------------
# ROOM WEBSOCKET
# ---------------------------------------------------------

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
    # CHECK ROOM
    # -----------------------------------------------------

    if room_code not in rooms:

        await websocket.accept()

        await websocket.send_json(
            {
                "type": "error",
                "message": "Room not found",
            }
        )

        await websocket.close(
            code=1008
        )

        return


    # -----------------------------------------------------
    # ACCEPT CONNECTION
    # -----------------------------------------------------

    await websocket.accept()


    # -----------------------------------------------------
    # CREATE MEMBER
    # -----------------------------------------------------

    member_id = str(
        uuid.uuid4()
    )


    member_connection = {
        "id": member_id,
        "name": name,
        "websocket": websocket,
    }


    # -----------------------------------------------------
    # CREATE CONNECTION LIST
    # -----------------------------------------------------

    if room_code not in connections:

        connections[
            room_code
        ] = []


    connections[
        room_code
    ].append(
        member_connection
    )


    # -----------------------------------------------------
    # SEND CONNECTION CONFIRMATION
    # -----------------------------------------------------

    await websocket.send_json(
        {
            "type": "connected",
            "room_code": room_code,
            "member": {
                "id": member_id,
                "name": name,
            },
        }
    )


    # -----------------------------------------------------
    # SEND CURRENT ROOM STATE
    # -----------------------------------------------------

    await websocket.send_json(
        {
            "type": "room_state",
            "room": {
                "code": room_code,
                "queue": rooms[
                    room_code
                ]["queue"],
                "current_song": rooms[
                    room_code
                ]["current_song"],
                "is_playing": rooms[
                    room_code
                ]["is_playing"],
            },
        }
    )


    # -----------------------------------------------------
    # BROADCAST MEMBER LIST
    # -----------------------------------------------------

    await broadcast_members(
        room_code
    )


    # -----------------------------------------------------
    # KEEP CONNECTION OPEN
    # -----------------------------------------------------

    try:

        while True:

            await websocket.receive_text()


    except WebSocketDisconnect:

        pass


    except Exception as error:

        print(
            "WebSocket error:",
            error,
        )


    finally:

        room_connections = connections.get(
            room_code,
            [],
        )


        if (
            member_connection
            in room_connections
        ):

            room_connections.remove(
                member_connection
            )


        # -------------------------------------------------
        # SOME MEMBERS STILL CONNECTED
        # -------------------------------------------------

        if room_connections:

            await broadcast_members(
                room_code
            )


        # -------------------------------------------------
        # ROOM NOW HAS NO CONNECTIONS
        # -------------------------------------------------

        else:

            connections.pop(
                room_code,
                None,
            )

            if room_code in rooms:

                rooms[
                    room_code
                ]["members"] = []