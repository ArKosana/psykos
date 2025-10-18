import { io } from 'socket.io-client';

// Auto-detect environment - localhost for dev, your-backend-url for production
const SOCKET_URL = import.meta.env.PROD 
  ? 'https://psykos-server-production.up.railway.app/' 
  : 'http://localhost:5174';

const socket = io(SOCKET_URL, {
  autoConnect: false
});

export default socket;  // Change this line to default export
