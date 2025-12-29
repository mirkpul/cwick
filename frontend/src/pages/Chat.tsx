/// <reference types="vite/client" />
import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { chatAPI } from '../services/api';
import toast from 'react-hot-toast';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface StreamingMessage extends Message {
  isStreaming: boolean;
}

export default function Chat() {
  const { kbId } = useParams<{ kbId: string }>();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessages, setStreamingMessages] = useState<Record<string, StreamingMessage>>({});
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessages]);

  const startConversation = async () => {
    if (!userName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    setLoading(true);

    try {
      const response = await chatAPI.startConversation(kbId!, {
        end_user_name: userName,
        end_user_email: userEmail || undefined,
      });

      const convId = response.data.conversation.id;
      setConversationId(convId);
      setShowWelcome(false);

      // Connect to WebSocket
      const websocket = new WebSocket(`${WS_URL}/ws`);

      websocket.onopen = () => {
        setConnected(true);

        // Authenticate with conversation
        websocket.send(
          JSON.stringify({
            type: 'authenticate',
            payload: { conversationId: convId },
          })
        );
      };

      websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === 'new_message') {
          setMessages((prev) => [...prev, data.payload]);
        } else if (data.type === 'professional_joined') {
          toast.success(data.payload.message);
        } else if (data.type === 'streaming_start') {
          // Create a temporary streaming message
          setStreamingMessages((prev) => ({
            ...prev,
            [data.payload.messageId]: {
              id: data.payload.messageId,
              sender: data.payload.sender,
              content: '',
              created_at: new Date().toISOString(),
              isStreaming: true,
            },
          }));
        } else if (data.type === 'streaming_chunk') {
          // Append chunk to streaming message
          setStreamingMessages((prev) => ({
            ...prev,
            [data.payload.messageId]: {
              ...prev[data.payload.messageId],
              content: (prev[data.payload.messageId]?.content || '') + data.payload.chunk,
            },
          }));
        } else if (data.type === 'streaming_end') {
          // Remove streaming message and add final message
          setStreamingMessages((prev) => {
            const newState = { ...prev };
            delete newState[data.payload.messageId];
            return newState;
          });
          setMessages((prev) => [...prev, data.payload.message]);
        }
      };

      websocket.onerror = () => {
        toast.error('Connection error');
      };

      websocket.onclose = () => {
        setConnected(false);
      };

      setWs(websocket);
    } catch {
      toast.error('Failed to start conversation');
    }

    setLoading(false);
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !ws || !connected) return;

    const messageContent = inputMessage.trim();
    setInputMessage('');

    try {
      // Send message via WebSocket
      ws.send(
        JSON.stringify({
          type: 'send_message',
          payload: {
            conversationId,
            content: messageContent,
          },
        })
      );
    } catch {
      toast.error('Failed to send message');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [ws]);

  if (showWelcome) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Start a Conversation</h2>
            <p className="text-gray-600">Let&apos;s get to know you before we begin</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name *
              </label>
              <input
                type="text"
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email (optional)
              </label>
              <input
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="john@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={startConversation}
              disabled={loading}
              className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
            >
              {loading ? 'Starting...' : 'Start Chat'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
            <span className="text-white font-bold">AI</span>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Digital Twin Assistant</h3>
            <p className="text-xs text-gray-500">
              {connected ? (
                <span className="flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                  Online
                </span>
              ) : (
                <span className="flex items-center">
                  <span className="w-2 h-2 bg-gray-400 rounded-full mr-1"></span>
                  Connecting...
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && Object.keys(streamingMessages).length === 0 && (
          <div className="text-center text-gray-500 mt-10">
            <p>Start the conversation by sending a message below</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                message.sender === 'user'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-900 shadow-sm'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              <p className="text-xs mt-1 opacity-75">
                {new Date(message.created_at).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {/* Streaming messages */}
        {Object.values(streamingMessages).map((message) => (
          <div
            key={message.id}
            className="flex justify-start"
          >
            <div className="max-w-xs lg:max-w-md px-4 py-3 rounded-lg bg-white text-gray-900 shadow-sm">
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              <div className="flex items-center mt-1 space-x-1">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t px-6 py-4">
        <div className="flex space-x-3">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={!connected}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100"
          />
          <button
            onClick={sendMessage}
            disabled={!connected || !inputMessage.trim()}
            className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
