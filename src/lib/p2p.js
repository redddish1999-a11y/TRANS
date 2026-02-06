// --- 定义增强版配置 ---
const peerOptions = {
  // 增加 debug 等级到 3，这样你可以在手机浏览器（如果能看控制台）看到具体卡在哪
  debug: 3, 
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    // 强制使用中继模式进行测试（如果这个能通，说明必须用 TURN）
    // iceTransportPolicy: 'relay' 
  }
};

/**
 * 发送端：创建 Peer(roomId)
 */
export function createSenderPeer(roomId, onReady) {
  // 移除 host, secure, path 让其使用 PeerJS 默认的最优路径
  const peer = new Peer(roomId, peerOptions);

  peer.on('open', (id) => {
    useTransferStore.getState().setMyPeerId(id)
    useTransferStore.getState().setConnected(true)
    onReady?.(null)
  })

  peer.on('connection', (conn) => {
    conn.on('open', () => {
      useTransferStore.getState().addOrUpdatePeer(conn.peer, { id: conn.peer })
    })
    conn.on('data', (data) => handleSenderData(conn, data))
    conn.on('close', () => useTransferStore.getState().removePeer(conn.peer))
    conn.on('error', () => useTransferStore.getState().removePeer(conn.peer))
  })

  peer.on('error', (err) => {
    console.error('Peer Sender Error:', err.type);
    onReady?.(err);
  })
  return peer
}

/**
 * 接收端：创建匿名 Peer
 */
export function createReceiverPeer(roomId, onReady) {
  // 同样使用增强配置
  const peer = new Peer(peerOptions);

  peer.on('open', (id) => {
    useTransferStore.getState().setMyPeerId(id)
    // 增加连接参数：开启 reliable 确保文件传输不丢包
    const conn = peer.connect(roomId, { 
      reliable: true,
      connectionPriority: 'high' 
    })
    
    if (!conn) {
      onReady?.(new Error('connect failed'))
      return
    }
    
    conn.on('open', () => {
      useTransferStore.getState().setConnected(true)
      useTransferStore.getState().setSenderConnection(conn)
      onReady?.(null)
      conn.send({ type: 'REQUEST_FILE_LIST' })
    })
    
    conn.on('data', (data) => handleReceiverData(conn, data))
    conn.on('close', () => useTransferStore.getState().setConnected(false))
    conn.on('error', (err) => {
        console.error('Conn Error:', err);
        onReady?.(err);
    })
  })

  peer.on('error', (err) => {
    console.error('Peer Receiver Error:', err.type);
    onReady?.(err);
  })
  return peer
}