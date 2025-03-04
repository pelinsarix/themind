from pydantic import BaseModel
from typing import List, Dict, Union

# Requisição para criar um jogo
class CreateGameRequest(BaseModel):
    player_name: str

# Requisição para entrar em um jogo
class JoinGameRequest(BaseModel):
    game_id: str
    player_name: str

# Requisição para iniciar o jogo
class StartGameRequest(BaseModel):
    game_id: str

# Requisição para jogar uma carta
class PlayCardRequest(BaseModel):
    game_id: str
    player_id: str
    card_value: int

# Requisição para avançar para a próxima rodada
class NextRoundRequest(BaseModel):
    game_id: str

# Modelo do estado do jogo retornado aos clientes
class GameState(BaseModel):
    game_id: str
    status: str
    current_round: int
    lives: int
    players: List[str]
    played_cards: List[Dict[str, Union[str, int]]]
    player_hands: Dict[str, List[int]]