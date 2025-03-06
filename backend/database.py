import sqlite3
import random
import string

# Conexão com o banco SQLite
def get_db_connection():
    conn = sqlite3.connect('game.db')
    conn.row_factory = sqlite3.Row  # Retorna linhas como dicionários
    return conn

# Criação das tabelas no banco de dados
def create_tables():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS games (
            game_id TEXT PRIMARY KEY,
            status TEXT,
            current_round INTEGER,
            lives INTEGER
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS players (
            game_id TEXT,
            player_id TEXT,
            player_name TEXT,
            PRIMARY KEY (game_id, player_id),
            FOREIGN KEY (game_id) REFERENCES games (game_id)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS player_hands (
            game_id TEXT,
            round_number INTEGER,
            player_id TEXT,
            card_value INTEGER,
            PRIMARY KEY (game_id, round_number, player_id, card_value),
            FOREIGN KEY (game_id, player_id) REFERENCES players (game_id, player_id)
        )
    ''')
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS played_cards (
            game_id TEXT,
            round_number INTEGER,
            player_id TEXT,
            card_value INTEGER,
            play_order INTEGER,
            PRIMARY KEY (game_id, round_number, play_order),
            FOREIGN KEY (game_id, player_id) REFERENCES players (game_id, player_id)
        )
    ''')
    conn.commit()
    conn.close()

# Geração de um game_id único (6 caracteres alfanuméricos)
def generate_game_id():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))

# Distribuição de cartas únicas para os jogadores
def distribute_cards(conn, game_id, round_number, num_players):
    total_cards = num_players * round_number
    all_cards = random.sample(range(1, 101), total_cards)  # Cartas de 1 a 100 sem repetição
    player_ids = [row['player_id'] for row in conn.execute('SELECT player_id FROM players WHERE game_id = ?', (game_id,)).fetchall()]
    for i, player_id in enumerate(player_ids):
        player_cards = all_cards[i * round_number:(i + 1) * round_number]
        for card in player_cards:
            conn.execute('INSERT INTO player_hands (game_id, round_number, player_id, card_value) VALUES (?, ?, ?, ?)',
                         (game_id, round_number, player_id, card))
    conn.commit()

# Obtém o estado atual do jogo
def get_game_state(conn, game_id):
    game = conn.execute('SELECT * FROM games WHERE game_id = ?', (game_id,)).fetchone()
    if not game:
        return None
    players = [row['player_id'] for row in conn.execute('SELECT player_id FROM players WHERE game_id = ?', (game_id,)).fetchall()]
    played_cards = conn.execute('SELECT player_id, card_value FROM played_cards WHERE game_id = ? AND round_number = ? ORDER BY play_order',
                                (game_id, game['current_round'])).fetchall()
    played_cards_list = [{'player_id': row['player_id'], 'card_value': row['card_value']} for row in played_cards]
    player_hands = {}
    for player_id in players:
        hands = conn.execute('SELECT card_value FROM player_hands WHERE game_id = ? AND round_number = ? AND player_id = ?',
                             (game_id, game['current_round'], player_id)).fetchall()
        player_hands[player_id] = [row['card_value'] for row in hands]
    return {
        'game_id': game['game_id'],
        'status': game['status'],
        'current_round': game['current_round'],
        'lives': game['lives'],
        'players': players,
        'played_cards': played_cards_list,
        'player_hands': player_hands
    }

# Cria um novo jogo
def create_game(conn, player_name):
    game_id = generate_game_id()
    conn.execute('INSERT INTO games (game_id, status, current_round, lives) VALUES (?, ?, ?, ?)',
                 (game_id, 'waiting', 1, 3))
    conn.execute('INSERT INTO players (game_id, player_id, player_name) VALUES (?, ?, ?)',
                 (game_id, player_name, player_name))  # player_id = player_name
    conn.commit()
    return game_id

# Adiciona um jogador a um jogo existente
def join_game(conn, game_id, player_name):
    game = conn.execute('SELECT * FROM games WHERE game_id = ?', (game_id,)).fetchone()
    if not game or game['status'] != 'waiting':
        return False
    existing_player = conn.execute('SELECT * FROM players WHERE game_id = ? AND player_id = ?', (game_id, player_name)).fetchone()
    if existing_player:  # Nome duplicado
        return False
    conn.execute('INSERT INTO players (game_id, player_id, player_name) VALUES (?, ?, ?)',
                 (game_id, player_name, player_name))
    conn.commit()
    return True

# Inicia o jogo
def start_game(conn, game_id):
    game = conn.execute('SELECT * FROM games WHERE game_id = ?', (game_id,)).fetchone()
    if not game or game['status'] != 'waiting':
        return False
    players = conn.execute('SELECT player_id FROM players WHERE game_id = ?', (game_id,)).fetchall()
    if len(players) < 2:
        return False
    conn.execute('UPDATE games SET status = ? WHERE game_id = ?', ('playing', game_id))
    distribute_cards(conn, game_id, game['current_round'], len(players))
    return True

# Reinicia a rodada atual
def restart_current_round(conn, game_id):
    game = conn.execute('SELECT * FROM games WHERE game_id = ?', (game_id,)).fetchone()
    if not game:
        return False
    
    current_round = game['current_round']
    
    # Limpar as cartas jogadas da rodada atual
    conn.execute('DELETE FROM played_cards WHERE game_id = ? AND round_number = ?', (game_id, current_round))
    
    # Limpar as mãos dos jogadores da rodada atual
    conn.execute('DELETE FROM player_hands WHERE game_id = ? AND round_number = ?', (game_id, current_round))
    
    # Redistribuir cartas para a rodada atual
    players = conn.execute('SELECT player_id FROM players WHERE game_id = ?', (game_id,)).fetchall()
    num_players = len(players)
    distribute_cards(conn, game_id, current_round, num_players)
    
    # Atualizar o status do jogo para playing
    conn.execute('UPDATE games SET status = ? WHERE game_id = ?', ('playing', game_id))
    conn.commit()
    
    return True

# Registra uma carta jogada
def play_card(conn, game_id, player_id, card_value):
    game = conn.execute('SELECT * FROM games WHERE game_id = ?', (game_id,)).fetchone()
    if not game or game['status'] != 'playing':
        return 'invalid_game'
    
    hand = conn.execute('SELECT card_value FROM player_hands WHERE game_id = ? AND round_number = ? AND player_id = ?',
                        (game_id, game['current_round'], player_id)).fetchall()
    hand_values = [row['card_value'] for row in hand]
    
    if card_value not in hand_values:
        return 'invalid_card'
    
    # Verificar se a carta é maior que a última jogada
    last_played = conn.execute('SELECT MAX(card_value) FROM played_cards WHERE game_id = ? AND round_number = ?',
                               (game_id, game['current_round'])).fetchone()[0]
    if last_played is not None and card_value <= last_played:
        conn.execute('UPDATE games SET lives = lives - 1 WHERE game_id = ?', (game_id,))
        conn.commit()
        game = conn.execute('SELECT * FROM games WHERE game_id = ?', (game_id,)).fetchone()
        if game['lives'] <= 0:
            conn.execute('UPDATE games SET status = ? WHERE game_id = ?', ('gameOver', game_id))
            conn.commit()
            return 'game_over'
        # Reiniciar a rodada após perder uma vida
        restart_current_round(conn, game_id)
        return 'restart_round'
    
    # Verificar se outros jogadores têm cartas menores
    other_players = conn.execute('SELECT DISTINCT player_id FROM players WHERE game_id = ? AND player_id != ?', (game_id, player_id)).fetchall()
    
    has_smaller_card = False
    for other_player in other_players:
        other_player_id = other_player['player_id']
        smaller_cards = conn.execute('SELECT COUNT(*) FROM player_hands WHERE game_id = ? AND round_number = ? AND player_id = ? AND card_value < ?',
                                     (game_id, game['current_round'], other_player_id, card_value)).fetchone()[0]
        
        if smaller_cards > 0:
            has_smaller_card = True
            break
    
    if has_smaller_card:
        conn.execute('UPDATE games SET lives = lives - 1 WHERE game_id = ?', (game_id,))
        conn.commit()
        game = conn.execute('SELECT * FROM games WHERE game_id = ?', (game_id,)).fetchone()
        if game['lives'] <= 0:
            conn.execute('UPDATE games SET status = ? WHERE game_id = ?', ('gameOver', game_id))
            conn.commit()
            return 'game_over'
        # Reiniciar a rodada após perder uma vida
        restart_current_round(conn, game_id)
        return 'restart_round'
    
    # Registra a jogada
    play_order = conn.execute('SELECT COUNT(*) FROM played_cards WHERE game_id = ? AND round_number = ?', (game_id, game['current_round'])).fetchone()[0] + 1
    conn.execute('INSERT INTO played_cards (game_id, round_number, player_id, card_value, play_order) VALUES (?, ?, ?, ?, ?)', (game_id, game['current_round'], player_id, card_value, play_order))
    conn.execute('DELETE FROM player_hands WHERE game_id = ? AND round_number = ? AND player_id = ? AND card_value = ?', (game_id, game['current_round'], player_id, card_value))
    conn.commit()
    
    # Verifica se a rodada terminou
    remaining_hands = conn.execute('SELECT COUNT(*) FROM player_hands WHERE game_id = ? AND round_number = ?', (game_id, game['current_round'])).fetchone()[0]
    if remaining_hands == 0:
        conn.execute('UPDATE games SET status = ? WHERE game_id = ?', ('roundEnd', game_id))
        conn.commit()
        return 'round_end'
    
    return 'success'

# Avança para a próxima rodada
def next_round(conn, game_id):
    game = conn.execute('SELECT * FROM games WHERE game_id = ?', (game_id,)).fetchone()
    if not game or game['status'] != 'roundEnd':
        return False
    new_round = game['current_round'] + 1
    if new_round > 10:  # Vitória após 10 rodadas
        conn.execute('UPDATE games SET status = ? WHERE game_id = ?', ('gameOver', game_id))
        conn.commit()
        return 'game_won'
    conn.execute('UPDATE games SET current_round = ?, status = ? WHERE game_id = ?', (new_round, 'playing', game_id))
    players = conn.execute('SELECT player_id FROM players WHERE game_id = ?', (game_id,)).fetchall()
    num_players = len(players)
    distribute_cards(conn, game_id, new_round, num_players)
    if new_round % 3 == 0:  # Ganha uma vida extra a cada 3 rodadas, até 5
        conn.execute('UPDATE games SET lives = MIN(lives + 1, 5) WHERE game_id = ?', (game_id,))
    conn.commit()
    return True