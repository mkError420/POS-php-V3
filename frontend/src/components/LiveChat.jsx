import React, { useState, useEffect, useRef } from 'react';
import API_BASE_URL from '../config';

export default function LiveChat() {
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const messagesEndRef = useRef(null);
  const token = localStorage.getItem('token');

  // Poll for active sessions
  useEffect(() => {
    const fetchSessions = () => {
      fetch(`${API_BASE_URL}/superadmin/chats`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSessions(data);
          setLoading(false);
        }
      })
      .catch(err => console.error('Error fetching chat sessions:', err));
    };

    fetchSessions(); // initial fetch
    const interval = setInterval(fetchSessions, 5000); // poll every 5s
    return () => clearInterval(interval);
  }, [token]);

  // Poll for messages of the selected session
  useEffect(() => {
    let interval;
    if (selectedSessionId) {
      const fetchMessages = () => {
        fetch(`${API_BASE_URL}/superadmin/chats/${selectedSessionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setMessages(data);
          }
        })
        .catch(err => console.error('Error fetching messages:', err));
      };

      fetchMessages();
      interval = setInterval(fetchMessages, 3000);
    } else {
      setMessages([]);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedSessionId, token]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedSessionId) return;

    const messageToSend = chatInput;
    setChatInput('');

    try {
      const res = await fetch(`${API_BASE_URL}/superadmin/chats/${selectedSessionId}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ message: messageToSend })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMessages(prev => [...prev, data.message]);
        }
        setChatInput(''); // Optimistic clear
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleDeleteSession = async (mode) => {
    if (!selectedSessionId) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/superadmin/chats/${selectedSessionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ mode })
      });
      if (res.ok) {
        setSessions(prev => prev.filter(s => s.session_id !== selectedSessionId));
        setSelectedSessionId(null);
        setShowDeleteModal(false);
      } else {
        console.error('Failed to delete session');
      }
    } catch (err) {
      console.error('Error deleting session:', err);
    }
    setIsDeleting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-6rem)] bg-white rounded-2xl shadow-sm border border-slate-200 flex overflow-hidden">
      {/* Sidebar: Active Sessions */}
      <div className="w-1/3 border-r border-slate-200 bg-slate-50 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-white">
          <h2 className="text-lg font-bold text-slate-800">Live Chats</h2>
          <p className="text-xs text-slate-500">Real-time support requests</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              No active chat sessions right now.
            </div>
          ) : (
            sessions.map(session => (
              <button
                key={session.session_id}
                onClick={() => setSelectedSessionId(session.session_id)}
                className={`w-full text-left p-4 border-b border-slate-100 transition-colors flex flex-col gap-1 ${
                  selectedSessionId === session.session_id ? 'bg-indigo-50 border-indigo-100' : 'hover:bg-slate-100 bg-white'
                }`}
              >
                <div className="flex justify-between items-center w-full">
                  <span className="font-bold text-sm text-slate-800 truncate pr-2">
                    {session.sender_name || 'Guest Visitor'}
                  </span>
                  {session.unread_count > 0 && (
                    <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0">
                      {session.unread_count} New
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {session.last_message}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  {new Date(session.last_message_time).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Area: Chat Messages */}
      <div className="w-2/3 flex flex-col bg-slate-50">
        {selectedSessionId ? (
          <>
            <div className="p-4 bg-white border-b border-slate-200 shadow-sm z-10 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">
                  Chatting with {sessions.find(s => s.session_id === selectedSessionId)?.sender_name || 'Guest'}
                </h3>
                <p className="text-xs text-slate-500">Session ID: {selectedSessionId}</p>
              </div>
              <button 
                onClick={() => setShowDeleteModal(true)}
                className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"
                title="Delete Conversation"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-slate-400 text-sm mt-10">
                  Loading messages...
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isAdmin = msg.sender_type === 'super_admin';
                  return (
                    <div key={idx} className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] text-slate-400 mb-1 mx-1">
                        {msg.sender_name || (isAdmin ? 'You' : 'Guest')} • {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </span>
                      <div className={`px-4 py-2.5 rounded-2xl max-w-[70%] text-sm shadow-sm ${
                        isAdmin 
                          ? 'bg-indigo-600 text-white rounded-tr-none' 
                          : 'bg-white text-slate-800 rounded-tl-none border border-slate-200'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-slate-200">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Type your reply here..."
                  className="flex-1 bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
                <button 
                  type="submit" 
                  disabled={!chatInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2"
                >
                  Send
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <svg className="w-16 h-16 mb-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg font-medium">Select a chat session to start responding.</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full m-4">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Delete Conversation</h3>
            <p className="text-sm text-slate-600 mb-6">Choose how you want to delete this chat session.</p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => handleDeleteSession('for_me')}
                disabled={isDeleting}
                className="w-full py-2.5 px-4 bg-amber-50 hover:bg-amber-100 text-amber-700 font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                Delete for me
              </button>
              <button 
                onClick={() => handleDeleteSession('for_everyone')}
                disabled={isDeleting}
                className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-600 font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                Delete for everyone
              </button>
              <button 
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-sm transition-colors mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
