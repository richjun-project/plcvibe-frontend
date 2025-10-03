"use client"

import { Header } from "@/components/layouts/Header"
import { ChatInterface } from "@/components/features/chat/ChatInterface"
import { FileManager } from "@/components/features/editor/FileManager"
import { useFileStore } from "@/lib/store/fileStore"

export default function ChatPage() {
  const { files, activeFileId, setActiveFile, uploadFile, deleteFile, createNewFile } = useFileStore()

  return (
    <div className="flex flex-col h-screen">
      <Header />
      <main className="flex-1 overflow-hidden flex">
        <FileManager
          files={files}
          activeFileId={activeFileId}
          onFileSelect={(file) => setActiveFile(file.id)}
          onFileUpload={uploadFile}
          onFileDelete={deleteFile}
          onNewFile={createNewFile}
        />
        <div className="flex-1 overflow-hidden">
          <ChatInterface />
        </div>
      </main>
    </div>
  )
}