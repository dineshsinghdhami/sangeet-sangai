from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.rooms import router as rooms_router


app = FastAPI(
    title="Sangeet Sangai API",
    version="0.1.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(rooms_router)


@app.get("/")
def root():
    return {
        "message": "Sangeet Sangai backend is running"
    }


@app.get("/api/status")
def status():
    return {
        "status": "success",
        "message": "Frontend connected to Sangeet Sangai backend"
    }