// Server-side implementation for multiplayer Tic-Tac-Toe
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game rooms and states
const rooms = {};

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // Create a new game room
  socket.on('createRoom', () => {
    const roomId = generateRoomId();
    rooms[roomId] = {
      players: [socket.id],
      board: Array(9).fill(null),
      currentTurn: 0, // Index of the player whose turn it is
      gameOver: false,
      winner: null
    };

    socket.join(roomId);
    socket.emit('roomCreated', { roomId });
    console.log(`Room created: ${roomId}`);
  });

  // Join an existing room
  socket.on('joinRoom', ({ roomId }) => {
    const room = rooms[roomId];

    if (!room) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('error', { message: 'Room is full' });
      return;
    }

    // Add player to the room
    room.players.push(socket.id);
    socket.join(roomId);

    // Notify all players in the room that the game can start
    if (room.players.length === 2) {
      io.to(roomId).emit('gameStart', {
        players: room.players,
        board: room.board,
        currentTurn: room.players[room.currentTurn]
      });
    } else {
      socket.emit('waitingForOpponent');
    }
  });

  // Handle player moves
  socket.on('makeMove', ({ roomId, index }) => {
    const room = rooms[roomId];

    if (!room || room.gameOver) return;

    // Check if it's the player's turn
    const playerIndex = room.players.indexOf(socket.id);
    if (playerIndex === -1 || room.players[room.currentTurn] !== socket.id) {
      socket.emit('error', { message: 'Not your turn' });
      return;
    }

    // Check if the move is valid
    if (room.board[index] !== null) {
      socket.emit('error', { message: 'Invalid move' });
      return;
    }

    // Update the board
    room.board[index] = playerIndex === 0 ? 'X' : 'O';

    // Check for win or draw
    const result = checkGameResult(room.board);
    if (result.gameOver) {
      room.gameOver = true;
      room.winner = result.winner;

      io.to(roomId).emit('gameOver', {
        board: room.board,
        winner: room.winner === 'draw' ? 'draw' : room.players[room.winner === 'X' ? 0 : 1]
      });
    } else {
      // Switch turns
      room.currentTurn = room.currentTurn === 0 ? 1 : 0;

      // Update all clients
      io.to(roomId).emit('gameUpdate', {
        board: room.board,
        currentTurn: room.players[room.currentTurn]
      });
    }
  });

  // Handle rematch requests
  socket.on('requestRematch', ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;

    // Reset the game
    room.board = Array(9).fill(null);
    room.currentTurn = 0;
    room.gameOver = false;
    room.winner = null;

    io.to(roomId).emit('gameStart', {
      players: room.players,
      board: room.board,
      currentTurn: room.players[room.currentTurn]
    });
  });

  // Handle player disconnections
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    // Find and clean up any rooms the player was in
    Object.keys(rooms).forEach(roomId => {
      const room = rooms[roomId];
      const playerIndex = room.players.indexOf(socket.id);

      if (playerIndex !== -1) {
        io.to(roomId).emit('playerDisconnected');
        delete rooms[roomId];
      }
    });
  });
});

// Helper function to generate a random room ID
function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper function to check if the game has a winner or is a draw
function checkGameResult(board) {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6]             // Diagonals
  ];

  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { gameOver: true, winner: board[a] };
    }
  }

  // Check for draw
  if (!board.includes(null)) {
    return { gameOver: true, winner: 'draw' };
  }

  return { gameOver: false, winner: null };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});