import { create } from 'zustand'

/**
 * 发送端：PeerStore 概念
 * - peerId -> { id, requestedFiles, progress: { filename -> percent } }
 * 接收端：待下载文件列表 + 当前下载进度
 */
const CHUNK_SIZE = 64 * 1024 // 64KB 分片
const BACKPRESSURE_LIMIT = 1024 * 1024 // 1MB 缓冲区则等待（背压水位）

export const useTransferStore = create((set, get) => ({
  // --- 角色与连接 ---
  role: null, // 'sender' | 'receiver'
  roomId: '',
  myPeerId: null,
  peer: null,
  senderConnection: null, // 接收端：与发送端的 DataConnection
  isConnected: false,

  // --- 发送端：已选文件 + 接收者簇 ---
  files: [], // { file, name, size }
  peers: {}, // peerId -> { id, progress: { filename -> percent } }

  // --- 接收端：发送者发来的文件列表 + 勾选 + 下载进度 ---
  remoteFileList: [], // { name, size, mime }
  selectedFiles: [], // name[]
  downloadProgress: {}, // filename -> percent

  setRole: (role) => set({ role }),
  setRoomId: (id) => set({ roomId: id }),
  setMyPeerId: (id) => set({ myPeerId: id }),
  setPeer: (peer) => set({ peer }),
  setSenderConnection: (conn) => set({ senderConnection: conn }),
  setConnected: (v) => set({ isConnected: v }),

  addFile: (file) =>
    set((s) => ({
      files: [...s.files, { file, name: file.name, size: file.size }],
    })),
  removeFile: (index) =>
    set((s) => ({
      files: s.files.filter((_, i) => i !== index),
    })),
  clearFiles: () => set({ files: [] }),

  addOrUpdatePeer: (peerId, data = {}) =>
    set((s) => ({
      peers: {
        ...s.peers,
        [peerId]: {
          id: peerId,
          progress: {},
          ...s.peers[peerId],
          ...data,
        },
      },
    })),
  removePeer: (peerId) =>
    set((s) => {
      const next = { ...s.peers }
      delete next[peerId]
      return { peers: next }
    }),
  updatePeerProgress: (peerId, filename, percent) =>
    set((s) => ({
      peers: {
        ...s.peers,
        [peerId]: {
          ...s.peers[peerId],
          id: peerId,
          progress: {
            ...(s.peers[peerId]?.progress ?? {}),
            [filename]: percent,
          },
        },
      },
    })),

  setRemoteFileList: (list) => set({ remoteFileList: list }),
  setSelectedFiles: (names) => set({ selectedFiles: names }),
  toggleFileSelection: (name) =>
    set((s) => ({
      selectedFiles: s.selectedFiles.includes(name)
        ? s.selectedFiles.filter((n) => n !== name)
        : [...s.selectedFiles, name],
    })),
  setDownloadProgress: (filename, percent) =>
    set((s) => ({
      downloadProgress: { ...s.downloadProgress, [filename]: percent },
    })),

  getChunkSize: () => CHUNK_SIZE,
  getBackpressureLimit: () => BACKPRESSURE_LIMIT,
}))
