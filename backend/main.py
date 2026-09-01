from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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