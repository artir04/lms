import { useState } from 'react'
import { MessageSquare, Plus, Send } from 'lucide-react'
import { useThreads, useThread, useSendMessage, useCreateThread } from '@/api/messaging'
import { PageLoader } from '@/components/ui/Spinner'
import { Avatar } from '@/components/ui/Avatar'
import { Modal } from '@/components/ui/Modal'
import { timeAgo } from '@/utils/formatters'
import { useAuth } from '@/hooks/useAuth'
import { useForm } from 'react-hook-form'
import { cn } from '@/utils/cn'

export function MessagingPage() {
  const { user } = useAuth()
  const { data: threads, isLoading } = useThreads()
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [showCompose, setShowCompose] = useState(false)

  const { data: thread } = useThread(selectedThreadId || '')
  const { mutate: sendMessage, isPending: sending } = useSendMessage(selectedThreadId || '')
  const { mutate: createThread } = useCreateThread()
  const { register, handleSubmit, reset } = useForm()

  const handleSend = () => {
    if (!newMessage.trim() || !selectedThreadId) return
    sendMessage(newMessage, { onSuccess: () => setNewMessage('') })
  }

  const onCreateThread = (data: any) => {
    createThread({ ...data, recipient_ids: data.recipient_ids?.split(',').map((s: string) => s.trim()) || [] }, {
      onSuccess: () => { setShowCompose(false); reset() },
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Messages</h2>
        <button onClick={() => setShowCompose(true)} className="btn-primary">
          <Plus className="h-4 w-4" />
          Compose
        </button>
      </div>

      <div className="card flex overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
        {/* Thread list */}
        <div className="w-80 flex-shrink-0 border-r border-gray-200 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8"><PageLoader /></div>
          ) : threads?.length ? (
            threads.map((t: any) => (
              <button
                key={t.id}
                onClick={() => setSelectedThreadId(t.id)}
                className={cn(
                  'w-full text-left px-4 py-4 border-b border-gray-100 hover:bg-gray-50 transition-colors',
                  selectedThreadId === t.id && 'bg-primary-50'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-gray-900 line-clamp-1">{t.subject}</span>
                  {t.unread_count > 0 && (
                    <span className="bg-primary-600 text-white text-xs rounded-full px-1.5 py-0.5">{t.unread_count}</span>
                  )}
                </div>
                {t.last_message && (
                  <p className="text-xs text-gray-500 line-clamp-1">{t.last_message.body}</p>
                )}
                {t.created_at && <p className="text-xs text-gray-400 mt-1">{timeAgo(t.created_at)}</p>}
              </button>
            ))
          ) : (
            <div className="text-center py-12 text-gray-400">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No messages yet</p>
            </div>
          )}
        </div>

        {/* Message thread */}
        {selectedThreadId && thread ? (
          <div className="flex-1 flex flex-col">
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">{(thread as any).subject}</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {(thread as any).messages?.map((msg: any) => {
                const isOwn = msg.sender_id === user?.id
                return (
                  <div key={msg.id} className={cn('flex gap-3', isOwn && 'flex-row-reverse')}>
                    <div className={cn(
                      'max-w-xs lg:max-w-sm px-4 py-2.5 rounded-2xl text-sm',
                      isOwn ? 'bg-primary-600 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                    )}>
                      <p>{msg.body}</p>
                      <p className={cn('text-xs mt-1', isOwn ? 'text-primary-200' : 'text-gray-400')}>
                        {timeAgo(msg.sent_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-3">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                className="input flex-1"
                placeholder="Type a message..."
              />
              <button onClick={handleSend} disabled={sending || !newMessage.trim()} className="btn-primary px-3">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>Select a conversation</p>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showCompose} onClose={() => setShowCompose(false)} title="New Message">
        <form onSubmit={handleSubmit(onCreateThread)} className="space-y-4">
          <div>
            <label className="label">Subject</label>
            <input {...register('subject', { required: true })} className="input" placeholder="Message subject" />
          </div>
          <div>
            <label className="label">Recipient IDs (comma-separated)</label>
            <input {...register('recipient_ids')} className="input" placeholder="uuid1, uuid2" />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea {...register('initial_message', { required: true })} rows={4} className="input resize-none" placeholder="Write your message..." />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowCompose(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1">Send</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
