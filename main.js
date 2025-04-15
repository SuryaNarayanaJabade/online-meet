const socket = io('https://mindful-emotion-production.up.railway.app');
// const socket = io('https://localhost:3000');

let localStream = null;
const peers = {};
let roomId;

function joinRoom() {
  roomId = document.getElementById('roomId').value;
  if (roomId !== '1' && roomId !== '2') {
    alert('Invalid room ID. Use 1 or 2.');
    return;
  }

  socket.emit('join-room', roomId);
}

function startLocalVideo() {
    console.log('Attempting to access webcam and microphone...');
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        console.log('Webcam and microphone access granted.');
        localStream = stream;
        document.getElementById('localVideo').srcObject = stream;
      })
      .catch(err => {
        console.error('Failed to access webcam/mic:', err);
        alert('Error accessing webcam/microphone. Please check your browser permissions.');
      });
  }
  

socket.on('new-peer', (peerId) => {
  console.log(`New peer: ${peerId}`);
  createPeerConnection(peerId, true);
});

socket.on('signal', ({ from, data }) => {
  if (!peers[from]) createPeerConnection(from, false);

  const pc = peers[from];
  if (data.type === 'offer') {
    pc.setRemoteDescription(new RTCSessionDescription(data))
      .then(() => pc.createAnswer())
      .then(answer => {
        pc.setLocalDescription(answer);
        sendSignal(from, answer);
      });
  } else if (data.type === 'answer') {
    pc.setRemoteDescription(new RTCSessionDescription(data));
  } else if (data.candidate) {
    pc.addIceCandidate(new RTCIceCandidate(data));
  }
});

socket.on('peer-disconnected', (peerId) => {
  console.log(`Peer disconnected: ${peerId}`);
  if (peers[peerId]) {
    peers[peerId].close();
    delete peers[peerId];
    document.getElementById(peerId)?.remove();
  }
});

function createPeerConnection(peerId, isInitiator) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });
  
    // Add local tracks to connection
    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }
  
    // Handle new incoming tracks
    pc.ontrack = (event) => {
      console.log('New remote track received');
      addRemoteVideo(peerId, event.streams[0]);
    };
  
    // ICE candidate exchange
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(peerId, event.candidate);
      }
    };
  
    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          sendSignal(peerId, pc.localDescription);
        });
    }
  
    peers[peerId] = pc;
  }
  

function sendSignal(to, data) {
  socket.emit('signal', { roomId, to, from: socket.id, data });
}

function addRemoteVideo(peerId, stream) {
  let video = document.getElementById(peerId);
  if (!video) {
    video = document.createElement('video');
    video.id = peerId;
    video.autoplay = true;
    video.playsInline = true;
    document.getElementById('remoteVideos').appendChild(video);
  }
  video.srcObject = stream;
}

document.addEventListener('DOMContentLoaded', () => {
  const startVideoButton = document.getElementById('startVideoButton');
  if (startVideoButton) {
    startVideoButton.addEventListener('click', startLocalVideo);
  }
});
