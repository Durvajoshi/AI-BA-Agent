import { useEffect, useState } from "react";
import * as chatApi from "../api/chatApi";
import "../styles/ConversationHistory.css";

export function ConversationHistory({ currentConversationId, onSelectConversation, onNewChat }) {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedMenu, setExpandedMenu] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    loadConversations();
    // Refresh every 5 seconds
    const interval = setInterval(loadConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadConversations = async () => {
    try {
      const data = await chatApi.getAllConversations();
      setConversations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = async (conversationId, e) => {
    e.stopPropagation();
    if (window.confirm("Delete this conversation?")) {
      try {
        await chatApi.deleteConversation(conversationId);
        setConversations(conversations.filter(c => c.id !== conversationId));
        setExpandedMenu(null);
        // If deleted conversation was active, create new one
        if (currentConversationId === conversationId) {
          onNewChat();
        }
      } catch (err) {
        console.error("Failed to delete conversation:", err);
        alert("Failed to delete conversation");
      }
    }
  };

  const handleRename = async (conversationId, e) => {
    e.stopPropagation();
    setRenamingId(conversationId);
    const conv = conversations.find(c => c.id === conversationId);
    setRenameValue(conv?.title || "");
    setExpandedMenu(null);
  };

  const handleSaveRename = async (conversationId) => {
    if (!renameValue.trim()) {
      alert("Title cannot be empty");
      return;
    }
    try {
      await chatApi.updateConversationTitle(conversationId, renameValue);
      setConversations(
        conversations.map(c =>
          c.id === conversationId ? { ...c, title: renameValue } : c
        )
      );
      setRenamingId(null);
      setRenameValue("");
    } catch (err) {
      console.error("Failed to rename conversation:", err);
      alert("Failed to rename conversation");
    }
  };

  const handleTogglePin = async (conversationId, isPinned, e) => {
    e.stopPropagation();
    try {
      await chatApi.toggleConversationPin(conversationId, !isPinned);
      setConversations(
        conversations.map(c =>
          c.id === conversationId
            ? { ...c, is_pinned: !isPinned, pin_order: !isPinned ? Date.now() : 0 }
            : c
        ).sort((a, b) => {
          if (a.is_pinned !== b.is_pinned) return b.is_pinned ? 1 : -1;
          return b.pin_order - a.pin_order;
        })
      );
      setExpandedMenu(null);
    } catch (err) {
      console.error("Failed to toggle pin:", err);
      alert("Failed to toggle pin");
    }
  };

  const handleToggleMenu = (conversationId, e) => {
    e.stopPropagation();
    setExpandedMenu(expandedMenu === conversationId ? null : conversationId);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="conversation-history">
      <div className="history-header">
        <h2>Chat History</h2>
        <button className="new-chat-btn-small" onClick={onNewChat} title="New chat">
          ➕
        </button>
      </div>

      {loading ? (
        <div className="history-loading">Loading...</div>
      ) : conversations.length === 0 ? (
        <div className="history-empty">No conversations yet</div>
      ) : (
        <div className="conversations-list">
          {conversations.map((conv) => (
            <div key={conv.id}>
              {renamingId === conv.id ? (
                <div className="rename-input-wrapper" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveRename(conv.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    autoFocus
                    className="rename-input"
                  />
                  <button
                    className="rename-save-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSaveRename(conv.id);
                    }}
                  >
                    ✓
                  </button>
                  <button
                    className="rename-cancel-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingId(null);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div
                  className={`conversation-item ${currentConversationId === conv.id ? "active" : ""}`}
                  onClick={() => onSelectConversation(conv.id)}
                  title={conv.title}
                >
                  {conv.is_pinned && <span className="pin-indicator">📌</span>}
                  <div className="conversation-content">
                    <div className="conversation-title">{conv.title}</div>
                    <div className="conversation-preview">
                      {conv.preview || "No messages yet"}
                    </div>
                    <div className="conversation-date">{formatDate(conv.updated_at)}</div>
                  </div>
                  <button
                    className="conversation-menu-btn"
                    onClick={(e) => handleToggleMenu(conv.id, e)}
                  >
                    ⋯
                  </button>
                  {expandedMenu === conv.id && (
                    <div className="conversation-menu" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="menu-item rename"
                        onClick={(e) => handleRename(conv.id, e)}
                      >
                        ✏️ Rename
                      </button>
                      <button
                        className={`menu-item pin ${conv.is_pinned ? "pinned" : ""}`}
                        onClick={(e) => handleTogglePin(conv.id, conv.is_pinned, e)}
                      >
                        {conv.is_pinned ? "📌 Unpin" : "📌 Pin"}
                      </button>
                      <button
                        className="menu-item delete"
                        onClick={(e) => handleDeleteConversation(conv.id, e)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
