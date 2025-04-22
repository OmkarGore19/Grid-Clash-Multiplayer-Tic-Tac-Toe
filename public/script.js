// Connect to the server
const socket = io();

// DOM elements
const menuScreen = document.getElementById('menu');
const waitingScreen = document.getElementById('waiting');
const gameScreen = document.getElementById('game');
const roomCodeDisplay = document.getElementById('roomCode');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const roomIdInput = document.getElementById('roomIdInput');
const statusDisplay = document.getElementById('status');
const rematchBtn = document.getElementById('rematchBtn');
const cells = document.querySelectorAll('.cell');

// Game state
let currentRoom = null;
let playerSymbol = null;
let isMyTurn = false;
let playerId = null;
let opponentId = null;
let gameActive = false;

// Create a new room
createRoomBtn.addEventListener('click', () => {
  addClickEffect(createRoomBtn);
  socket.emit('createRoom');
});

// Join an existing room
joinRoomBtn.addEventListener('click', () => {
  addClickEffect(joinRoomBtn);
  const roomId = roomIdInput.value.trim().toUpperCase();
  if (roomId) {
    socket.emit('joinRoom', { roomId });
    currentRoom = roomId;
  } else {
    shake(roomIdInput);
  }
});

// Allow pressing Enter to join room
roomIdInput.addEventListener('keyup', (event) => {
  if (event.key === 'Enter') {
    joinRoomBtn.click();
  }
});

// Handle rematch button
rematchBtn.addEventListener('click', () => {
  addClickEffect(rematchBtn);
  if (currentRoom) {
    socket.emit('requestRematch', { roomId: currentRoom });
    rematchBtn.classList.add('hidden');
  }
});

// Handle cell clicks
cells.forEach(cell => {
  cell.addEventListener('click', () => {
    if (isMyTurn && gameActive && !cell.textContent) {
      const index = cell.getAttribute('data-index');
      socket.emit('makeMove', { roomId: currentRoom, index: parseInt(index) });
      addClickEffect(cell);
    } else if (!isMyTurn && gameActive) {
      shake(cell);
    }
  });
});

// Socket event handlers
socket.on('connect', () => {
  playerId = socket.id;
  console.log('Connected with ID:', playerId);
});

socket.on('roomCreated', ({ roomId }) => {
  currentRoom = roomId;
  roomCodeDisplay.textContent = roomId;
  fadeOut(menuScreen);
  setTimeout(() => {
    menuScreen.classList.add('hidden');
    waitingScreen.classList.remove('hidden');
    fadeIn(waitingScreen);
  }, 300);
});

socket.on('waitingForOpponent', () => {
  fadeOut(menuScreen);
  setTimeout(() => {
    menuScreen.classList.add('hidden');
    waitingScreen.classList.remove('hidden');
    roomCodeDisplay.textContent = currentRoom;
    fadeIn(waitingScreen);
  }, 300);
});

socket.on('gameStart', ({ players, board, currentTurn }) => {
  gameActive = true;
  fadeOut(waitingScreen);
  setTimeout(() => {
    waitingScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    fadeIn(gameScreen);
  }, 300);

  console.log('Game started. Players:', players, 'My ID:', playerId);

  // Determine player symbol and opponent ID
  playerSymbol = players[0] === playerId ? 'X' : 'O';
  opponentId = players[0] === playerId ? players[1] : players[0];

  // Update turn status
  isMyTurn = currentTurn === playerId;
  updateStatus();

  // Reset board
  updateBoard(board);
});

socket.on('gameUpdate', ({ board, currentTurn }) => {
  console.log('Game update. Current turn:', currentTurn, 'Is my turn:', currentTurn === playerId);

  // Find the new move
  const newMoveIndex = findNewMove(board);

  // Update board state
  updateBoard(board);

  // Highlight the new move if found
  if (newMoveIndex !== -1) {
    highlightCell(newMoveIndex);
  }

  // Update turn status
  isMyTurn = currentTurn === playerId;
  updateStatus();
});

socket.on('gameOver', ({ board, winner }) => {
  gameActive = false;

  // Update board one last time
  updateBoard(board);

  // Show game result with animation
  fadeOut(statusDisplay);
  setTimeout(() => {
    if (winner === 'draw') {
      statusDisplay.textContent = "Game ended in a draw!";
      statusDisplay.style.borderLeft = '4px solid #64748b'; // Neutral color for draw
    } else if (winner === playerId) {
      statusDisplay.textContent = "You won! 🎉";
      statusDisplay.style.borderLeft = '4px solid #10b981'; // Green for win
      confetti();
    } else {
      statusDisplay.textContent = "You lost. Better luck next time!";
      statusDisplay.style.borderLeft = '4px solid #f43f5e'; // Red for loss
    }
    fadeIn(statusDisplay);
  }, 300);

  // Show rematch button with animation
  setTimeout(() => {
    rematchBtn.classList.remove('hidden');
    fadeIn(rematchBtn);
  }, 1000);

  isMyTurn = false;
});

socket.on('playerDisconnected', () => {
  gameActive = false;

  fadeOut(statusDisplay);
  setTimeout(() => {
    statusDisplay.textContent = "Opponent disconnected";
    statusDisplay.style.borderLeft = '4px solid #f43f5e'; // Red for disconnect
    fadeIn(statusDisplay);
  }, 300);

  isMyTurn = false;

  // Return to menu after a short delay
  setTimeout(() => {
    fadeOut(gameScreen);
    setTimeout(() => {
      gameScreen.classList.add('hidden');
      menuScreen.classList.remove('hidden');
      fadeIn(menuScreen);
      currentRoom = null;
    }, 300);
  }, 3000);
});

socket.on('error', ({ message }) => {
  alert(message);
  shake(roomIdInput);
});

// Helper functions
function updateStatus() {
  fadeOut(statusDisplay);
  setTimeout(() => {
    if (isMyTurn) {
      statusDisplay.textContent = `Your turn (${playerSymbol})`;
      statusDisplay.style.borderLeft = '4px solid #6366f1'; // Purple for your turn
    } else {
      statusDisplay.textContent = `Opponent's turn`;
      statusDisplay.style.borderLeft = '4px solid #64748b'; // Gray for waiting
    }
    fadeIn(statusDisplay);
  }, 300);
}

function updateBoard(board) {
  cells.forEach((cell, index) => {
    if (board[index] !== null && cell.textContent !== board[index]) {
      cell.textContent = board[index];
      cell.className = 'cell';
      cell.classList.add(board[index] === 'X' ? 'player-x' : 'player-o');
    } else if (board[index] === null) {
      cell.textContent = '';
      cell.className = 'cell';
    }
  });
}

function findNewMove(board) {
  for (let i = 0; i < board.length; i++) {
    const cell = cells[i];
    if (board[i] !== null && cell.textContent !== board[i]) {
      return i;
    }
  }
  return -1;
}

function highlightCell(index) {
  const cell = cells[index];
  cell.classList.add('highlight');
  setTimeout(() => {
    cell.classList.remove('highlight');
  }, 1000);
}

function addClickEffect(element) {
  element.style.transform = 'scale(0.95)';
  setTimeout(() => {
    element.style.transform = '';
  }, 100);
}

function shake(element) {
  element.style.animation = 'none';
  void element.offsetWidth; // Trigger reflow
  element.style.animation = 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both';
  setTimeout(() => {
    element.style.animation = '';
  }, 500);
}

function fadeOut(element) {
  element.style.opacity = '0';
  element.style.transition = 'opacity 0.3s ease';
}

function fadeIn(element) {
  setTimeout(() => {
    element.style.opacity = '1';
  }, 50);
}

// Simple confetti effect for winning
function confetti() {
  const colors = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#3b82f6'];

  for (let i = 0; i < 100; i++) {
    const confetti = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];

    confetti.style.position = 'fixed';
    confetti.style.width = Math.random() * 10 + 5 + 'px';
    confetti.style.height = Math.random() * 5 + 10 + 'px';
    confetti.style.backgroundColor = color;
    confetti.style.borderRadius = '2px';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.top = '-20px';
    confetti.style.zIndex = '1000';
    confetti.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';

    document.body.appendChild(confetti);

    const animationDuration = Math.random() * 2 + 1;
    const animationDelay = Math.random() * 3;

    confetti.animate(
      [
        { transform: 'translateY(0) rotate(0)', opacity: 1 },
        { transform: `translateY(${window.innerHeight}px) rotate(${Math.random() * 360}deg)`, opacity: 0 }
      ],
      {
        duration: animationDuration * 1000,
        delay: animationDelay * 1000,
        easing: 'ease-in-out',
        fill: 'forwards'
      }
    );

    setTimeout(() => {
      document.body.removeChild(confetti);
    }, (animationDuration + animationDelay) * 1000);
  }
}

// Add shake animation keyframes
const style = document.createElement('style');
style.innerHTML = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
`;
document.head.appendChild(style);