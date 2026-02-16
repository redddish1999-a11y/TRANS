import { useState, useCallback } from 'react'
import { Copy, Upload, Users, FileText, Download, Loader2 } from 'lucide-react'
import { useTransferStore } from './stores/transferStore'
import { generateRoomId, normalizeRoomId } from './lib/roomId'
import { createSenderPeer, createReceiverPeer, requestSelectedFiles, requestFileList } from './lib/p2p'

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// ---------- 入口：选择角色 ----------
function RoleChoice({ onSender, onReceiver }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
        P2P Trans Hub
      </h1>
      <p className="text-zinc-400 text-sm max-w-sm text-center">
        零服务器、点对点、实时进度。选一个角色开始。
      </p>
      <div className="flex gap-4">
        <button
          onClick={onSender}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition"
        >
          <Upload className="w-5 h-5" />
          创建房间（发送端）
        </button>
        <button
          onClick={onReceiver}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-zinc-100 font-medium transition"
        >
          <Download className="w-5 h-5" />
          加入房间（接收端）
        </button>
      </div>
    </div>
  )
}

// ---------- 发送端：双栏（左侧发送池 + 右侧接收簇） ----------
function SenderView() {
  const {
    roomId,
    isConnected,
    files,
    peers,
    addFile,
    removeFile,
    setPeer,
    setRoomId,
    setRole,
  } = useTransferStore()
  const [copied, setCopied] = useState(false)
  const [drag, setDrag] = useState(false)

  const handleCreateRoom = useCallback(() => {
    const id = generateRoomId()
    setRoomId(id)
    setRole('sender')
    const peer = createSenderPeer(id, (err) => {
      if (err) console.error('Sender peer error:', err)
    })
    setPeer(peer)
  }, [setRoomId, setRole, setPeer])

  const copyCode = () => {
    navigator.clipboard.writeText(roomId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDrag(false)
    const list = [...(e.dataTransfer?.files || [])]
    list.forEach((f) => addFile(f))
  }
  const onDragOver = (e) => {
    e.preventDefault()
    setDrag(true)
  }
  const onDragLeave = () => setDrag(false)

  const totalSize = files.reduce((a, f) => a + f.size, 0)
  const peerList = Object.values(peers)

  if (!roomId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6">
        <button
          onClick={handleCreateRoom}
          className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
        >
          生成配对码并创建房间
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur flex items-center justify-between px-6 py-3">
        <span className="text-zinc-400 text-sm">配对码</span>
        <div className="flex items-center gap-3">
          <code className="text-lg font-mono text-emerald-400 tracking-wide">
            {roomId}
          </code>
          <button
            onClick={copyCode}
            className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition"
            title="复制"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <Users className="w-4 h-4" />
          <span>{peerList.length} 人已连接</span>
        </div>
      </header>

      <main className="flex-1 flex min-h-0">
        <section className="w-1/2 border-r border-zinc-800 flex flex-col p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">发送池</h2>
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`flex-1 min-h-[200px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition ${
              drag ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-600 bg-zinc-800/30'
            }`}
          >
            <Upload className="w-10 h-10 text-zinc-500" />
            <p className="text-zinc-400 text-sm">拖拽文件到此处，或点击选择</p>
            <input
              type="file"
              multiple
              className="hidden"
              id="sender-files"
              onChange={(e) => {
                ;[...(e.target.files || [])].forEach((f) => addFile(f))
                e.target.value = ''
              }}
            />
            <label
              htmlFor="sender-files"
              className="text-emerald-400 text-sm cursor-pointer hover:underline"
            >
              选择文件
            </label>
          </div>
          <div className="mt-4 space-y-2">
            {files.map((f, i) => (
              <div
                key={`${f.name}-${i}`}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-zinc-800/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-zinc-500 shrink-0" />
                  <span className="text-sm truncate">{f.name}</span>
                  <span className="text-zinc-500 text-xs shrink-0">{formatSize(f.size)}</span>
                </div>
                <button
                  onClick={() => removeFile(i)}
                  className="text-zinc-500 hover:text-red-400 text-sm"
                >
                  移除
                </button>
              </div>
            ))}
          </div>
          {files.length > 0 && (
            <p className="text-zinc-500 text-xs mt-2">发送总量：{formatSize(totalSize)}</p>
          )}
        </section>

        <section className="w-1/2 flex flex-col p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">接收簇</h2>
          <div className="flex-1 overflow-auto space-y-4">
            {peerList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-500 text-sm">
                <Users className="w-12 h-12 mb-2 opacity-50" />
                等待接收者输入配对码连接…
              </div>
            ) : (
              peerList.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <code className="text-xs text-zinc-400 font-mono truncate">{p.id}</code>
                  </div>
                  <div className="space-y-2">
                    {files.length === 0 ? (
                      <p className="text-zinc-500 text-xs">暂无文件</p>
                    ) : (
                      files.map((f) => (
                        <div key={f.name} className="flex items-center gap-2">
                          <span className="text-xs text-zinc-400 w-24 truncate">{f.name}</span>
                          <div className="flex-1 h-2 rounded-full bg-zinc-700 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 transition-all duration-300"
                              style={{
                                width: `${p.progress?.[f.name] ?? 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500 w-8">
                            {Math.round(p.progress?.[f.name] ?? 0)}%
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  )
}

// ---------- 接收端：输入配对码 → 文件列表勾选 → 下载进度 ----------
function ReceiverView() {
  const {
    roomId,
    setRoomId,
    setRole,
    setPeer,
    isConnected,
    remoteFileList,
    selectedFiles,
    toggleFileSelection,
    downloadProgress,
    senderConnection,
  } = useTransferStore()
  const [inputCode, setInputCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  const handleJoin = useCallback(() => {
    const code = normalizeRoomId(inputCode)
    if (!code) {
      setError('请输入配对码')
      return
    }
    setError('')
    setJoining(true)
    setRoomId(code)
    setRole('receiver')
    const peer = createReceiverPeer(code, (err) => {
      setJoining(false)
      if (err) setError(err.message || '连接失败，请检查配对码')
    })
    setPeer(peer)
  }, [inputCode, setRoomId, setRole, setPeer])

  const handleRequestDownload = () => {
    requestSelectedFiles()
  }

  if (!isConnected && !joining) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
        <h1 className="text-2xl font-semibold text-zinc-100">加入房间</h1>
        <p className="text-zinc-400 text-sm">输入发送端提供的配对码（如 tiger-blue-sky）</p>
        <input
          type="text"
          value={inputCode}
          onChange={(e) => setInputCode(e.target.value)}
          placeholder="tiger-blue-sky"
          className="w-72 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-600 text-zinc-100 placeholder-zinc-500 font-mono text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          onClick={handleJoin}
          disabled={joining}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium"
        >
          {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          连接
        </button>
      </div>
    )
  }

  if (joining) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
        <p className="text-zinc-400">正在连接…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-3 flex items-center justify-between">
        <span className="text-zinc-400 text-sm">已连接</span>
        <code className="text-emerald-400 font-mono text-sm">{roomId}</code>
      </header>
      <main className="flex-1 p-6 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-400">待接收文件</h2>
          <button
            type="button"
            onClick={requestFileList}
            className="text-xs text-emerald-400 hover:underline"
          >
            刷新列表
          </button>
        </div>
        {remoteFileList.length === 0 ? (
          <p className="text-zinc-500 text-sm">等待发送端文件列表，或点击「刷新列表」</p>
        ) : (
          <>
            <ul className="space-y-2 mb-6">
              {remoteFileList.map((f) => (
                <li
                  key={f.name}
                  onClick={() => toggleFileSelection(f.name)}
                  className="flex items-center gap-3 py-3 px-4 rounded-lg bg-zinc-800/50 cursor-pointer hover:bg-zinc-800 border border-transparent hover:border-zinc-600 transition"
                >
                  <input
                    type="checkbox"
                    checked={selectedFiles.includes(f.name)}
                    onChange={() => toggleFileSelection(f.name)}
                    className="rounded text-emerald-600"
                  />
                  <FileText className="w-4 h-4 text-zinc-500" />
                  <span className="flex-1 truncate text-sm">{f.name}</span>
                  <span className="text-zinc-500 text-xs">{formatSize(f.size)}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={handleRequestDownload}
              disabled={selectedFiles.length === 0}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium"
            >
              下载所选（{selectedFiles.length} 个文件）
            </button>
          </>
        )}
        {Object.keys(downloadProgress).length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-medium text-zinc-400 mb-3">下载进度</h2>
            <div className="space-y-3">
              {Object.entries(downloadProgress).map(([name, percent]) => (
                <div key={name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400 truncate">{name}</span>
                    <span className="text-zinc-500">{Math.round(percent)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-700 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function App() {
  const role = useTransferStore((s) => s.role)

  if (role === 'sender') return <SenderView />
  if (role === 'receiver') return <ReceiverView />
  return (
    <RoleChoice
      onSender={() => {
        useTransferStore.getState().setRole('sender')
      }}
      onReceiver={() => {
        useTransferStore.getState().setRole('receiver')
      }}
    />
  )
}
