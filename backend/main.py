from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Response, Query, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Optional, Set
import random
import sqlite3
import logging
import json
import asyncio
import time
from fastapi.middleware.cors import CORSMiddleware

# Configurar logging para debug
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Cria uma única instância do FastAPI
app = FastAPI()

# Adicione o middleware CORSMiddleware padrão
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Ajuste para origens específicas em produção, ex.: ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Middleware personalizado para lidar com CORS e solicitações OPTIONS
@app.middleware("http")
async def add_cors_headers(request: Request, call_next):
    if request.method == "OPTIONS":
        response = Response()
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response

# Conexão com o banco de dados SQLite
def get_db_connection():
    conn = sqlite3.connect('game.db', check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

# Sistema de cache em memória para reduzir consultas ao banco de dados
class GameStateCache:
    def __init__(self):
        self.cache = {}
        self.last_updated = {}
        self.cache_ttl = 2  # segundos

    def get(self, game_id):
        if game_id in self.cache:
            if time.time() - self.last_updated.get(game_id, 0) < self.cache_ttl:
                return self.cache[game_id]
        return None

    def set(self, game_id, state):
        self.cache[game_id] = state
        self.last_updated[game_id] = time.time()

    def invalidate(self, game_id):
        if game_id in self.cache:
            del self.cache[game_id]
            del self.last_updated[game_id]

cache = GameStateCache()

# Criação das tabelas
conn = get_db_connection()
cursor = conn.cursor()

cursor.execute('''
CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    round INTEGER,
    lives INTEGER,
    status TEXT,
    last_update INTEGER
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    game_id TEXT,
    name TEXT,
    hand TEXT,
    FOREIGN KEY (game_id) REFERENCES games (id)
)
''')

cursor.execute('''
CREATE TABLE IF NOT EXISTS played_cards (
    game_id TEXT,
    player_id TEXT,
    card_value INTEGER,
    timestamp INTEGER,
    FOREIGN KEY (game_id) REFERENCES games (id)
)
''')

# Adicionar índices para melhor performance
cursor.execute('CREATE INDEX IF NOT EXISTS idx_players_game_id ON players (game_id)')
cursor.execute('CREATE INDEX IF NOT EXISTS idx_played_cards_game_id ON played_cards (game_id)')
cursor.execute('CREATE INDEX IF NOT EXISTS idx_games_status ON games (status)')

conn.commit()
conn.close()

# Modelos Pydantic
class CreateGameRequest(BaseModel):
    player_name: str

class JoinGameRequest(BaseModel):
    game_id: str
    player_name: str

class PlayCardRequest(BaseModel):
    game_id: str
    player_id: str
    card_value: int

class GameStateUpdate(BaseModel):
    type: str
    gameState: dict = None
    message: str = None

# Gerenciamento de WebSockets otimizado
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.player_connections: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, game_id: str, player_id: str, websocket: WebSocket):
        await websocket.accept()
        
        # Adicionar à lista de conexões por jogo
        if game_id not in self.active_connections:
            self.active_connections[game_id] = []
        self.active_connections[game_id].append(websocket)
        
        # Mapear conexão por jogador (para mensagens direcionadas)
        if game_id not in self.player_connections:
            self.player_connections[game_id] = {}
        self.player_connections[game_id][player_id] = websocket
        
        logger.info(f"WebSocket conectado: game_id={game_id}, player_id={player_id}")
        
        # Notificar todos sobre a nova conexão
        await self.broadcast_to_game(
            game_id, 
            GameStateUpdate(
                type="playerConnected",
                message=f"Jogador {player_id} conectou"
            ).dict()
        )

    def disconnect(self, game_id: str, websocket: WebSocket):
        # Remover das conexões por jogo
        if game_id in self.active_connections:
            if websocket in self.active_connections[game_id]:
                self.active_connections[game_id].remove(websocket)
                
            if not self.active_connections[game_id]:
                del self.active_connections[game_id]
        
        # Remover das conexões por jogador
        if game_id in self.player_connections:
            for player_id, ws in list(self.player_connections[game_id].items()):
                if ws == websocket:
                    del self.player_connections[game_id][player_id]
                    logger.info(f"WebSocket desconectado: game_id={game_id}, player_id={player_id}")
                    break
            
            if not self.player_connections[game_id]:
                del self.player_connections[game_id]

    async def broadcast_to_game(self, game_id: str, message: dict):
        """Envia mensagem para todos os jogadores em um jogo"""
        if game_id in self.active_connections:
            for connection in self.active_connections[game_id]:
                await connection.send_text(json.dumps(message))

    async def send_to_player(self, game_id: str, player_id: str, message: dict):
        """Envia mensagem para um jogador específico"""
        if game_id in self.player_connections and player_id in self.player_connections[game_id]:
            await self.player_connections[game_id][player_id].send_text(json.dumps(message))

manager = ConnectionManager()

# Funções auxiliares
def generate_game_id():
    return ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=6))

def generate_hand(round_number):
    return sorted(random.sample(range(1, 101), round_number))

def get_game_state(game_id: str) -> dict:
    cached_state = cache.get(game_id)
    if cached_state:
        return cached_state

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()
    if not game:
        raise ValueError(f"Game not found with ID: {game_id}")
    
    cursor.execute('SELECT * FROM players WHERE game_id = ?', (game_id,))
    players = cursor.fetchall()
    cursor.execute('SELECT card_value FROM played_cards WHERE game_id = ?', (game_id,))
    played_cards = [row['card_value'] for row in cursor.fetchall()]

    game_state = {
        "game_id": game['id'],
        "round": game['round'],
        "lives": game['lives'],
        "status": game['status'],
        "players": [{"id": player['id'], "name": player['name'], "hand": player['hand']} for player in players],
        "played_cards": played_cards
    }

    cache.set(game_id, game_state)
    return game_state

# Route para verificar que a API está funcionando
@app.get("/")
def read_root():
    return {"message": "The Mind - Game API"}

# Endpoints da API
@app.post("/create_game", response_model=dict)
async def create_game(request: CreateGameRequest):
    try:
        logger.info(f"Creating game for player: {request.player_name}")
        game_id = generate_game_id()
        round_number = 1
        lives = 3
        status = 'waiting'
        hand = generate_hand(round_number)

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('INSERT INTO games (id, round, lives, status, last_update) VALUES (?, ?, ?, ?, ?)', 
                     (game_id, round_number, lives, status, int(time.time())))
        cursor.execute('INSERT INTO players (id, game_id, name, hand) VALUES (?, ?, ?, ?)', 
                     (request.player_name, game_id, request.player_name, ','.join(map(str, hand))))
        conn.commit()
        conn.close()
        
        logger.info(f"Game created with ID: {game_id}")
        return get_game_state(game_id)
    except Exception as e:
        logger.error(f"Error creating game: {str(e)}")
        raise

@app.post("/join_game")
async def join_game(request: JoinGameRequest):
    try:
        logger.info(f"Player {request.player_name} joining game: {request.game_id}")
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM games WHERE id = ?', (request.game_id,))
        game = cursor.fetchone()
        if not game:
            logger.warning(f"Game not found: {request.game_id}")
            return JSONResponse(
                status_code=404,
                content={"error": f"Game not found with ID: {request.game_id}"}
            )

        # Verificar se o jogo está em espera
        if game['status'] != 'waiting':
            logger.warning(f"Game {request.game_id} is not in waiting status: {game['status']}")
            return JSONResponse(
                status_code=400,
                content={"error": "Cannot join game that is not in waiting status"}
            )

        # Verificar se o player_name já existe
        cursor.execute('SELECT * FROM players WHERE game_id = ? AND name = ?', 
                     (request.game_id, request.player_name))
        existing_player = cursor.fetchone()
        if existing_player:
            logger.warning(f"Player name {request.player_name} already exists in game {request.game_id}")
            return JSONResponse(
                status_code=400,
                content={"error": "Player name already exists in this game"}
            )

        hand = generate_hand(game['round'])
        cursor.execute('INSERT INTO players (id, game_id, name, hand) VALUES (?, ?, ?, ?)', 
                     (request.player_name, request.game_id, request.player_name, ','.join(map(str, hand))))
        conn.commit()
        conn.close()

        logger.info(f"Player {request.player_name} successfully joined game: {request.game_id}")
        return get_game_state(request.game_id)
    except Exception as e:
        logger.error(f"Error joining game: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Internal server error: {str(e)}"}
        )

@app.post("/play_card", response_model=dict)
async def play_card(request: PlayCardRequest):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM games WHERE id = ?', (request.game_id,))
    game = cursor.fetchone()
    cursor.execute('SELECT * FROM players WHERE id = ? AND game_id = ?', (request.player_id, request.game_id))
    player = cursor.fetchone()
    if not game or not player:
        return {"error": "Game or player not found"}

    hand = list(map(int, player['hand'].split(',')))
    if request.card_value not in hand:
        return {"error": "Card not in hand"}

    last_card = cursor.execute('SELECT MAX(card_value) FROM played_cards WHERE game_id = ?', (request.game_id,)).fetchone()[0] or 0
    if request.card_value <= last_card:
        cursor.execute('UPDATE games SET lives = lives - 1, last_update = ? WHERE id = ?', (int(time.time()), request.game_id))
        conn.commit()
        game = cursor.execute('SELECT * FROM games WHERE id = ?', (request.game_id,)).fetchone()
        if game['lives'] <= 0:
            cursor.execute('UPDATE games SET status = ?, last_update = ? WHERE id = ?', ('gameOver', int(time.time()), request.game_id))
            conn.commit()
            await manager.broadcast_to_game(request.game_id, GameStateUpdate(type="gameOver", message="Game Over").dict())
            return get_game_state(request.game_id)
        return {"error": "Invalid card"}

    hand.remove(request.card_value)
    cursor.execute('UPDATE players SET hand = ? WHERE id = ?', (','.join(map(str, hand)), request.player_id))
    cursor.execute('INSERT INTO played_cards (game_id, player_id, card_value, timestamp) VALUES (?, ?, ?, ?)', 
                   (request.game_id, request.player_id, request.card_value, int(time.time())))
    conn.commit()
    conn.close()

    if all(len(list(map(int, player['hand'].split(',')))) == 0 for player in cursor.execute('SELECT * FROM players WHERE game_id = ?', (request.game_id,)).fetchall()):
        cursor.execute('UPDATE games SET status = ?, last_update = ? WHERE id = ?', ('roundEnd', int(time.time()), request.game_id))
        conn.commit()
        await manager.broadcast_to_game(request.game_id, GameStateUpdate(type="roundEnd", message="Round End").dict())
    else:
        await manager.broadcast_to_game(request.game_id, GameStateUpdate(type="cardPlayed", message="Card Played").dict())

    return get_game_state(request.game_id)

@app.post("/start_game")
async def start_game(game_id: str):
    try:
        logger.info(f"Starting game: {game_id}")
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM games WHERE id = ?', (game_id,))
        game = cursor.fetchone()
        if not game:
            return JSONResponse(
                status_code=404,
                content={"error": "Game not found"}
            )
        
        if game['status'] != "waiting":
            return JSONResponse(
                status_code=400,
                content={"error": "Game already started"}
            )
            
        # Atualiza o status para "playing", bloqueando novas entradas
        cursor.execute("UPDATE games SET status = ?, last_update = ? WHERE id = ?", ("playing", int(time.time()), game_id))
        
        # Distribui as cartas para cada jogador de acordo com o nível atual (rodada)
        round_number = game['round']  # valor atual da rodada
        cursor.execute('SELECT * FROM players WHERE game_id = ?', (game_id,))
        players = cursor.fetchall()
        for player in players:
            hand = generate_hand(round_number)
            cursor.execute("UPDATE players SET hand = ? WHERE id = ?", (','.join(map(str, hand)), player['id']))
        conn.commit()
        conn.close()
        logger.info(f"Game {game_id} started successfully")
        return get_game_state(game_id)
    except Exception as e:
        logger.error(f"Error starting game: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={"error": f"Internal server error: {str(e)}"}
        )

@app.post("/next_round")
async def next_round(game_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM games WHERE id = ?', (game_id,))
    game = cursor.fetchone()
    if not game:
        return {"error": "Game not found"}
    if game['status'] != "roundEnd":
        return {"error": f"Cannot start next round. Status: {game['status']}"}
    new_round = game['round'] + 1
    # Atualiza o valor da rodada e status para playing
    cursor.execute("UPDATE games SET round = ?, status = ?, last_update = ? WHERE id = ?", (new_round, "playing", int(time.time()), game_id))
    # Distribui novas cartas conforme o novo nível (rodada)
    cursor.execute('SELECT * FROM players WHERE game_id = ?', (game_id,))
    players = cursor.fetchall()
    for player in players:
        hand = generate_hand(new_round)
        cursor.execute("UPDATE players SET hand = ? WHERE id = ?", (','.join(map(str, hand)), player['id']))
    # Limpa as cartas jogadas da mesa
    cursor.execute("DELETE FROM played_cards WHERE game_id = ?", (game_id,))
    conn.commit()
    conn.close()
    return get_game_state(game_id)

@app.websocket("/ws/{game_id}/{player_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: str, player_id: str):
    await manager.connect(game_id, player_id, websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast_to_game(game_id, {"type": "message", "message": data})
    except WebSocketDisconnect:
        manager.disconnect(game_id, websocket)
        await manager.broadcast_to_game(game_id, GameStateUpdate(type="playerDisconnected", message=f"Jogador {player_id} desconectou").dict())
