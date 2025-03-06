export class WebSocketManager {
    constructor(gameId, onMessageCallback) {
        this.gameId = gameId;
        this.onMessageCallback = onMessageCallback;
        this.socket = null;
    }
    
    connect() {
        // Se já existir uma conexão aberta, não faz nada
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            return;
        }
        
        // Criar conexão WebSocket
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/${this.gameId}`;
        
        this.socket = new WebSocket(wsUrl);
        
        this.socket.onopen = () => {
            console.log('Conexão WebSocket estabelecida');
        };
        
        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                if(message.type === 'ping') {
                    // Responde com pong imediatamente
                    this.socket.send(JSON.stringify({type: 'pong', timestamp: message.timestamp}));
                } else {
                    console.log('Mensagem recebida via WebSocket:', message);
                    this.onMessageCallback(message);
                }
            } catch(e) {
                console.log('Mensagem não-JSON recebida:', event.data);
            }
        };
        
        this.socket.onclose = () => {
            console.log('Conexão WebSocket fechada');
        };
        
        this.socket.onerror = (error) => {
            console.error('Erro na conexão WebSocket:', error);
        };
    }
    
    sendMessage(message) {
        if(this.isConnected()) {
            console.log('Enviando mensagem WebSocket:', message);
            this.socket.send(JSON.stringify(message));
            return true;
        } else {
            console.error('Não foi possível enviar mensagem: WebSocket não conectado');
            return false;
        }
    }
    
    isConnected() {
        return this.socket && this.socket.readyState === WebSocket.OPEN;
    }
    
    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}
