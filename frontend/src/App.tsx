import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Send, Bot, Loader2, Landmark } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const API_URL = "http://localhost:8000/api/chat";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I am your Graph RAG Banking Policy assistant. How can I help you today?',
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await axios.post(API_URL, { message: userMessage.content });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.data.response,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error fetching response:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error while processing your request. Please try again later.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-zinc-100 flex-col md:flex-row overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="hidden md:flex w-72 flex-col bg-[#111113] border-r border-zinc-800 p-4">
        <div className="flex items-center gap-3 px-2 py-4 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-900/50">
            <Landmark className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
            PolicyGraph
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3 px-2">
            Knowledge Base
          </div>
          <div className="space-y-1">
            {['Retail Banking', 'Corporate Loans', 'Compliance & Risk', 'International Transfers'].map((item, i) => (
              <button key={i} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50 rounded-lg transition-colors text-left">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500/50" />
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-auto p-4 bg-blue-950/20 border border-blue-900/30 rounded-xl">
          <p className="text-xs text-blue-200/70 leading-relaxed">
            Connected to Neo4j Knowledge Graph & MongoDB Atlas for accurate, relationship-aware policy retrieval.
          </p>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full max-h-screen relative">

        {/* Header - Mobile only */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-800 bg-[#111113]">
          <div className="flex items-center gap-2">
            <Landmark className="h-5 w-5 text-blue-500" />
            <span className="font-semibold">PolicyGraph</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-32">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-4 p-4 rounded-2xl w-fit max-w-[85%] md:max-w-[75%]",
                  message.role === 'user'
                    ? "ml-auto bg-blue-600 text-white"
                    : "bg-[#18181b] border border-zinc-800/50 text-zinc-200"
                )}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 mt-0.5 hidden sm:block">
                    <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                      <Bot className="h-4 w-4 text-blue-400" />
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  {message.role === 'assistant' && (
                    <span className="text-xs font-medium text-zinc-500">Graph Agent</span>
                  )}
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-4 p-4 rounded-2xl bg-[#18181b] border border-zinc-800/50 w-fit">
                <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                  <Bot className="h-4 w-4 text-blue-400" />
                </div>
                <div className="flex items-center gap-2 text-zinc-400 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  Querying knowledge graph...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#09090b] via-[#09090b] to-transparent pt-10">
          <div className="max-w-3xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-500"></div>
            <form
              onSubmit={handleSubmit}
              className="relative flex items-center bg-[#18181b] border border-zinc-700/50 rounded-2xl overflow-hidden focus-within:border-zinc-500 transition-colors shadow-2xl"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about banking policies..."
                className="flex-1 bg-transparent border-none py-4 pl-5 pr-12 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-0"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-2 p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
            <div className="text-center mt-3">
              <span className="text-[10px] text-zinc-600">
                Responses are generated by AI querying the Neo4j Knowledge Graph. Verify important policies.
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
