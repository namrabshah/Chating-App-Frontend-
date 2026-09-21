import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL!, {
      autoConnect: false,
      transports: ["websocket"],
    });
  }

  return socket;
};

export const connectSocket = (token: string) => {
  const socketInstance = getSocket();

  socketInstance.auth = {
    token,
  };

  if (!socketInstance.connected) {
    socketInstance.connect();
  }

  return socketInstance;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
  }
};