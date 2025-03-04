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

    // Verificar se todos os elementos foram encontrados
    console.log('Elementos carregados:', {
        createGameBtn: !!createGameBtn,
        joinGameBtn: !!joinGameBtn,
        createGameForm: !!createGameForm, 
        joinGameForm: !!joinGameForm
    });

    // Mostrar formulário para criar jogo
    createGameBtn.addEventListener('click', () => {
        console.log('Botão criar jogo clicado');
        createGameForm.classList.remove('hidden');
        joinGameForm.classList.add('hidden');
        gameCreatedInfo.classList.add('hidden');
    });

    // Mostrar formulário para entrar em jogo
    joinGameBtn.addEventListener('click', () => {
        console.log('Botão entrar em jogo clicado');
        joinGameForm.classList.remove('hidden');
        createGameForm.classList.add('hidden');
        gameCreatedInfo.classList.add('hidden');
    });

    // Criar um novo jogo - CORREÇÃO: usando preventDefault para forms
    createGameSubmit.addEventListener('click', async (event) => {
        // Prevenir comportamento padrão se for um form
        if (event) {
            event.preventDefault();
        }
        
        console.log('Botão criar jogo submit clicado');
        const nameInput = document.getElementById('playerName');
        playerName = nameInput.value.trim();
        
        if (!playerName) {
            alert('Por favor, digite seu nome.');
            return;
        }

        // Adicionar feedback visual
        createGameSubmit.disabled = true;
        createGameSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...';

        try {
            console.log('Enviando requisição para criar jogo');
            const response = await fetch('https://themind-uji9.onrender.com/create_game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ player_name: playerName })
            });

            console.log('Resposta recebida:', response.status);
            
            if (!response.ok) {
                throw new Error(`Erro ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Jogo criado com sucesso:', data);
            currentGameId = data.game_id;
            
            // Mostrar o código do jogo criado antes de redirecionar
            generatedGameCode.textContent = currentGameId;
            createGameForm.classList.add('hidden');
            gameCreatedInfo.classList.remove('hidden');
            
            // Salvar informações na sessão para usar na página do jogo
            sessionStorage.setItem('gameId', currentGameId);
            sessionStorage.setItem('playerName', playerName);
            
            // Não redirecionamos automaticamente, deixamos o usuário ver o código do jogo
            // O redirecionamento será feito ao clicar no botão "Ir para a Base Espacial"
        } catch (error) {
            console.error('Erro ao criar jogo:', error);
            alert(`Erro ao criar o jogo: ${error.message || 'Tente novamente mais tarde.'}`);
        } finally {
            // Restaurar o botão
            createGameSubmit.disabled = false;
            createGameSubmit.innerHTML = 'Lançar Missão';
        }
    });

    // Entrar em um jogo existente
    joinGameSubmit.addEventListener('click', async (event) => {
        // Prevenir comportamento padrão se for um form
        if (event) {
            event.preventDefault();
        }
        
        console.log('Botão entrar jogo submit clicado');
        const gameCodeInput = document.getElementById('gameCode');
        const nameInput = document.getElementById('joinPlayerName');
        
        const gameId = gameCodeInput.value.trim().toUpperCase();
        playerName = nameInput.value.trim();
        
        if (!gameId || !playerName) {
            alert('Por favor, preencha todos os campos.');
            return;
        }

        // Adicionar feedback visual
        joinGameSubmit.disabled = true;
        joinGameSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';

        try {
            console.log('Enviando requisição para entrar no jogo');
            const response = await fetch('https://themind-uji9.onrender.com/join_game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    game_id: gameId,
                    player_name: playerName
                })
            });

            console.log('Resposta recebida:', response.status);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `Erro ${response.status}: ${response.statusText}`);
            }

            // Salvar informações na sessão para usar na página do jogo
            sessionStorage.setItem('gameId', gameId);
            sessionStorage.setItem('playerName', playerName);
            
            // Redirecionar para a página do jogo
            console.log('Redirecionando para game.html');
            window.location.href = 'game.html';
        } catch (error) {
            console.error('Erro ao entrar no jogo:', error);
            alert(`Erro ao entrar no jogo: ${error.message || 'Verifique o código e tente novamente.'}`);
        } finally {
            // Restaurar o botão
            joinGameSubmit.disabled = false;
            joinGameSubmit.innerHTML = 'Embarcar na Missão';
        }
    });

    // Copiar código do jogo para a área de transferência
    copyCodeBtn.addEventListener('click', () => {
        console.log('Botão copiar código clicado');
        navigator.clipboard.writeText(currentGameId)
            .then(() => {
                const originalText = copyCodeBtn.innerHTML;
                copyCodeBtn.innerHTML = '<i class="fas fa-check"></i>';
                setTimeout(() => {
                    copyCodeBtn.innerHTML = originalText;
                }, 2000);
            })
            .catch(err => {
                console.error('Erro ao copiar texto: ', err);
                alert('Não foi possível copiar o código. Por favor, copie manualmente.');
            });
    });

    // Ir para a sala de espera
    goToLobbyBtn.addEventListener('click', () => {
        console.log('Redirecionando para game.html');
        window.location.href = 'game.html';
    });
    
    // Verificar possíveis erros no console
    window.addEventListener('error', (event) => {
        console.error('Erro capturado:', event.error);
    });
});
