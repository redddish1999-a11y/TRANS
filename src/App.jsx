import { Peer } from 'peerjs';

// 提取公共配置
const peerConfig = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
    // 强制使用较新的 WebRTC 计划，提高移动端兼容性
    sdpSemantics: 'unified-plan'
  }
};

export function createSenderPeer(id, onError) {
  // 修改这里：传入配置对象
  const peer = new Peer(id, peerConfig); 
  
  peer.on('error', (err) => {
    console.error('Sender Peer Error:', err);
    if (onError) onError(err);
  });

  // ... 保持你原有的逻辑
  return peer;
}

export function createReceiverPeer(id, onError) {
  // 修改这里：传入配置对象
  const peer = new Peer(peerConfig); 
  
  peer.on('error', (err) => {
    console.error('Receiver Peer Error:', err);
    if (onError) onError(err);
  });

  // ... 保持你原有的逻辑
  return peer;
}