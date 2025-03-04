document.addEventListener('DOMContentLoaded', () => {
    // Obter dados da sessão
    const gameId = sessionStorage.getItem('gameId');
    const playerName = sessionStorage.getItem('playerName');

    if (!gameId || !playerName) {
        window.location.href = 'index.html';
        return;
    }

    // Elementos da página
    const lobbyScreen = document.getElementById('lobbyScreen');
    const gameScreen = document.getElementById('gameScreen');
    const gameOverScreen = document.getElementById('gameOverScreen');
    const playersList = document.getElementById('playersList');
    const startGameBtn = document.getElementById('startGameBtn');
    const lobbyGameCode = document.getElementById('lobbyGameCode');
    const copyLobbyCode = document.getElementById('copyLobbyCode');
    const gameCodeDisplay = document.getElementById('gameCodeDisplay');
    const currentRound = document.getElementById('currentRound');
    const livesCount = document.getElementById('livesCount');
    const playedCards = document.getElementById('playedCards');
    const playerHand = document.getElementById('playerHand');
    const gameMessage = document.getElementById('gameMessage');
    const roundEndActions = document.getElementById('roundEndActions');
    const nextRoundBtn = document.getElementById('nextRoundBtn');
    const returnHomeBtn = document.getElementById('returnHomeBtn');
    const gameOverTitle = document.getElementById('gameOverTitle');
    const gameOverMessage = document.getElementById('gameOverMessage');

    // WebSocket para atualizações em tempo real
    let socket;
    let gameState = null;

    // Variáveis para armazenar estado anterior (cache)
    let lastPlayedCards = [];
    let lastPlayerHand = [];

    // Inicializar
    initGame();

    function initGame() {
        // Configurar código da sala no lobby
        lobbyGameCode.textContent = gameId;
        gameCodeDisplay.textContent = gameId;

        // Conectar WebSocket
        connectWebSocket();

        // Buscar estado inicial do jogo
        fetchGameState();

        // Configurar botões
        setupEventListeners();
    }

    function connectWebSocket() {
        // Criar conexão WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/${gameId}`;
        
        socket = new WebSocket(wsUrl);
        
        socket.onopen = () => {
            console.log('Conexão WebSocket estabelecida');
        };
        
        socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if(message.type === 'ping') {
                    // Responde com pong imediatamente
                    socket.send(JSON.stringify({type: 'pong', timestamp: message.timestamp}));
                } else {
                    console.log('Mensagem recebida:', message);
                    updateGameState(message);
                }
            } catch(e) {
                console.log('Mensagem não-JSON recebida:', event.data);
            }
        };
        
        socket.onclose = () => {
            console.log('Conexão WebSocket fechada');
        };
        
        socket.onerror = (error) => {
            console.error('Erro na conexão WebSocket:', error);
        };
    }

    async function fetchGameState() {
        try {
            const response = await fetch(`https://themind-uji9.onrender.com/game_status/${gameId}`);
            
            if (!response.ok) {
                throw new Error('Erro ao buscar o estado do jogo');
            }
            
            const data = await response.json();
            updateGameState(data);
        } catch (error) {
            console.error('Erro ao buscar estado do jogo:', error);
            showMessage('Erro ao conectar ao servidor. Tente novamente mais tarde.', 'error');
        }
    }
    
    function updateGameState(data) {
        // Salvar estado atual
        gameState = data;
        
        // Atualizar informações simples sem re-renderizar demais
        currentRound.textContent = data.current_round;
        livesCount.textContent = data.lives;
        updatePlayersList(data.players);
        updateGameScreen();

        // Atualiza apenas se houve mudança
        if (JSON.stringify(lastPlayedCards) !== JSON.stringify(data.played_cards)) {
            updatePlayedCards(data.played_cards);
            lastPlayedCards = data.played_cards;
        }
        const newPlayerHand = data.player_hands[playerName] || [];
        if (JSON.stringify(lastPlayerHand) !== JSON.stringify(newPlayerHand)) {
            updatePlayerHand(newPlayerHand);
            lastPlayerHand = newPlayerHand;
        }
    }
    
    function updateGameScreen() {
        if (!gameState) return;
        
        switch (gameState.status) {
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
                showMessage('Rodada concluída! Prontos para a próxima?', 'success');
                break;
                
            case 'gameOver':
                lobbyScreen.classList.add('hidden');
                gameScreen.classList.add('hidden');
                gameOverScreen.classList.remove('hidden');
                
                if (gameState.current_round > 10) {
                    gameOverTitle.textContent = 'Vitória!';
                    gameOverMessage.textContent = 'Parabéns! Vocês completaram todas as 10 rodadas e venceram o jogo!';
                } else {
                    gameOverTitle.textContent = 'Fim de Jogo';
                    gameOverMessage.textContent = `Vocês perderam todas as vidas na rodada ${gameState.current_round}. Tentem novamente!`;
                }
                break;
        }
    }
    
    function updatePlayersList(players) {
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
    
    function updatePlayedCards(cards) {
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
    
    function updatePlayerHand(cards) {
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
            card.onclick = () => playCard(value);
            playerHand.appendChild(card);
        });
    }
    
    async function playCard(cardValue) {
        // Verificar se o jogo está em andamento
        if (gameState.status !== 'playing') {
            showMessage('Você só pode jogar cartas quando o jogo estiver em andamento', 'warning');
            return;
        }
        
        try {
            const response = await fetch('https://themind-uji9.onrender.com/play_card', {
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
            
            if (response.ok) {
                updateGameState(data);
            } else {
                throw new Error(data.detail || 'Erro ao jogar carta');
            }
        } catch (error) {
            console.error('Erro ao jogar carta:', error);
            showMessage(error.message || 'Erro ao jogar carta', 'error');
        }
    }
    
    async function startGame() {
        try {
            const response = await fetch('https://themind-uji9.onrender.com/start_game', {
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
            
            const data = await response.json();
            updateGameState(data);
        } catch (error) {
            console.error('Erro ao iniciar jogo:', error);
            showMessage(error.message || 'Erro ao iniciar o jogo', 'error');
        }
    }
    
    async function nextRound() {
        try {
            const response = await fetch('https://themind-uji9.onrender.com/next_round', {
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
            
            const data = await response.json();
            updateGameState(data);
            showMessage(`Rodada ${data.current_round} iniciada!`, 'info');
        } catch (error) {
            console.error('Erro ao avançar rodada:', error);
            showMessage(error.message || 'Erro ao avançar para a próxima rodada', 'error');
        }
    }
    
    function showMessage(text, type) {
        gameMessage.textContent = text;
        gameMessage.className = `game-message message-${type}`;
        gameMessage.classList.remove('hidden');
        
        setTimeout(() => {
            gameMessage.classList.add('hidden');
        }, 5000);
    }
    
    function setupEventListeners() {
        // Copiar código do jogo para o clipboard
        copyLobbyCode.addEventListener('click', () => {
            navigator.clipboard.writeText(gameId).then(() => {
                const originalText = copyLobbyCode.innerHTML;
                copyLobbyCode.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    copyLobbyCode.innerHTML = originalText;
                }, 2000);
            });
        });
        
        // Iniciar o jogo
        startGameBtn.addEventListener('click', startGame);
        
        // Avançar para a próxima rodada
        nextRoundBtn.addEventListener('click', nextRound);
        
        // Voltar para a página inicial
        returnHomeBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    // Atualizar o estado do jogo a cada 300ms (fallback caso o WebSocket falhe)
    setInterval(fetchGameState, 300);
});