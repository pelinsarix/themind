import { BACKEND_URL, GAME_REFRESH_INTERVAL } from './gameConfig.js';
import { GameState } from './gameState.js';
import { UIManager } from './uiManager.js';
import { NotificationsManager } from './notificationsManager.js';
import { ApiClient } from './apiClient.js';
import { WebSocketManager } from './webSocketManager.js';

export class GameController {
    constructor(gameId, playerName) {
        this.gameId = gameId;
        this.playerName = playerName;
        
        // Inicialização dos módulos
        this.gameState = new GameState();
        this.gameState.setPlayerName(playerName);
        
        this.notifications = new NotificationsManager();
        this.ui = new UIManager(this.gameState, this.notifications);
        // Adiciona callback de reinício da partida
        this.ui.onRestartGame = this.startGame.bind(this);
        this.api = new ApiClient(BACKEND_URL);
        this.ws = new WebSocketManager(gameId, this.handleWebSocketMessage.bind(this));
        
        // Flag para controlar o estado do reinício do jogo
        this.pendingNewGameId = null;
        this.isRestartingGame = false;
    }
    
    initialize() {
        // Inicializar UI
        this.ui.initialize();
        this.ui.updateGameDisplay(this.gameId);
        
        // Configurar callback para reiniciar o jogo
        this.ui.onRestartGame = this.restartGameWithSamePlayers.bind(this);
        
        // Configurar eventos
        this.setupEventListeners();
        
        // Conectar ao WebSocket
        this.ws.connect();
        
        // Buscar estado inicial
        this.refreshGameState();
        
        // Iniciar polling como fallback para WebSocket
        this.startPolling();
    }
    
    setupEventListeners() {
        const { startGameBtn, nextRoundBtn, returnHomeBtn } = this.ui.elements;
        
        // Configurar botão de copiar código
        this.ui.setupClipboardCopy(this.gameId);
        
        // Iniciar o jogo
        startGameBtn.addEventListener('click', () => this.startGame());
        
        // Avançar para a próxima rodada
        nextRoundBtn.addEventListener('click', () => this.nextRound());
        
        // Voltar para a página inicial
        returnHomeBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    async refreshGameState() {
        try {
            const data = await this.api.fetchGameState(this.gameId);
            this.updateGameState(data);
        } catch (error) {
            this.notifications.showMessage('Erro ao conectar ao servidor. Tente novamente mais tarde.', 'error');
        }
    }
    
    handleWebSocketMessage(data) {
        // Verificar tipo de mensagem
        if (data.type === "rematch_accept") {
            this.handleRematchAccept(data);
        } else if (data.type === "new_game_invite") {
            this.handleNewGameInvite(data);
        } else if (data.type === "restart_game_available") {
            // Nova mensagem para coordenar reinício com sala existente
            this.handleRestartGameAvailable(data);
        } else {
            this.updateGameState(data);
        }
    }
    
    updateGameState(data) {
        // Atualizar o estado do jogo
        const { wasRoundRestarted, cardsPlayedChanged, justPlayedCard } = this.gameState.update(data);
        
        // Atualizar a interface
        this.ui.updateGameDisplay(this.gameId);
        this.ui.updatePlayersList(data.players, this.playerName);
        
        // Se houve reinício da rodada, mostrar mensagem apropriada
        if (wasRoundRestarted) {
            this.notifications.showMessage('Oops! Alguém tinha uma carta menor. Perderam uma vida! A rodada será reiniciada.', 'warning');
            this.ui.animateErrorShake();
        }

        // Atualiza apenas se houve mudança nas cartas jogadas
        if (cardsPlayedChanged) {
            this.ui.updatePlayedCards(data.played_cards);
            this.gameState.updateLastPlayedCards(data.played_cards);
            
            // Se acabamos de jogar uma carta e não houve reinício, mostrar mensagem de sucesso
            if (justPlayedCard && !wasRoundRestarted && data.status === 'playing') {
                this.notifications.showMessage('Carta jogada com sucesso!', 'success');
            }
        }
        
        // Atualiza as cartas do jogador, se houver mudança
        const newPlayerHand = data.player_hands[this.playerName] || [];
        if (JSON.stringify(this.gameState.lastPlayerHand) !== JSON.stringify(newPlayerHand)) {
            this.ui.updatePlayerHand(newPlayerHand, this.playCard.bind(this));
            this.gameState.updateLastPlayerHand(newPlayerHand);
        }
        
        // Salvar número de vidas para comparação futura
        this.gameState.updateLastLives(data.lives);
    }
    
    async playCard(cardValue) {
        // Verificar se o jogo está em andamento
        if (this.gameState.gameState.status !== 'playing') {
            this.notifications.showMessage('Você só pode jogar cartas quando o jogo estiver em andamento', 'warning');
            return;
        }
        
        try {
            // Animação visual ao jogar a carta
            this.ui.animateCardPlay(cardValue);
            
            const data = await this.api.playCard(this.gameId, this.playerName, cardValue);
            this.updateGameState(data);
        } catch (error) {
            this.notifications.showMessage(error.message || 'Erro ao jogar carta', 'error');
        }
    }
    
    async startGame() {
        try {
            const data = await this.api.startGame(this.gameId);
            this.updateGameState(data);
        } catch (error) {
            // Novo tratamento para erro de partida com poucos jogadores ou já iniciada
            if (error.message && error.message.toLowerCase().includes('not enough players')) {
                this.notifications.showMessage('Enviando convites para reiniciar a partida...', 'info');
                
                // Obter lista de jogadores da última atualização do estado
                const players = this.gameState.gameState?.players || [];
                
                if (players.length > 0) {
                    this.sendRematchInvite(players);
                } else {
                    this.notifications.showMessage('Não foi possível identificar outros jogadores para convidar.', 'error');
                }
            } else {
                this.notifications.showMessage(error.message || 'Erro ao iniciar o jogo', 'error');
            }
        }
    }
    
    sendRematchInvite(players) {
        // Filtrar para ter apenas jogadores diferentes do atual
        const otherPlayers = players.filter(player => player !== this.playerName);
        
        if (otherPlayers.length === 0) {
            this.notifications.showMessage('Não há outros jogadores para convidar.', 'warning');
            return;
        }
        
        console.log("Enviando convites para:", otherPlayers);
        
        // Envia convite via WebSocket para os outros jogadores
        const message = {
            type: "rematch_invite",
            from: this.playerName,
            gameId: this.gameId,
            to: otherPlayers // Lista de destinatários
        };
        
        // Verificar estado da conexão WebSocket
        if (this.ws.isConnected()) {
            this.ws.sendMessage(message);
            console.log("Convite enviado:", message);
            this.notifications.showMessage(`Convite enviado para ${otherPlayers.join(', ')}`, 'info');
        } else {
            console.error("WebSocket não conectado. Tentando reconectar...");
            this.notifications.showMessage("Problema na conexão. Tentando reconectar...", "warning");
            
            // Tentar reconectar e enviar após conexão
            this.ws.connect();
            setTimeout(() => {
                if (this.ws.isConnected()) {
                    this.ws.sendMessage(message);
                    this.notifications.showMessage(`Convite enviado para ${otherPlayers.join(', ')}`, 'info');
                } else {
                    this.notifications.showMessage("Não foi possível enviar o convite. Tente novamente.", "error");
                }
            }, 1000);
        }
    }
    
    handleRematchInvite(data) {
        console.log("Recebido convite de:", data.from);
        // Quando receber convite, mostra um modal mais descritivo
        const accept = confirm(`${data.from} convidou você para uma nova partida. Aceita reiniciar o jogo com os mesmos jogadores?`);
        
        if (accept) {
            // Envia resposta de aceite
            this.ws.sendMessage({
                type: "rematch_accept",
                from: this.playerName,
                to: [data.from],
                gameId: this.gameId
            });
            
            this.notifications.showMessage('Aceitando convite...', 'info');
            
            // Redireciona para novo jogo após um breve delay
            setTimeout(() => {
                window.location.href = 'game.html';
            }, 1500);
        } else {
            // Notificar o outro jogador que o convite foi recusado (opcional)
            this.ws.sendMessage({
                type: "rematch_decline",
                from: this.playerName,
                to: [data.from],
                gameId: this.gameId
            });
        }
    }
    
    handleRematchAccept(data) {
        // Quando o outro jogador aceitar o convite
        this.notifications.showMessage('Convite aceito! Iniciando nova partida...', 'success');
        window.location.href = 'game.html';
    }
    
    async nextRound() {
        try {
            const data = await this.api.nextRound(this.gameId);
            this.updateGameState(data);
            this.notifications.showMessage(`Rodada ${data.current_round} iniciada!`, 'info');
        } catch (error) {
            this.notifications.showMessage(error.message || 'Erro ao avançar para a próxima rodada', 'error');
        }
    }
    
    startPolling() {
        // Atualizar o estado do jogo a cada X ms (fallback caso o WebSocket falhe)
        setInterval(() => this.refreshGameState(), GAME_REFRESH_INTERVAL);
    }

    async restartGameWithSamePlayers() {
        try {
            // 1. Salvar lista dos jogadores atuais
            const currentPlayers = [...this.gameState.gameState.players];
            this.notifications.showMessage('Criando nova sala...', 'info');

            // 2. Criar novo jogo
            const newGameData = await this.api.createGame(this.playerName);
            const newGameId = newGameData.game_id;
            console.log('Nova sala criada:', newGameId);

            // 3. Enviar convites para os outros jogadores
            const otherPlayers = currentPlayers.filter(p => p !== this.playerName);
            if (otherPlayers.length > 0) {
                this.sendNewGameInvite(otherPlayers, newGameId);
            }

            // 4. Redirecionar o criador para a nova sala
            sessionStorage.setItem('gameId', newGameId);
            setTimeout(() => {
                window.location.href = 'game.html';
            }, 1000);
        } catch (error) {
            this.notifications.showMessage('Erro ao reiniciar jogo: ' + error.message, 'error');
            console.error('Erro ao reiniciar jogo:', error);
        }
    }

    sendNewGameInvite(players, newGameId) {
        // Enviar convite para entrar no novo jogo
        console.log("Enviando convites de novo jogo para:", players);
        
        this.ws.sendMessage({
            type: "new_game_invite",
            from: this.playerName,
            to: players,
            newGameId: newGameId
        });
    }

    handleNewGameInvite(data) {
        console.log("Recebido convite para novo jogo:", data);
        
        // Salvar o novo ID do jogo na sessão
        sessionStorage.setItem('gameId', data.newGameId);
        
        // Notificar o jogador sobre o redirecionamento
        this.notifications.showMessage(`${data.from} iniciou um novo jogo. Redirecionando...`, 'info');
        
        // Redirecionar para o novo jogo após um breve delay
        setTimeout(() => {
            window.location.href = 'game.html';
        }, 1500);
    }
    
    broadcastNewGameAvailable(players, newGameId) {
        // Enviar aviso para todos os jogadores que uma nova sala foi criada
        console.log("Enviando aviso de nova sala disponível para:", players);
        
        this.ws.sendMessage({
            type: "restart_game_available",
            from: this.playerName,
            originalGameId: this.gameId,
            newGameId: newGameId,
            to: players.filter(p => p !== this.playerName)
        });
    }
    
    handleRestartGameAvailable(data) {
        console.log("Nova sala disponível para reinício:", data);
        
        // Salva o ID da nova sala
        this.pendingNewGameId = data.newGameId;
        
        // Exibe mensagem sobre a disponibilidade de reinício
        this.notifications.showMessage(`${data.from} criou uma nova sala.`, 'info');
        
        // Exibir o botão de reinício
        this.ui.showRestartButton(data.newGameId);
    }
}