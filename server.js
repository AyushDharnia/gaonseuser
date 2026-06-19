import "./utils/env.js";
import { app } from "./app.js";
import { createServer } from "http";
import { Server } from "socket.io";

// 🔥 CREATE SERVER
const server = createServer(app);

// 🔌 SOCKET.IO
export const io = new Server(server, {
  cors: {
    origin: "*", // later restrict to frontend URL
    methods: ["GET", "POST"],
  },
});

// 🌍 GLOBAL ACCESS
global.io = io;

// ⚡ SOCKET CONNECTION
io.on("connection", (socket) => {
  console.log("⚡ Client connected:", socket.id);

  // 🏙 JOIN CITY ROOM
  socket.on("joinCity", (cityId) => {
    socket.join(cityId);
    console.log("📍 Joined city:", cityId);
  });

  // 🔌 DISCONNECT
  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
  });
});

// 🚀 START SERVER
const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});