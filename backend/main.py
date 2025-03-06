from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio, time
from models import CreateGameRequest, JoinGameRequest, StartGameRequest, PlayCardRequest, NextRoundRequest, GameState
from database import get_db_connection, create_tables, create_game, join_game, start_game, play_card, next_round, get_game_state

app = FastAPI()

# Configuração de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gerenciador de conexões WebSocket
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, game_id: str, websocket: WebSocket):
        await websocket.accept()
        if game_id not in self.active_connections:
            self.active_connections[game_id] = []
        self.active_connections[game_id].append(websocket)

    def disconnect(self, game_id: str, websocket: WebSocket):
        if game_id in self.active_connections:
            self.active_connections[game_id].remove(websocket)
            if not self.active_connections[game_id]:
                del self.active_connections[game_id]

    async def broadcast(self, game_id: str, message: str):
        if game_id in self.active_connections:
            for connection in self.active_connections[game_id]:
                await connection.send_text(message)

manager = ConnectionManager()

# Inicializa o banco de dados ao iniciar o app
@app.on_event("startup")
def startup():
    create_tables()

# Endpoint WebSocket para atualizações em tempo real
@app.websocket("/ws/{game_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: str):
    await manager.connect(game_id, websocket)
    try:
        while True:
            # Cria duas tasks: uma pra receber mensagens e outra pra enviar ping a cada 200ms
            receive_task = asyncio.create_task(websocket.receive_text())
            ping_task = asyncio.create_task(asyncio.sleep(0.2))
            done, pending = await asyncio.wait([receive_task, ping_task], return_when=asyncio.FIRST_COMPLETED)
            if ping_task in done:
                # Envia ping com timestamp (o client pode usar para medir latência)
                await websocket.send_text(json.dumps({"type": "ping", "timestamp": time.time()}))
            if receive_task in done:
                data = receive_task.result()
                # Se a mensagem for um pong, pode ignorar; caso contrário, apenas mantenha a conexão
                try:
                    msg = json.loads(data)
                    if msg.get("type") == "pong":
                        # opcional: processar latência se desejar
                        continue
                except Exception:
                    pass  # Trata outros dados recebidos se houver necessidade
    except WebSocketDisconnect:
        manager.disconnect(game_id, websocket)

# Cria um novo jogo
@app.post("/create_game", response_model=GameState)
async def create_game_endpoint(request: CreateGameRequest):
    conn = get_db_connection()
    game_id = create_game(conn, request.player_name)
    state = get_game_state(conn, game_id)
    conn.close()
    return GameState(**state)

# Adiciona um jogador a um jogo
@app.post("/join_game", response_model=GameState)
async def join_game_endpoint(request: JoinGameRequest):
    conn = get_db_connection()
    success = join_game(conn, request.game_id, request.player_name)
    if not success:
        conn.close()
        raise HTTPException(status_code=403, detail="Cannot join game - already started or name taken")
    state = get_game_state(conn, request.game_id)
    conn.close()
    await manager.broadcast(request.game_id, json.dumps(state))
    return GameState(**state)

# Inicia o jogo
@app.post("/start_game", response_model=GameState)
async def start_game_endpoint(request: StartGameRequest):
    conn = get_db_connection()
    success = start_game(conn, request.game_id)
    if not success:
        conn.close()
        raise HTTPException(status_code=400, detail="Cannot start game - not enough players or already started")
    state = get_game_state(conn, request.game_id)
    conn.close()
    await manager.broadcast(request.game_id, json.dumps(state))
    return GameState(**state)

# Registra uma carta jogada
@app.post("/play_card", response_model=GameState)
async def play_card_endpoint(request: PlayCardRequest):
    conn = get_db_connection()
    result = play_card(conn, request.game_id, request.player_id, request.card_value)
    if result == 'invalid_game':
        conn.close()
        raise HTTPException(status_code=404, detail="Game not found or not in playing state")
    elif result == 'invalid_card':
        conn.close()
        raise HTTPException(status_code=400, detail="Card not in player's hand")
    elif result == 'invalid_order' or result == 'restart_round':
        state = get_game_state(conn, request.game_id)
        conn.close()
        await manager.broadcast(request.game_id, json.dumps(state))
        return GameState(**state)
    elif result == 'game_over':
        state = get_game_state(conn, request.game_id)
        conn.close()
        await manager.broadcast(request.game_id, json.dumps(state))
        return GameState(**state)
    elif result == 'round_end':
        state = get_game_state(conn, request.game_id)
        conn.close()
        await manager.broadcast(request.game_id, json.dumps(state))
        return GameState(**state)
    else:
        state = get_game_state(conn, request.game_id)
        conn.close()
        await manager.broadcast(request.game_id, json.dumps(state))
        return GameState(**state)

# Avança para a próxima rodada
@app.post("/next_round", response_model=GameState)
async def next_round_endpoint(request: NextRoundRequest):
    conn = get_db_connection()
    result = next_round(conn, request.game_id)
    if not result:
        conn.close()
        raise HTTPException(status_code=400, detail="Cannot start next round - round not ended")
    state = get_game_state(conn, request.game_id)
    conn.close()
    await manager.broadcast(request.game_id, json.dumps(state))
    return GameState(**state)

# Obtém o status do jogo
@app.get("/game_status/{game_id}", response_model=GameState)
async def get_game_status(game_id: str):
    conn = get_db_connection()
    state = get_game_state(conn, game_id)
    conn.close()
    return GameState(**state)
