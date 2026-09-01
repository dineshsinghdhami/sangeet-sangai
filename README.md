# # Sangeet Sangai – Real-Time Synchronized Music Platform

A full-stack **real-time synchronized music listening platform** where users can create temporary music rooms, share room codes, join from different locations, upload songs temporarily, and listen together with synchronized playback.

The project is currently focused on building the web version first, with a mobile application planned for future development.

---

## # Overview

Sangeet Sangai aims to create a collaborative music listening experience where multiple users can join the same virtual room and listen to the same song at approximately the same time, regardless of their location.

A user can create a room and receive a unique room code. Other users can enter that code to join the same room in real time.

Users inside the room will be able to upload songs temporarily, add them to a shared queue, and control playback collaboratively.

Uploaded songs will not be permanently stored. They will remain available only while the room is active and will be automatically removed after the room expires.

The project will first be developed as a web application, followed by a mobile application using the same backend and real-time communication system.

---

## # Features

### # Implemented

* Initial project repository setup
* Basic project structure
* Git configuration

### # In Progress

* React frontend setup
* FastAPI backend setup
* Room creation system
* Unique room code generation
* Real-time room joining
* WebSocket communication

### # Planned

* Create temporary music rooms
* Join rooms using unique room codes
* Real-time participant list
* Temporary music uploads
* Automatic uploaded-song cleanup
* Shared music queue
* Synchronized play and pause
* Synchronized seek
* Synchronized skip and next track
* Collaborative playback controls
* Host and member permissions
* Real-time room state synchronization
* Playback drift correction
* Automatic reconnection
* Room expiration and cleanup
* User authentication
* Room chat
* Song voting
* Vote-to-skip system
* Responsive web interface
* Cloud deployment
* Mobile application

---

## # Tech Stack

### # Frontend

* React
* Vite
* JavaScript
* CSS

### # Backend

* FastAPI
* Python

### # Real-Time Communication

* WebSockets

### # Database

* PostgreSQL

### # Temporary State Management

* Redis (Planned)

### # Audio Storage

* Temporary server-side file storage
* Automatic cleanup after room expiration

### # Mobile Application

* React Native (Future)

---

## # Project Structure

```text
sangeet-sangai/
│
├── backend/
├── frontend/
├── README.md
└── .gitignore
```

The project structure will expand as development continues.

---

## # Project Goals

* Learn real-time web application development
* Build a collaborative music listening platform
* Understand WebSocket communication
* Implement synchronized audio playback
* Learn frontend and backend integration
* Implement temporary file management
* Handle real-time room state
* Learn PostgreSQL database integration
* Explore Redis for temporary room state
* Build a responsive full-stack application
* Deploy the project to the cloud
* Extend the web platform into a mobile application

---

## # Current Progress

* ✅ Project concept finalized
* ✅ Project name finalized
* ✅ Repository structure planned
* 🔄 Initial repository setup
* ⏳ React frontend initialization
* ⏳ FastAPI backend initialization
* ⏳ Frontend and backend communication
* ⏳ Room creation
* ⏳ Room code generation
* ⏳ Real-time room joining
* ⏳ WebSocket integration
* ⏳ Temporary audio upload
* ⏳ Shared music queue
* ⏳ Synchronized playback
* ⏳ Playback drift correction
* ⏳ PostgreSQL integration
* ⏳ Redis integration
* ⏳ Authentication
* ⏳ Testing
* ⏳ Cloud deployment
* ⏳ Mobile application

---

## # How Sangeet Sangai Works

```text
User creates a room
        ↓
System generates a unique room code
        ↓
Room code is shared with other users
        ↓
Users enter the code and join the room
        ↓
WebSocket connects all room members
        ↓
A user uploads a song temporarily
        ↓
Song is added to the shared queue
        ↓
A member starts playback
        ↓
Backend broadcasts synchronized playback state
        ↓
Everyone listens together
        ↓
Room becomes inactive
        ↓
Temporary songs and room data are removed
```

---

## # Temporary Music Storage

Sangeet Sangai is designed so that uploaded music does not need to remain permanently stored.

When a user uploads a song:

```text
Upload Song
    ↓
Temporary Backend Storage
    ↓
Available to Current Room
    ↓
Users Stream the Same Audio
    ↓
Room Ends
    ↓
Audio File Automatically Deleted
```

This approach keeps the project focused on temporary collaborative listening rather than building a permanent music library.

---

## # Learning Journey

This repository documents my journey of learning and implementing:

* Python
* FastAPI
* React
* Vite
* JavaScript
* PostgreSQL
* Redis
* WebSockets
* REST API Development
* Real-Time Communication
* Audio Streaming
* Audio Synchronization
* Temporary File Management
* Full Stack Development
* Cloud Deployment
* React Native

---

## # Future Improvements

* Mobile application for Android and iOS
* Better playback synchronization
* Automatic latency compensation
* Advanced playback drift correction
* Private and public rooms
* Room passwords
* User profiles
* Friends system
* Room chat
* Song reactions
* Vote-to-skip
* Collaborative playlists
* Host permission controls
* Audio waveform visualization
* Room history
* Improved reconnect handling
* Docker support
* CI/CD pipeline
* Cloud object storage
* Scalable WebSocket infrastructure
* Improved Redis-based room state management

---

## # Contributions

This project is being developed as a learning project while exploring Real-Time Communication, Audio Synchronization, WebSockets, and Full Stack Development.

Feedback, suggestions, and contributions are always welcome.

---

## # Author

**Dinesh Singh Dhami**

* Website: https://dineshsinghdhami.com.np/
* GitHub: https://github.com/dineshsinghdhami/
* LinkedIn: https://www.linkedin.com/in/dineshsinghdhami2/
* Email: [dineshdhamidn@gmail.com](mailto:dineshdhamidn@gmail.com)
