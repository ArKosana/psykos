import { io } from 'socket.io-client';

const socket = io('http://localhost:5174');

export default socket;

