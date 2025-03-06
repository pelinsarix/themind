export class NotificationsManager {
    constructor() {
        this.messageTimeout = null;
        this.messageElement = document.getElementById('gameMessage');
    }
    
    showMessage(text, type) {
        // Limpa qualquer timeout existente para evitar conflitos
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
        }
        
        // Reset de classes e configuração da nova mensagem
        this.messageElement.className = 'game-message fixed-message';
        void this.messageElement.offsetWidth; // Força reflow para reiniciar animações
        
        // Adiciona o texto e tipo da mensagem
        this.messageElement.textContent = text;
        this.messageElement.classList.add(`message-${type}`);
        this.messageElement.classList.remove('hidden');
        
        // Define novo timeout
        this.messageTimeout = setTimeout(() => {
            // Adiciona classe de fade-out antes de esconder
            this.messageElement.classList.add('fade-out');
            
            // Após a animação completar, esconde o elemento
            setTimeout(() => {
                this.messageElement.classList.add('hidden');
                this.messageElement.classList.remove('fade-out');
            }, 500); // Duração da animação de fade out
            
            this.messageTimeout = null;
        }, 4000);
    }
}
