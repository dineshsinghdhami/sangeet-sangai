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


connections = {}


async def broadcast_members(room_code: str):
    room_connections = connections.get(
        room_code,
        [],
    )

    members = [
        {
            "id": connection["id"],
            "name": connection["name"],
        }
        for connection in room_connections
    ]

    if room_code in rooms:
        rooms[room_code]["members"] = members

    broken_connections = []

    for connection in room_connections:
        try:
            await connection[
                "websocket"
            ].send_json(
                {
                    "type": "members_updated",
                    "members": members,
                }
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


@router.websocket(
    "/ws/rooms/{room_code}"
)
async def room_websocket(
    websocket: WebSocket,
    room_code: str,
    name: str = "Guest",
):
    room_code = room_code.strip().upper()
    name = name.strip()

    if not name:
        name = "Guest"

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

    await websocket.accept()

    member_id = str(
        uuid.uuid4()
    )

    member_connection = {
        "id": member_id,
        "name": name,
        "websocket": websocket,
    }

    if room_code not in connections:
        connections[room_code] = []

    connections[
        room_code
    ].append(
        member_connection
    )

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

    await broadcast_members(
        room_code
    )

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

        if room_connections:
            await broadcast_members(
                room_code
            )

        else:
            connections.pop(
                room_code,
                None,
            )

            if room_code in rooms:
                rooms[
                    room_code
                ]["members"] = []