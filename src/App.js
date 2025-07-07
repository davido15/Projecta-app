import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

function formatBotMessage(content) {
  // Split by lines, format each line
  return content
    .split('\n')
    .map(line => {
      // Match: emoji, section title in bold, colon, rest
      const match = line.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|[\u2600-\u27BF\uD83C-\uDBFF\uDC00-\uDFFF\u2700-\u27BF\u2B50\u23F0\u231A\u23E9-\u23EF\u23F1-\u23F3\u25FD-\u25FE\u2614-\u2615\u2648-\u2653\u267B\u2693\u26A1\u26AA-\u26AB\u26BD-\u26BE\u26C4-\u26C5\u26CE\u26D4\u26EA\u26F2-\u26F3\u26F5\u26FA\u26FD\u2702\u2705\u2708-\u2709\u270A-\u270B\u2728\u2733-\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934-\u2935\u2B05-\u2B07\u2B1B-\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299\uD83C\uDC04\uD83C\uDCCF\uD83C\uDD70-\uD83C\uDD71\uD83C\uDD7E-\uD83C\uDD7F\uD83C\uDD8E\uD83C\uDD91-\uD83C\uDD9A\uD83C\uDDE6-\uD83C\uDDFF\uD83C\uDE01-\uD83C\uDE02\uD83C\uDE1A\uD83C\uDE2F\uD83C\uDE32-\uD83C\uDE3A\uD83C\uDE50-\uD83C\uDE51\uD83C\uDF00-\uD83D\uDDFF\uD83E\uDD00-\uD83E\uDDFF\uD83D\uDC00-\uD83D\uDE4F\uD83D\uDE80-\uD83D\uDEF6\uD83D\uDFE0-\uD83D\uDFEB\uD83D\uDFEC-\uD83D\uDFFF\uD83E\uDD10-\uD83E\uDDFF]+)\s*\*\*(.+?)\*\*:(.*)$/u);
      if (match) {
        const [, emoji, title, rest] = match;
        return `${emoji} <strong>${title}:</strong>${rest}`;
      }
      return line;
    })
    .join('<br/>');
}

function Message({ role, content }) {
  if (role === 'bot') {
    return (
      <div className={`message ${role}`} style={{ background: 'none' }}>
        <span className="role-label">AI</span>
        <div className={`bubble ${role}`} style={{ background: 'none', color: '#222', boxShadow: 'none' }} dangerouslySetInnerHTML={{ __html: formatBotMessage(content) }} />
      </div>
    );
  }
  return (
    <div className={`message ${role}`}>
      <span className="role-label">You</span>
      <div className={`bubble ${role}`}>{content}</div>
    </div>
  );
}

export default function App() {
  const [input, setInput] = useState('');
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const chatEndRef = useRef(null);

  // Fetch projects on mount
  useEffect(() => {
    axios.get('http://127.0.0.1:5000/projects')
      .then(res => {
        setProjects(res.data);
        if (res.data.length > 0) {
          setSelectedProjectId(res.data[0].id);
        }
      }).catch(err => console.error('Failed to load projects', err));
  }, []);

  // Fetch messages for selected project
  useEffect(() => {
    if (selectedProjectId != null) {
      axios.get(`http://127.0.0.1:5000/projects/${selectedProjectId}/messages`)
        .then(res => setMessages(res.data))
        .catch(err => console.error('Failed to load messages', err));
    } else {
      setMessages([]);
    }
  }, [selectedProjectId]);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    setLoading(true);
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    const thinkingMessage = { role: 'bot', content: 'Thinking...' };

    // Show user's message and 'Thinking...' at once
    setMessages(prev => [...prev, userMessage, thinkingMessage]);

    const currentInput = input;
    setInput('');

    try {
      const response = await axios.post('http://127.0.0.1:5000/format', {
        update: currentInput, // match your backend
      });

      // Replace 'Thinking...' with real response
      setMessages(prev => {
        // Remove the last message ('Thinking...')
        const updated = prev.slice(0, -1);
        // Add real response
        return [...updated, { role: 'bot', content: response.data.formatted }];
      });
    } catch (error) {
      console.error('Error sending message:', error);
      // Replace 'Thinking...' with error
      setMessages(prev => {
        const updated = prev.slice(0, -1);
        return [...updated, { role: 'bot', content: 'Error getting response.' }];
      });
    }
  };

  const handleSubscribe = async () => {
    try {
      const res = await axios.post('http://127.0.0.1:5000/create-checkout-session');
      window.location.href = res.data.url;
    } catch (err) {
      alert('Subscription failed.');
    }
  };

  const handleNewProject = async () => {
    try {
      const res = await axios.post('http://127.0.0.1:5000/projects', { name: `Project ${projects.length + 1}` });
      setProjects(prev => [...prev, res.data]);
      setSelectedProjectId(res.data.id);
    } catch (err) {
      alert('Failed to create project.');
    }
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="gpt-root">
      <aside className="gpt-sidebar">
        <div className="gpt-sidebar-header">
          <span className="gpt-logo">🧑‍💻</span>
          <span className="gpt-title">AI Project Assistant</span>
        </div>
        <nav className="gpt-sidebar-nav">
          <button className="gpt-newchat-btn" onClick={handleNewProject}>+ New Project</button>
          <input
            className="gpt-search-input"
            type="text"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="gpt-project-list">
            {filteredProjects.length === 0 && (
              <div className="gpt-chat-history-placeholder">No projects found</div>
            )}
            {filteredProjects.map(project => (
              <div
                key={project.id}
                className={`gpt-project-item${project.id === selectedProjectId ? ' selected' : ''}`}
                onClick={() => setSelectedProjectId(project.id)}
              >
                {project.name}
              </div>
            ))}
          </div>
        </nav>
        <div className="gpt-sidebar-footer">
          <button onClick={handleSubscribe} className="gpt-subscribe-btn">
            Subscribe for Pro
          </button>
        </div>
      </aside>
      <main className="gpt-main">
        <header className="gpt-header-bar">
          <span className="gpt-header-title">AI Project Assistant</span>
        </header>
        <h1 className="gpt-chat-title">
          {filteredProjects.find(p => p.id === selectedProjectId)?.name || 'AI Chat'}
        </h1>
        <div className="chat-container">
          {messages.map((msg, idx) => (
            <Message key={idx} role={msg.role} content={msg.content} />
          ))}
          {loading && <Message role="bot" content="⏳ Formatting your update..." />}
          <div ref={chatEndRef}></div>
        </div>
        <form className="input-area" onSubmit={e => { e.preventDefault(); handleSend(); }}>
          <textarea
            id="chat-input"
            name="chat-input"
            placeholder="Paste your raw project update here..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={1}
            disabled={loading}
          />
          <button type="submit" disabled={loading || !input.trim()}>
            Send
          </button>
        </form>
      </main>
    </div>
  );
}
