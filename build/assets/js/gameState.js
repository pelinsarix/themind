export class GameState {
    constructor() {
        this.gameState = null;
        this.lastPlayedCards = [];
        this.lastPlayerHand = [];
        this.lastGameState = null;
        this.lastLives = 0;
    }
    
    update(data) {
        // Detectar se houve reinício da rodada (perda de vida)
        const wasRoundRestarted = this.lastGameState && 
            data.status === 'playing' && 
            this.lastGameState.status === 'playing' && 
            data.lives < this.lastGameState.lives && 
            data.current_round === this.lastGameState.current_round;
        
        // Detectar se acabamos de jogar uma carta (para mensagens contextuais)
        const cardsPlayedChanged = JSON.stringify(this.lastPlayedCards) !== JSON.stringify(data.played_cards);
        const handChanged = this.lastPlayerHand && this.lastPlayerHand.length > (data.player_hands[this.playerName] || []).length;
        const justPlayedCard = cardsPlayedChanged && handChanged;
        
        // Salvar estado atual
        this.lastGameState = {...data};
        this.gameState = data;
        
        return {
            wasRoundRestarted,
            cardsPlayedChanged,
            justPlayedCard
        };
    }
    
    setPlayerName(name) {
        this.playerName = name;
    }
    
    updateLastPlayedCards(cards) {
        this.lastPlayedCards = [...cards];
    }
    
    updateLastPlayerHand(hand) {
        this.lastPlayerHand = [...hand];
    }
    
    updateLastLives(lives) {
        this.lastLives = lives;
    }
}
