import { BACKEND_URL } from './gameConfig.js';

document.addEventListener('DOMContentLoaded', () => {
    // Elementos da página
    const createGameBtn = document.getElementById('createGame');
    const joinGameBtn = document.getElementById('joinGameBtn');
    const createGameForm = document.getElementById('createGameForm');
    const joinGameForm = document.getElementById('joinGameForm');
    const createGameSubmit = document.getElementById('createGameSubmit');
    const joinGameSubmit = document.getElementById('joinGameSubmit');
    const gameCreatedInfo = document.getElementById('gameCreatedInfo');
    const generatedGameCode = document.getElementById('generatedGameCode');
    const copyCodeBtn = document.getElementById('copyCode');
    const goToLobbyBtn = document.getElementById('goToLobby');

    // Variáveis de estado
    let currentGameId = '';
    let playerName = '';

    // Mostrar formulário para criar jogo
    createGameBtn.addEventListener('click', () => {
        createGameForm.classList.remove('hidden');
        joinGameForm.classList.add('hidden');
        gameCreatedInfo.classList.add('hidden');
    });

    // Mostrar formulário para entrar em jogo
    joinGameBtn.addEventListener('click', () => {
        joinGameForm.classList.remove('hidden');
        createGameForm.classList.add('hidden');
        gameCreatedInfo.classList.add('hidden');
    });

    // Criar um novo jogo
    createGameSubmit.addEventListener('click', async () => {
        const nameInput = document.getElementById('playerName');
        playerName = nameInput.value.trim();
        
        if (!playerName) {
            alert('Por favor, digite seu nome.');
            return;
        }

        try {
            const response = await fetch(`${BACKEND_URL}/create_game`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ player_name: playerName })
            });

            const data = await response.json();
            currentGameId = data.game_id;
            
            // Salvar informações na sessão para usar na página do jogo
            sessionStorage.setItem('gameId', currentGameId);
            sessionStorage.setItem('playerName', playerName);
            
            // Redirecionar para a página do jogo automaticamente
            window.location.href = 'game.html';
        } catch (error) {
            console.error('Erro ao criar jogo:', error);
            alert('Houve um erro ao criar o jogo. Tente novamente.');
        }
    });

    // Entrar em um jogo existente
    joinGameSubmit.addEventListener('click', async () => {
        const gameCodeInput = document.getElementById('gameCode');
        const nameInput = document.getElementById('joinPlayerName');
        
        const gameId = gameCodeInput.value.trim().toUpperCase();
        playerName = nameInput.value.trim();
        
        if (!gameId || !playerName) {
            alert('Por favor, preencha todos os campos.');
            return;
        }

        try {
            const response = await fetch(`${BACKEND_URL}/join_game`, {
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

            // Salvar informações na sessão para usar na página do jogo
            sessionStorage.setItem('gameId', gameId);
            sessionStorage.setItem('playerName', playerName);
            
            // Redirecionar para a página do jogo
            window.location.href = 'game.html';
        } catch (error) {
            console.error('Erro ao entrar no jogo:', error);
            alert(error.message || 'Houve um erro ao entrar no jogo. Verifique o código e tente novamente.');
        }
    });

    // Copiar código do jogo para a área de transferência
    copyCodeBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(currentGameId).then(() => {
            const originalText = copyCodeBtn.innerHTML;
            copyCodeBtn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
                copyCodeBtn.innerHTML = originalText;
            }, 2000);
        }).catch(err => {
            console.error('Erro ao copiar texto: ', err);
        });
    });

    // Ir para a sala de espera
    goToLobbyBtn.addEventListener('click', () => {
        window.location.href = 'game.html';
    });
});
