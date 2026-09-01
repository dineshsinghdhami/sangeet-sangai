from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.audio import router as audio_router
from app.api.rooms import router as rooms_router
from app.api.websocket import router as websocket_router


# ---------------------------------------------------------
# TEMP DIRECTORY
# ---------------------------------------------------------

BACKEND_DIRECTORY = Path(
    __file__
).resolve().parent

TEMP_DIRECTORY = (
    BACKEND_DIRECTORY
    / "temp"
)

TEMP_DIRECTORY.mkdir(
    parents=True,
    exist_ok=True,
)


# ---------------------------------------------------------
# FASTAPI APP
# ---------------------------------------------------------

app = FastAPI(
    title="Sangeet Sangai API",
    version="0.1.0",
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# ROUTERS
# ---------------------------------------------------------

app.include_router(
    rooms_router
)

app.include_router(
    audio_router
)

app.include_router(
    websocket_router
)


# ---------------------------------------------------------
# TEMPORARY AUDIO FILES
# ---------------------------------------------------------

app.mount(
    "/temp",
    StaticFiles(
        directory=str(
            TEMP_DIRECTORY
        )
    ),
    name="temp",
)


# ---------------------------------------------------------
# ROOT
# ---------------------------------------------------------

@app.get("/")
def root():

    return {
        "message":
            "Sangeet Sangai backend is running"
    }


# ---------------------------------------------------------
# STATUS
# ---------------------------------------------------------

@app.get("/api/status")
def status():

    return {
        "status": "success",
        "message":
            "Frontend connected to Sangeet Sangai backend"
    }