/**
 * PeerJS 信令 + DataConnection 消息协议
 * 发送端：peerId = roomId，等待接收端 connect
 * 接收端：peer.connect(roomId) 连接发送端
 */

import Peer from 'peerjs'
import { useTransferStore } from '../stores/transferStore'

const CHUNK_SIZE = 64 * 1024 // 64KB 分片
const BACKPRESSURE_LIMIT = 1024 * 1024 // 1MB，超过则暂停发送（背压安全水位）

/**
 * 使用 FileReader 将 Blob 分片异步读取为 ArrayBuffer
 */
function readSliceAsArrayBuffer(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = () => reject(fr.error)
    fr.readAsArrayBuffer(blob)
  })
}

/**
 * 背压控制：若 conn.bufferedAmount 超过 limit，则暂停发送，
 * 通过 bufferedamountlow 或定时器轮询直到缓冲区降至安全水位后再 resolve。
 */
function waitBackpressure(conn, limit = BACKPRESSURE_LIMIT) {
  return new Promise((resolve) => {
    const dc = conn.dataChannel
    if (!dc || dc.bufferedAmount <= limit) {
      resolve()
      return
    }
    const done = () => {
      dc.removeEventListener('bufferedamountlow', onLow)
      clearInterval(pollId)
      clearTimeout(timeoutId)
      resolve()
    }
    const onLow = () => {
      if (dc.bufferedAmount <= limit) done()
    }
    dc.addEventListener('bufferedamountlow', onLow)
    const pollId = setInterval(() => {
      if (dc.bufferedAmount <= limit) done()
    }, 50)
    const timeoutId = setTimeout(done, 10000)
  })
}

/**
 * 发送端：创建 Peer(roomId)，监听 connection，维护 peers
 */
export function createSenderPeer(roomId, onReady) {
  const peer = new Peer(roomId, {
    host: '0.peerjs.com',
    secure: true,
    path: '/',
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    },
  })

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

  peer.on('error', (err) => onReady?.(err))
  return peer
}

function handleSenderData(conn, data) {
  if (typeof data !== 'object' || !data.type) return
  const store = useTransferStore.getState()
  switch (data.type) {
    case 'REQUEST_FILE_LIST':
      sendFileList(conn)
      break
    case 'REQUEST_FILES':
      // data.names: 接收端勾选的文件名列表
      pushFilesToPeer(conn, data.names || [])
      break
    default:
      break
  }
}

function sendFileList(conn) {
  const { files } = useTransferStore.getState()
  conn.send({
    type: 'FILE_LIST',
    list: files.map((f) => ({ name: f.name, size: f.size, mime: f.file?.type })),
  })
}

/**
 * 向指定 Peer 分片推送文件：
 * - 先发元数据（文件名、大小、总分片数）
 * - 使用 file.slice() 切 64KB 分片，FileReader 读为 ArrayBuffer 后 conn.send()
 * - 发送循环中检查 bufferedAmount，超过 1MB 则等待背压后再发下一块
 */
async function pushFilesToPeer(conn, names) {
  const store = useTransferStore.getState()
  const files = store.files.filter((f) => names.includes(f.name))
  const chunkSize = store.getChunkSize()
  const limit = store.getBackpressureLimit()

  for (const { file, name, size } of files) {
    const totalChunks = Math.ceil(size / chunkSize)

    // 1. 先发送元数据：文件名、文件大小、总分片数（JSON）
    conn.send({
      type: 'FILE_META',
      name,
      size,
      mime: file.type || '',
      totalChunks,
    })

    let offset = 0
    let chunkIndex = 0

    while (offset < size) {
      const dc = conn.dataChannel
      if (dc && dc.bufferedAmount > limit) {
        await waitBackpressure(conn, limit)
      }

      const slice = file.slice(offset, offset + chunkSize)
      const buf = await readSliceAsArrayBuffer(slice)

      conn.send({ type: 'CHUNK', name, offset, chunkIndex, data: buf })
      offset += buf.byteLength
      chunkIndex += 1

      const percent = Math.min(100, (offset / size) * 100)
      store.updatePeerProgress(conn.peer, name, percent)
    }
    store.updatePeerProgress(conn.peer, name, 100)
  }
}

/**
 * 接收端：创建匿名 Peer，connect(roomId)，请求文件列表并接收 CHUNK
 */
export function createReceiverPeer(roomId, onReady) {
  const peer = new Peer({
    host: '0.peerjs.com',
    secure: true,
    path: '/',
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    },
  })

  peer.on('open', (id) => {
    useTransferStore.getState().setMyPeerId(id)
    const conn = peer.connect(roomId, { reliable: true })
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
    conn.on('error', (err) => onReady?.(err))
  })

  peer.on('error', (err) => onReady?.(err))
  return peer
}

const receiverChunks = {} // filename -> { size, mime, chunks: Map<offset, ArrayBuffer> }

function handleReceiverData(conn, data) {
  const store = useTransferStore.getState()
  if (typeof data !== 'object' || !data.type) return

  switch (data.type) {
    case 'FILE_LIST':
      store.setRemoteFileList(data.list || [])
      break
    case 'FILE_META':
      if (!receiverChunks[data.name]) {
        receiverChunks[data.name] = { size: data.size, mime: data.mime || '', chunks: new Map() }
      }
      break
    case 'CHUNK': {
      const { name, offset, data: buf } = data
      if (!receiverChunks[name]) return
      receiverChunks[name].chunks.set(offset, buf)
      const total = receiverChunks[name].size
      const received = [...receiverChunks[name].chunks.values()].reduce((a, b) => a + b.byteLength, 0)
      const percent = Math.min(100, (received / total) * 100)
      store.setDownloadProgress(name, percent)
      if (received >= total) {
        assembleAndDownload(name)
        delete receiverChunks[name]
      }
      break
    }
    default:
      break
  }
}

function assembleAndDownload(name) {
  const rec = receiverChunks[name]
  if (!rec) return
  const offsets = [...rec.chunks.keys()].sort((a, b) => a - b)
  const parts = offsets.map((o) => rec.chunks.get(o))
  const blob = new Blob(parts, { type: rec.mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * 接收端：请求当前文件列表（连接时或点击刷新时）
 */
export function requestFileList() {
  const conn = useTransferStore.getState().senderConnection
  if (conn) conn.send({ type: 'REQUEST_FILE_LIST' })
}

/**
 * 接收端：用户勾选后请求拉取文件
 */
export function requestSelectedFiles() {
  const { selectedFiles, senderConnection } = useTransferStore.getState()
  if (senderConnection) senderConnection.send({ type: 'REQUEST_FILES', names: selectedFiles })
}
