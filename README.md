# # Sangeet Sangai

![React](https://img.shields.io/badge/React-Vite-blue)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-green)
![WebSocket](https://img.shields.io/badge/Realtime-WebSocket-purple)
![Status](https://img.shields.io/badge/Status-Almost%20Complete-orange)

**Sangeet Sangai** is a real-time synchronized music listening platform built so friends living in different locations can listen to the same music together at approximately the same time.

> **Note:** The idea came from a personal situation: some of my friends live far away, including in foreign countries, while I am in Nepal. We wanted a simple way to listen to the same song together in sync, so I started building Sangeet Sangai.

Friends can create temporary music rooms, share room codes, upload songs temporarily, manage a shared queue, and control synchronized playback in real time.

## # Features

- Create music rooms
- Join rooms using room codes
- Real-time member list
- Host and member roles
- Room lock and unlock
- Maximum member limit
- Temporary music uploads
- Shared music queue
- Queue reorder and song removal
- Synchronized play, pause and seek
- Previous and next song controls
- Host-only or everyone playback control
- Playback drift correction
- Temporary room and audio cleanup
- Responsive desktop, tablet and mobile design

## # Live Demo

https://dhamielectronics.pythonanywhere.com/

## # Tech Stack

- **Frontend:** React, Vite, JavaScript, CSS
- **Backend:** FastAPI, Python
- **Real-Time Communication:** WebSockets
- **Room State:** In-memory state management
- **Browser Persistence:** Session Storage
- **Audio Storage:** Temporary server-side storage
- **Database:** PostgreSQL planned
- **Temporary State:** Redis planned
- **Mobile:** React Native planned

## # How It Works

```text
User Creates Room
        ↓
Unique Room Code Generated
        ↓
Friends Join Using Room Code
        ↓
WebSocket Connects All Members
        ↓
Music Is Uploaded Temporarily
        ↓
Song Added To Shared Queue
        ↓
Play / Pause / Seek
        ↓
Backend Synchronizes Playback
        ↓
Everyone Listens Together
```

## # Project Structure

```text
sangeet-sangai/
├── backend/
│   ├── main.py
│   └── uploads/
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   └── package.json
├── README.md
└── .gitignore
```

## # Current Status

The main web application is almost complete.

Currently working:

- Room creation and joining
- Real-time member synchronization
- Music upload
- Shared queue
- Synchronized playback
- Host controls
- Room permissions
- Refresh reconnection
- Responsive UI

Remaining work mainly includes final testing, bug fixing, deployment, and future features.

## # Future Improvements

- PostgreSQL integration
- Redis-based room state
- User authentication
- Private rooms
- Room passwords
- Room chat
- Song voting
- Vote-to-skip
- Collaborative playlists
- Cloud storage
- Docker and CI/CD
- Android and iOS application

## # Contributions

This project is being developed as a personal learning project focused on real-time communication, WebSockets, audio synchronization, React, FastAPI, and full-stack development.

Feedback and suggestions are welcome.

## # Author

**Dinesh Singh Dhami**

- Website: https://dineshsinghdhami.com.np
- GitHub: https://github.com/dineshsinghdhami
- LinkedIn: https://www.linkedin.com/in/dineshsinghdhami2/
- Email: dineshdhamidn@gmail.com
