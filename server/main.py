
from collections import defaultdict
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timezone
import json

app = FastAPI(title="GapYar API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

connections = defaultdict(set)


@app.get("/")
async def home():
    return {
        "app": "GapYar",
        "status": "online",
        "message": "سرور گپ‌یار فعال است"
    }


@app.get("/health")
async def health():
    return {"ok": True}


@app.websocket("/ws/{username}")
async def chat(websocket: WebSocket, username: str):
    username = username.strip()

    if not username or len(username) > 30:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    connections[username].add(websocket)

    try:
        while True:
            raw = await websocket.receive_text()

            if len(raw) > 5000:
                continue

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            recipient = str(data.get("to", "")).strip()
            message = str(data.get("text", "")).strip()

            if not recipient or not message:
                continue

            if len(message) > 2000 or len(recipient) > 30:
                continue

            payload = {
                "from": username,
                "text": message,
                "time": datetime.now(timezone.utc).isoformat()
            }

            # تحویل پیام به تمام اتصال‌های آنلاین گیرنده
            for client in list(connections.get(recipient, set())):
                try:
                    await client.send_json(payload)
                except Exception:
                    connections[recipient].discard(client)

    except WebSocketDisconnect:
        pass
    finally:
        connections[username].discard(websocket)

        if not connections[username]:
            connections.pop(username, None)
