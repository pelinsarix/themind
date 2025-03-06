import { GameController } from './gameController.js';

document.addEventListener('DOMContentLoaded', () => {
    // Obter dados da sessão
    const gameId = sessionStorage.getItem('gameId');
    const playerName = sessionStorage.getItem('playerName');

    if (!gameId || !playerName) {
        window.location.href = 'index.html';
        return;
    }

    // Inicializar o controlador do jogo
    const gameController = new GameController(gameId, playerName);
    gameController.initialize();
});