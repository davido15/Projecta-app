import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import ReactMarkdown from 'react-markdown';

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

function ActionItemsList({ items }) {
  return (
    <ul style={{ paddingLeft: 24, margin: '12px 0' }}>
      {items.map((item, idx) => (
        <li key={idx} style={{ marginBottom: 12 }}>
          <span style={{ fontWeight: 'bold' }}>{item.title}</span>: {item.description}
          {item.responsible && (
            <span style={{ fontStyle: 'italic', marginLeft: 8 }}>({item.responsible})</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function Message({ role, content }) {
  if (role === 'bot') {
    // Try to parse as action items JSON array
    let actionItems = null;
    if (typeof content === 'string') {
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length && parsed[0].title && parsed[0].description) {
          actionItems = parsed;
        }
      } catch (e) { /* not JSON, fallback */ }
    }
    if (actionItems) {
      return (
        <div className={`message ${role}`} style={{ background: 'none' }}>
          <span className="role-label">AI</span>
          <div className={`bubble ${role}`} style={{ background: 'none', color: '#222', boxShadow: 'none' }}>
            <ActionItemsList items={actionItems} />
          </div>
        </div>
      );
    }
    // fallback to normal bot message
    return (
      <div className={`message ${role}`} style={{ background: 'none' }}>
        <span className="role-label">AI</span>
        <div className={`bubble ${role}`} style={{ background: 'none', color: '#222', boxShadow: 'none' }}>
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
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

  // Use environment variable for backend URL
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://35.188.164.16:5001';

  // Fetch projects on mount
  useEffect(() => {
    axios.get(`${BACKEND_URL}/projects`)
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
      axios.get(`${BACKEND_URL}/projects/${selectedProjectId}/messages`)
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

  // Function to reload messages from backend
  const reloadMessages = async () => {
    if (!selectedProjectId) return;
    try {
      const res = await axios.get(`${BACKEND_URL}/projects/${selectedProjectId}/messages`);
      setMessages(res.data);
    } catch (err) {
      setMessages([]);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    setLoading(true);
    const userMessage = { role: 'user', content: input };
    const thinkingMessage = { role: 'bot', content: '⏳ Formatting your update...' };
    setMessages(prev => [...prev, userMessage, thinkingMessage]);
    const currentInput = input;
    setInput('');
    const project = projects.find(p => p.id === selectedProjectId);
    const projectName = project ? project.name : '';
    try {
      const response = await axios.post(`${BACKEND_URL}/format`, {
        update: currentInput,
        project_id: selectedProjectId,
        project_name: projectName,
      });
      setMessages(prev => {
        const updated = prev.slice(0, -1);
        const aiContent = response.data.formatted || response.data.message || "No response from backend.";
        return [...updated, { role: 'bot', content: aiContent }];
      });
    } catch (error) {
      setMessages(prev => {
        const updated = prev.slice(0, -1);
        return [...updated, { role: 'bot', content: 'Error getting response.' }];
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      const res = await axios.post(`${BACKEND_URL}/create-checkout-session`);
      window.location.href = res.data.url;
    } catch (err) {
      alert('Subscription failed.');
    }
  };

  const handleNewProject = async () => {
    const name = prompt("Enter a name for your new project:");
    if (!name) return;
    try {
      const res = await axios.post(`${BACKEND_URL}/projects`, { name });
      setProjects(prev => [...prev, res.data]);
      setSelectedProjectId(res.data.id);
    } catch (err) {
      alert('Failed to create project.');
    }
  };

  const summarizeProject = async () => {
    if (!selectedProjectId) return;
    // Gather all messages for the current project
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;
    try {
      // Fetch all messages for the project
      const res = await axios.get(`${BACKEND_URL}/projects/${selectedProjectId}/messages`);
      const allMessages = res.data.join('\n');
      // Send to backend for summary
      const summaryRes = await axios.post(`${BACKEND_URL}/summarize`, { update: allMessages });
      setMessages(prev => [...prev, { role: 'bot', content: summaryRes.data.summary || 'No summary available.' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', content: 'Error summarizing project.' }]);
    }
  };

  const generateProjectPlan = async () => {
    if (!selectedProjectId) return;
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;
    try {
      // Fetch all messages for the project
      const res = await axios.get(`${BACKEND_URL}/projects/${selectedProjectId}/messages`);
      const allMessages = res.data.join('\n');
      // Send to backend for project plan
      const planRes = await axios.post(`${BACKEND_URL}/project-plan`, {
        update: allMessages,
        project_name: project.name,
      });
      setMessages(prev => [
        ...prev,
        { role: 'bot', content: planRes.data.plan || 'No project plan available.' }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'bot', content: 'Error generating project plan.' }
      ]);
    }
  };

  const extractActionItems = async () => {
    if (!selectedProjectId) return;
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;
    try {
      const res = await axios.get(`${BACKEND_URL}/projects/${selectedProjectId}/messages`);
      // Join all message contents into a single string
      const allMessages = res.data.map(msg => msg.content).join('\n');
      const itemsRes = await axios.post(`${BACKEND_URL}/action-items`, {
        update: allMessages,
        project_name: project.name,
        project_id: selectedProjectId,
      });
      setMessages(prev => [
        ...prev,
        { role: 'bot', content: itemsRes.data.action_items }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'bot', content: 'Error extracting action items.' }
      ]);
    }
  };

  const analyzeSentiment = async () => {
    if (!selectedProjectId) return;
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;
    try {
      const res = await axios.get(`${BACKEND_URL}/projects/${selectedProjectId}/messages`);
      // FIX: Extract message content before joining
      const allMessages = res.data.map(msg => msg.content).join('\n');
      const sentimentRes = await axios.post(`${BACKEND_URL}/sentiment`, {
        update: allMessages,
        project_name: project.name,
        project_id: selectedProjectId,
      });
      setMessages(prev => [
        ...prev,
        { role: 'bot', content: sentimentRes.data.sentiment || 'No sentiment found.' }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'bot', content: 'Error analyzing sentiment.' }
      ]);
    }
  };

  // Update generateEmail to use sentiment
  const generateEmail = async () => {
    if (!selectedProjectId) return;
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;
    try {
      const res = await axios.get(`${BACKEND_URL}/projects/${selectedProjectId}/messages`);
      const allMessages = res.data.join('\n');
      // Get sentiment first
      const sentimentRes = await axios.post(`${BACKEND_URL}/sentiment`, {
        update: allMessages,
        project_name: project.name,
      });
      const sentiment = sentimentRes.data.sentiment || '';
      // Send to backend for email generation
      const emailRes = await axios.post(`${BACKEND_URL}/generate-email`, {
        update: allMessages,
        project_name: project.name,
        sentiment,
      });
      setMessages(prev => [
        ...prev,
        { role: 'bot', content: emailRes.data.email || 'No email generated.' }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'bot', content: 'Error generating email.' }
      ]);
    }
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="gpt-root">
      {/* MVP Demo Banner */}
      <div style={{
        width: '100%',
        background: '#fffbe6',
        color: '#b26a00',
        padding: '12px 0',
        textAlign: 'center',
        fontWeight: 600,
        fontSize: '1rem',
        borderBottom: '2px solid #ffe082',
        zIndex: 1000,
        position: 'fixed',
        top: 0,
        left: 0
      }}>
        🚧 This is an MVP demo. Data will be lost if the server restarts. Please try the features and share your feedback! 🚧
      </div>
      <aside className="gpt-sidebar" style={{ marginTop: 48 }}>
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
      <main className="gpt-main" style={{ marginTop: 48 }}>
        <header className="gpt-header-bar">
          <span className="gpt-header-title">AI Project Assistant</span>
          {filteredProjects.find(p => p.id === selectedProjectId) && (
            <span style={{ marginLeft: 20, fontWeight: 'bold', color: '#1976d2' }}>
              Project: {filteredProjects.find(p => p.id === selectedProjectId)?.name}
            </span>
          )}
          {selectedProjectId && (
            <>
              <button style={{ marginLeft: 20, padding: '4px 12px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                onClick={summarizeProject}>
                Summarize Project
              </button>
              <button style={{ marginLeft: 10, padding: '4px 12px', background: '#ff9800', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                onClick={extractActionItems}>
                Extract Action Items
              </button>
              <button style={{ marginLeft: 10, padding: '4px 12px', background: '#0097a7', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                onClick={analyzeSentiment}>
                Analyze Sentiment
              </button>
              <button style={{ marginLeft: 10, padding: '4px 12px', background: '#6a1b9a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                onClick={generateEmail}>
                Generate Email
              </button>
            </>
          )}
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
