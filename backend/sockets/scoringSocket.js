// Scoring socket rooms on the default namespace.
// Viewers join `scoring:<matchId>`; scoringController emits `scoring:ball`
// and `scoring:undo` to that room after each recorded/undone delivery.
function initScoringSockets(io) {
  io.on("connection", (socket) => {
    socket.on("scoring:join", (matchId) => {
      if (typeof matchId === "string" && matchId.length > 0 && matchId.length < 64) {
        socket.join(`scoring:${matchId}`);
      }
    });
    socket.on("scoring:leave", (matchId) => {
      if (typeof matchId === "string") socket.leave(`scoring:${matchId}`);
    });
  });
}

module.exports = initScoringSockets;
