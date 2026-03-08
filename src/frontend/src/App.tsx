import React, { useState, useRef, useEffect } from 'react'
import './App.css'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || ''

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
}

const WELCOME: Message = {
  id: 'welcome',
  content: "Hello. I'm Lexis — your intelligent research assistant. Ask me anything about the documents in my knowledge base.",
  role: 'assistant',
  timestamp: new Date(),
}

function TypingIndicator() {
  return (
    <div className="typing-indicator">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`message-row ${isUser ? 'message-row--user' : 'message-row--assistant'}`}>
      {!isUser && (
        <div className="avatar avatar--assistant">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
          </svg>
        </div>
      )}
      <div className={`bubble ${isUser ? 'bubble--user' : 'bubble--assistant'}`}>
        <p className="bubble-text">{message.content}</p>
        <span className="bubble-time">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {isUser && <div className="avatar avatar--user">You</div>}
    </div>
  )
}

const SUGGESTED = [
  'What topics are covered in the knowledge base?',
  'Summarise the key concepts',
  'What are the main findings?',
]

export default function App() {
  const [messages, setMessages] = useState<Message[]>([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px'
  }, [input])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = {
      id: Date.now().toString(),
      content: trimmed,
      role: 'user',
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${BACKEND_URL}/api/response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed }),
      })

      if (!res.ok) throw new Error(`Status ${res.status}`)
      const data = await res.json()

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        content: data.message || "Sorry, I couldn't process that.",
        role: 'assistant',
        timestamp: new Date(),
      }])
    } catch {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        content: '⚠️ Connection error. Please check the server and try again.',
        role: 'assistant',
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const showSuggested = messages.length === 1

  return (
    <div className="shell">
      {/* Ambient background glow */}
      <div className="bg-glow" aria-hidden="true" />

      <div className="layout">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-brand">
            <div className="brand-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
              </svg>
            </div>
            <span className="brand-name">Lexis</span>
          </div>

          <div className="sidebar-section">
            <p className="sidebar-label">Status</p>
            <div className="status-row">
              <span className="status-dot" />
              <span className="status-text">Knowledge base active</span>
            </div>
          </div>

          <div className="sidebar-section">
            <p className="sidebar-label">Model</p>
            <p className="sidebar-value">Llama 3.1 · Groq</p>
          </div>

          <div className="sidebar-section">
            <p className="sidebar-label">Retrieval</p>
            <p className="sidebar-value">ChromaDB · MiniLM</p>
          </div>

          <div className="sidebar-footer">
            <button className="clear-btn" onClick={() => setMessages([WELCOME])}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
              </svg>
              New conversation
            </button>
          </div>
        </aside>

        {/* Main chat */}
        <main className="chat-main">
          <header className="chat-header">
            <div>
              <h1 className="chat-title">Research Assistant</h1>
              <p className="chat-subtitle">Ask questions about your documents</p>
            </div>
          </header>

          <section className="messages-area">
            {messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {loading && (
              <div className="message-row message-row--assistant">
                <div className="avatar avatar--assistant">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>
                  </svg>
                </div>
                <div className="bubble bubble--assistant">
                  <TypingIndicator />
                </div>
              </div>
            )}

            {showSuggested && (
              <div className="suggestions">
                <p className="suggestions-label">Try asking</p>
                <div className="suggestions-grid">
                  {SUGGESTED.map(s => (
                    <button key={s} className="suggestion-chip" onClick={() => sendMessage(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </section>

          <footer className="input-area">
            <div className="input-box">
              <textarea
                ref={textareaRef}
                className="input-field"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Lexis anything…"
                disabled={loading}
                rows={1}
              />
              <button
                className="send-btn"
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                title="Send"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
            <p className="input-hint">Press Enter to send · Shift+Enter for new line</p>
          </footer>
        </main>
      </div>
    </div>
  )
}
