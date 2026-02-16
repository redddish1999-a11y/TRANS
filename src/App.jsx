import React, { useState } from 'react'
import { useTransferStore } from './stores/transferStore'
import { createSenderPeer, createReceiverPeer } from './lib/p2p'

function App() {
  // 从全局 Store 中获取状态
  const { 
    isConnected, 
    myPeerId, 
    remoteFileList, 
    selectedFiles,
    toggleFileSelection
  } = useTransferStore()

  // 本地 UI 状态
  const [inputRoomId, setInputRoomId] = useState('')
  const [role, setRole] = useState(null) // 'sender' | 'receiver'

  // 1. 发送端逻辑：创建房间
  const handleStartSender = () => {
    setRole('sender')
    const randomId = Math.random().toString(36).substring(2, 8).toUpperCase()
    createSenderPeer(randomId)
  }

  // 2. 接收端逻辑：点击连接
  const handleJoinRoom = () => {
    if (!inputRoomId) return alert('请输入房间号')
    setRole('receiver')
    createReceiverPeer(inputRoomId)
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      <div className="max-w-md mx-auto">
        <header className="text-center mb-10">
          <h1 className="text-3xl font-bold text-blue-400">TRANS P2P</h1>
          <p className="text-slate-400 text-sm">换电脑后的新起点 🚀</p>
        </header>

        {!isConnected ? (
          <div className="bg-slate-800 p-6 rounded-2xl shadow-xl border border-slate-700">
            {!role ? (
              <div className="space-y-4">
                <button onClick={handleStartSender} className="w-full p-6 bg-blue-600 rounded-xl font-bold">我要发文件</button>
                <button onClick={() => setRole('receiver')} className="w-full p-6 bg-slate-700 rounded-xl font-bold">我要收文件</button>
              </div>
            ) : (
              <div className="space-y-4">
                {role === 'sender' ? (
                  <div className="text-center">
                    <p className="text-slate-400 mb-2">你的房间号</p>
                    <div className="text-4xl font-mono font-bold text-white">{myPeerId || '生成中...'}</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <input 
                      type="text" 
                      placeholder="输入房间号" 
                      className="w-full p-4 bg-slate-900 rounded-lg text-center text-2xl"
                      onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                    />
                    <button onClick={handleJoinRoom} className="w-full p-4 bg-emerald-600 rounded-lg font-bold">连接</button>
                  </div>
                )}
                <button onClick={() => setRole(null)} className="w-full text-slate-500 text-sm">返回</button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-emerald-500/20 border border-emerald-500/50 p-6 rounded-xl text-center">
            <p className="text-emerald-400 font-bold">已成功连接！</p>
            <p className="text-sm text-slate-400 mt-2">现在可以开始 P2P 传输了</p>
            <button onClick={() => window.location.reload()} className="mt-4 text-xs text-slate-500">断开连接</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default App