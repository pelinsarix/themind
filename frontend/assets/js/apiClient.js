export class ApiClient {
    constructor(backendUrl) {
        this.backendUrl = backendUrl;
    }    
    
    async fetchGameState(gameId) {
        try {
            const response = await fetch(`${this.backendUrl}/game_status/${gameId}`);
            
            if (!response.ok) {
                throw new Error('Erro ao buscar o estado do jogo');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Erro ao buscar estado do jogo:', error);
            throw error;
        }
    }
    
    async playCard(gameId, playerName, cardValue) {
        try {
            const response = await fetch(`${this.backendUrl}/play_card`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    game_id: gameId,
                    player_id: playerName,
                    card_value: cardValue
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.detail || 'Erro ao jogar carta');
            }
            
            return data;
        } catch (error) {
            console.error('Erro ao jogar carta:', error);
            throw error;
        }
    }
    
    async startGame(gameId) {
        try {
            const response = await fetch(`${this.backendUrl}/start_game`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    game_id: gameId
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erro ao iniciar o jogo');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Erro ao iniciar jogo:', error);
            throw error;
        }
    }
    
    async nextRound(gameId) {
        try {
            const response = await fetch(`${this.backendUrl}/next_round`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    game_id: gameId
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erro ao avançar para a próxima rodada');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Erro ao avançar rodada:', error);
            throw error;
        }
    }
    
    async createGame(playerName) {
        try {
            const response = await fetch(`${this.backendUrl}/create_game`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    player_name: playerName
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erro ao criar um novo jogo');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Erro ao criar jogo:', error);
            throw error;
        }
    }
    
    async joinGame(gameId, playerName) {
        try {
            const response = await fetch(`${this.backendUrl}/join_game`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    game_id: gameId,
                    player_name: playerName
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Erro ao entrar no jogo');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Erro ao entrar no jogo:', error);
            throw error;
        }
    }
}
