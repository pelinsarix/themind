export class UIManager {
    constructor(gameState, notifications) {
        this.gameState = gameState;
        this.notifications = notifications;
        this.elements = {};
        this.messageTimeout = null;
    }
    
    initialize() {
        // Inicializar elementos da UI
        this.elements = {
            lobbyScreen: document.getElementById('lobbyScreen'),
            gameScreen: document.getElementById('gameScreen'),
            gameOverScreen: document.getElementById('gameOverScreen'),
            playersList: document.getElementById('playersList'),
            startGameBtn: document.getElementById('startGameBtn'),
            lobbyGameCode: document.getElementById('lobbyGameCode'),
            copyLobbyCode: document.getElementById('copyLobbyCode'),
            gameCodeDisplay: document.getElementById('gameCodeDisplay'),
            currentRound: document.getElementById('currentRound'),
            livesCount: document.getElementById('livesCount'),
            playedCards: document.getElementById('playedCards'),
            playerHand: document.getElementById('playerHand'),
            gameMessage: document.getElementById('gameMessage'),
            roundEndActions: document.getElementById('roundEndActions'),
            nextRoundBtn: document.getElementById('nextRoundBtn'),
            returnHomeBtn: document.getElementById('returnHomeBtn'),
            gameOverTitle: document.getElementById('gameOverTitle'),
            gameOverMessage: document.getElementById('gameOverMessage')
        };
    }
    
    updateGameDisplay(gameId) {
        const { currentRound, livesCount, lobbyGameCode, gameCodeDisplay } = this.elements;
        const state = this.gameState.gameState;
        
        if (!state) return;
        
        // Atualizar informações básicas
        currentRound.textContent = state.current_round;
        livesCount.textContent = state.lives;
        
        // Configurar código da sala
        if (lobbyGameCode) {
            lobbyGameCode.textContent = gameId;
        }
        if (gameCodeDisplay) {
            gameCodeDisplay.textContent = gameId;
        }
        
        this.updateGameScreen();
    }
    
    updateGameScreen() {
        const { lobbyScreen, gameScreen, gameOverScreen, roundEndActions, gameOverTitle, gameOverMessage } = this.elements;
        const state = this.gameState.gameState;
        
        if (!state) return;
        
        switch (state.status) {
            case 'waiting':
                lobbyScreen.classList.remove('hidden');
                gameScreen.classList.add('hidden');
                gameOverScreen.classList.add('hidden');
                break;
                
            case 'playing':
                lobbyScreen.classList.add('hidden');
                gameScreen.classList.remove('hidden');
                gameOverScreen.classList.add('hidden');
                roundEndActions.classList.add('hidden');
                break;
                
            case 'roundEnd':
                lobbyScreen.classList.add('hidden');
                gameScreen.classList.remove('hidden');
                gameOverScreen.classList.add('hidden');
                roundEndActions.classList.remove('hidden');
                this.notifications.showMessage('Rodada concluída! Prontos para a próxima?', 'success');
                break;
                
            case 'gameOver':
                lobbyScreen.classList.add('hidden');
                gameScreen.classList.add('hidden');
                gameOverScreen.classList.remove('hidden');
                
                if (state.current_round > 10) {
                    gameOverTitle.textContent = 'Vitória!';
                    gameOverMessage.textContent = 'Parabéns! Vocês completaram todas as 10 rodadas e venceram o jogo!';
                } else {
                    gameOverTitle.textContent = 'Fim de Jogo';
                    gameOverMessage.textContent = `Vocês perderam todas as vidas na rodada ${state.current_round}. Tentem novamente!`;
                }
                break;
        }
    }
    
    updatePlayersList(players, playerName) {
        const { playersList } = this.elements;
        
        playersList.innerHTML = '';
        players.forEach(player => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="fas fa-user"></i> ${player}`;
            if (player === playerName) {
                li.innerHTML += ' (Você)';
                li.style.fontWeight = 'bold';
            }
            playersList.appendChild(li);
        });
    }
    
    updatePlayedCards(cards) {
        const { playedCards } = this.elements;
        
        playedCards.innerHTML = '';
        
        if (cards.length === 0) {
            const placeholder = document.createElement('div');
            placeholder.className = 'empty-cards';
            placeholder.textContent = 'Nenhuma carta jogada ainda';
            playedCards.appendChild(placeholder);
            return;
        }
        
        cards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card-item played';
            cardElement.textContent = card.card_value;
            
            playedCards.appendChild(cardElement);
        });
    }
    
    updatePlayerHand(cards, playCardCallback) {
        const { playerHand } = this.elements;
        
        playerHand.innerHTML = '';
        
        if (cards.length === 0) {
            const message = document.createElement('div');
            message.className = 'empty-hand';
            message.textContent = 'Você não tem cartas';
            playerHand.appendChild(message);
            return;
        }
        
        // Ordenar as cartas em ordem crescente
        cards.sort((a, b) => a - b);
        
        cards.forEach(value => {
            const card = document.createElement('div');
            card.className = 'card-item';
            card.textContent = value;
            card.onclick = () => playCardCallback(value);
            playerHand.appendChild(card);
        });
    }
    
    animateCardPlay(cardValue) {
        const cardElements = document.querySelectorAll(`.card-item`);
        cardElements.forEach(card => {
            if (parseInt(card.textContent) === cardValue) {
                card.style.transform = 'translateY(-30px) scale(1.1)';
                card.style.boxShadow = '0 20px 30px rgba(138, 43, 226, 0.8)';
                card.style.opacity = '0.8';
                
                setTimeout(() => {
                    card.style.transform = '';
                    card.style.boxShadow = '';
                }, 300);
            }
        });
    }
    
    animateErrorShake() {
        const allCards = document.querySelectorAll('.card-item');
        allCards.forEach(card => {
            card.classList.add('btn-shake');
            setTimeout(() => card.classList.remove('btn-shake'), 500);
        });
    }
    
    setupClipboardCopy(gameId) {
        const { copyLobbyCode } = this.elements;
        
        copyLobbyCode.addEventListener('click', () => {
            navigator.clipboard.writeText(gameId).then(() => {
                const originalText = copyLobbyCode.innerHTML;
                copyLobbyCode.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    copyLobbyCode.innerHTML = originalText;
                }, 2000);
            });
        });
    }
}
