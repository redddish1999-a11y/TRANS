import { Peer } from 'peerjs';

const peerOptions = {
  config: {
    iceServers: [
      { urls: 'stun:stun.qq.com:18124' },      // 腾讯
      { urls: 'stun:stun.miwifi.com:3478' },   // 小米
      { urls: 'stun:stun.l.google.com:19302' } // 谷歌
    ],
    sdpSemantics: 'unified-plan'
  },
  debug: 3 
};

export function createSenderPeer(id, onError) {
  const peer = new Peer(id, peerOptions); 
  peer.on('error', (err) => {
    console.error('Sender Peer Error:', err.type, err);
    if (onError) onError(err);
  });
  return peer;
}

export function createReceiverPeer(onError) {
  const peer = new Peer(peerOptions); 
  peer.on('error', (err) => {
    console.error('Receiver Peer Error:', err.type, err);
    if (onError) onError(err);
  });
  return peer;
}