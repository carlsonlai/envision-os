'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  Bot,
  Send,
  X,
  Minimize2,
  Maximize2,
  Loader2,
  Sparkles,
  User,
} from 'lucide-react'
import { getChatbotConfig, type ChatbotConfig, type QuickAction } from '@/lib/chatbot-config'

// âââ Types ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface RoleChatbotProps {
  /** Override the role (defaults to session user role) */
  role?: string
  /** Start in expanded state */
  defaultExpanded?: boolean
}

// âââ Markdown-lite renderer âââââââââââââââââââââââââââââââââââââââââââââââââ
// Handles **bold**, *italic*, `code`, and line breaks
function renderMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\n)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-zinc-100">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i} className="italic">{part.slice(1, -1)}</em>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="rounded bg-zinc-800 px-1 py-0.5 text-xs text-zinc-300 font-mono">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part === '\n') return <br key={i} />
    return <span key={i}>{part}</span>
  })
}

// âââ Component ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export default function RoleChatbot({ role, defaultExpanded = true }: RoleChatbotProps) {
  const { data: session } = useSession()
  const userRole = role ?? session?.user?.role ?? ''
  const config = getChatbotConfig(userRole)

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [showQuickActions, setShowQuickActions] = useState(true)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded) {
      inputRef.current?.focus()
    }
  }, [isExpanded])

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setShowQuickActions(false)
    setIsStreaming(true)

    // Build conversation history for API
    const history = [...messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }))

    // Create assistant placeholder
    const assistantId = crypto.randomUUID()
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', timestamp: new Date() },
    ])

    try {
      abortRef.current = new AbortController()

      const res = await fetch('/api/ai/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, role: userRole }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        throw new Error(`API error: ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response stream')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          if (data === '[DONE]') break

          try {
            const parsed = JSON.parse(data) as { text?: string; error?: string }
            if (parsed.error) {
              throw new Error(parsed.error)
            }
            if (parsed.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + parsed.text }
                    : m
                )
              )
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Sorry, I encountered an error. Please try again.' }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [messages, isStreaming, userRole])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleQuickAction = (action: QuickAction) => {
    sendMessage(action.prompt)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const clearChat = () => {
    abortRef.current?.abort()
    setMessages([])
    setShowQuickActions(true)
    setIsStreaming(false)
  }

  // âââ Collapsed state (floating button) ââââââââââââââââââââââââââââââââââ
  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className={`fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${config.avatarGradient} shadow-lg shadow-black/40 transition-all hover:scale-105 active:scale-95`}
        title={`Open ${config.name}`}
      >
        <Bot className="h-5 w-5 text-white" />
      </button>
    )
  }

  // âââ Expanded chatbot âââââââââââââââââââââââââââââââââââââââââââââââââââ
  return (
    <div className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-40 flex flex-col w-[360px] max-h-[560px] rounded-xl border border-zinc-800/80 bg-[#0d0d14] shadow-2xl shadow-black/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/60 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${config.avatarGradient}`}>
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className={`text-sm font-semibold ${config.accentColor}`}>{config.name}</p>
            <p className="text-[10px] text-zinc-500 leading-none">{config.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={clearChat}
              className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              title="Clear chat"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="flex h-6 w-6 items-center justify-center rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="Minimise"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[280px] max-h-[380px]">
        {/* Greeting */}
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="flex gap-2.5">
              <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${config.avatarGradient}`}>
                <Sparkles className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="rounded-lg rounded-tl-none bg-zinc-800/50 border border-zinc-700/40 px-3 py-2 text-sm text-zinc-300 max-w-[280px]">
                {config.greeting}
              </div>
            </div>

            {/* Quick actions */}
            {showQuickActions && config.quickActions.length > 0 && (
              <div className="space-y-1.5 pl-9">
                <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-semibold">Quick actions</p>
                <div className="flex flex-wrap gap-1.5">
                  {config.quickActions.map((action) => {
                    const Icon = action.icon
                    return (
                      <button
                        key={action.label}
                        type="button"
                        onClick={() => handleQuickAction(action)}
                        className="flex items-center gap-1.5 rounded-md border border-zinc-700/50 bg-zinc-800/30 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/70 hover:border-zinc-600/50 transition-all"
                      >
                        <Icon className="h-3 w-3 flex-shrink-0" />
                        {action.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${
                msg.role === 'user'
                  ? 'bg-zinc-700'
                  : `bg-gradient-to-br ${config.avatarGradient}`
              }`}
            >
              {msg.role === 'user' ? (
                <User className="h-3.5 w-3.5 text-zinc-300" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-white" />
              )}
            </div>

            {/* Bubble */}
            <div
              className={`rounded-lg px-3 py-2 text-sm max-w-[260px] ${
                msg.role === 'user'
                  ? 'rounded-tr-none bg-[#6366f1]/20 border border-[#6366f1]/30 text-zinc-200'
                  : 'rounded-tl-none bg-zinc-800/50 border border-zinc-700/40 text-zinc-300'
              }`}
            >
              {msg.role === 'assistant' && msg.content === '' && isStreaming ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-zinc-500" />
                  <span className="text-xs text-zinc-500">Thinking...</span>
                </div>
              ) : (
                <div className="whitespace-pre-wrap break-words leading-relaxed">
                  {renderMarkdown(msg.content)}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-zinc-800/60 px-3 py-2.5">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${config.name}...`}
            rows={1}
            className="flex-1 resize-none rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600/50 transition-all max-h-[80px] scrollbar-thin"
            disabled={isStreaming}
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming}
            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-all ${
              input.trim() && !isStreaming
                ? `bg-gradient-to-br ${config.avatarGradient} text-white hover:opacity-90 active:scale-95`
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            }`}
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
