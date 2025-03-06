document.addEventListener('DOMContentLoaded', () => {
    // Criar estrelas piscando fixas (não se movem)
    createFixedTwinklingStars();
    
    // Adicionar efeito de hover às cartas
    const cards = document.querySelectorAll('.space-card');
    cards.forEach(card => {
        card.addEventListener('mousemove', createCardEffect);
        card.addEventListener('mouseleave', resetCardEffect);
    });
    
    // Adicionar efeito de pulso aos botões
    pulseButtons();
});

// Função para criar estrelas piscando fixas
function createFixedTwinklingStars() {
    const starsContainer = document.querySelector('.stars');
    const twinklingContainer = document.querySelector('.twinkling');
    
    if (!twinklingContainer) return;
    
    // Limpar qualquer conteúdo anterior
    twinklingContainer.innerHTML = '';
    
    // Definir quantidade de estrelas com base no tamanho da tela
    const screenArea = window.innerWidth * window.innerHeight;
    const starDensity = 0.0001; // Ajustar para mais ou menos estrelas
    const starCount = Math.floor(screenArea * starDensity);
    
    console.log(`Criando ${starCount} estrelas fixas`);
    
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        
        // Tamanho aleatório para cada estrela - variação maior
        const size = Math.random() * 3 + 0.5;
        
        // Posição aleatória no espaço
        const posX = Math.random() * 100;
        const posY = Math.random() * 100;
        
        // Tempo e intensidade de animação aleatórios
        const duration = 2 + Math.random() * 4; // 2-6 segundos
        const delay = Math.random() * 4; // 0-4 segundos de delay
        
        // Variações de cores para criar um céu mais natural
        const hueType = Math.random();
        let hue, sat, light;
        
        if (hueType < 0.7) { // 70% de estrelas branco-azuladas
            hue = 210 + Math.random() * 30; // 210-240 (azulado)
            sat = 30 + Math.random() * 40; // 30-70%
            light = 80 + Math.random() * 20; // 80-100%
        } else if (hueType < 0.85) { // 15% de estrelas amareladas
            hue = 40 + Math.random() * 20; // 40-60 (amarelado)
            sat = 50 + Math.random() * 30; // 50-80%
            light = 75 + Math.random() * 20; // 75-95%
        } else { // 15% de estrelas avermelhadas
            hue = 350 + Math.random() * 20; // 350-370 (avermelhado)
            sat = 50 + Math.random() * 30; // 50-80%
            light = 70 + Math.random() * 15; // 70-85%
        }
        
        star.className = 'twinkling-star';
        star.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            border-radius: 50%;
            background-color: hsl(${hue}, ${sat}%, ${light}%);
            left: ${posX}%;
            top: ${posY}%;
            box-shadow: 0 0 ${size + 2}px ${size/2}px hsl(${hue}, ${sat}%, ${light}%);
            opacity: ${0.4 + Math.random() * 0.6}; /* Base opacity */
            animation: twinkle ${duration}s ease-in-out ${delay}s infinite;
        `;
        
        twinklingContainer.appendChild(star);
    }
}

// Efeito 3D nos cards
function createCardEffect(e) {
    const card = this;
    const cardRect = card.getBoundingClientRect();
    const centerX = cardRect.left + cardRect.width / 2;
    const centerY = cardRect.top + cardRect.height / 2;
    const mouseX = e.clientX;
    const mouseY = e.clientY;
    
    const rotateY = ((mouseX - centerX) / (cardRect.width / 2)) * 5;
    const rotateX = ((centerY - mouseY) / (cardRect.height / 2)) * 5;
    
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    card.style.transition = 'transform 0.1s ease';
    
    // Adicionar brilho na direção do mouse
    const glowX = ((mouseX - cardRect.left) / cardRect.width) * 100;
    const glowY = ((mouseY - cardRect.top) / cardRect.height) * 100;
    card.style.background = `radial-gradient(circle at ${glowX}% ${glowY}%, rgba(78, 110, 242, 0.1), var(--card-background) 50%)`;
}

function resetCardEffect() {
    this.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
    this.style.background = 'var(--card-background)';
    this.style.transition = 'transform 0.5s ease, background 0.5s ease';
}

// Efeito de pulso nos botões
function pulseButtons() {
    const buttons = document.querySelectorAll('.btn-primary, .btn-secondary, .btn-submit');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', addPulseEffect);
        button.addEventListener('mouseleave', removePulseEffect);
    });
}

function addPulseEffect() {
    this.style.animation = 'pulse 0.5s ease-in-out';
}

function removePulseEffect() {
    this.style.animation = '';
}

// Adicionar animação CSS para efeito de pulso e estrelas
const style = document.createElement('style');
style.innerHTML = `
@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}

@keyframes twinkle {
    0% { opacity: 0.2; }
    50% { opacity: 1; }
    100% { opacity: 0.2; }
}
`;
document.head.appendChild(style);
