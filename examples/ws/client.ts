/// <reference types='bun-types' />
const socket = new WebSocket('ws://localhost:3000');
socket.onopen = () => socket.send('Hi');
socket.onmessage = e => {
    console.log(e.data);
    socket.close();
}