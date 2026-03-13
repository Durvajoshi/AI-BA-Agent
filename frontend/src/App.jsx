import { useEffect, useState, useRef, useContext } from "react";
import mermaid from "mermaid";
import { AuthContext } from "./context/AuthContext";
import { Login } from "./components/Login";
import { Signup } from "./components/Signup";
import { ConversationHistory } from "./components/ConversationHistory";
import { Profile } from "./components/Profile";
import * as chatApi from "./api/chatApi";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ForgotPassword } from "./components/ForgotPassword";
import * as Babel from "@babel/standalone";

function ChatInterface() {
  const { user, logout } = useContext(AuthContext);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [diagram, setDiagram] = useState(null);
  const [input, setInput] = useState("");
  const [hasBA, setHasBA] = useState(false);
  const [isExported, setIsExported] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [diagramZoom, setDiagramZoom] = useState(100);

  // Add this near your other state variables (like diagram, messages, etc.)
const [activeTab, setActiveTab] = useState("diagram"); // options: "diagram", "gherkin", "schema"
const [gherkin, setGherkin] = useState("");
const [dataSchema, setDataSchema] = useState("");
// Add to state
const [prototypeCode, setPrototypeCode] = useState("");

// Inside loadDiagram(id)

  const [showJiraError, setShowJiraError] = useState(false); // <--- PASTE THIS

  const pollInterval = useRef(null);
  const diagramRef = useRef(null);
  const diagramWrapperRef = useRef(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "loose"
    });
  }, []);

  useEffect(() => {
    // Cleanup empty conversations on app load
    const cleanup = async () => {
      try {
        await chatApi.cleanupEmptyConversations();
      } catch (err) {
        console.error("Cleanup error:", err);
      }
    };
    cleanup();

    const id = localStorage.getItem("conversationId");
    if (id) {
      setConversationId(id);
      loadMessages(id);
      loadDiagram(id);
      startPolling(id);
    } else {
      createNewChat();
    }

    return () => clearInterval(pollInterval.current);
  }, []);

  const checkStatus = async (cid) => {
  if (!cid) return;
  try {
    const data = await chatApi.checkJiraStatus(cid);
    if (data.exists) {
      setHasBA(true);
      setIsExported(data.isExported);
      // Optional: if (data.isExported) clearInterval(pollInterval.current);
    }
  } catch (err) {
    console.error("Status check error:", err);
    
    // STOP POLLING on Auth Errors (401/403)
    // This prevents the infinite loop if the token is bad
    if (err.message.includes("401") || err.message.includes("403") || err.message.includes("Unauthorized")) {
      console.warn("Stopping poll due to authentication error.");
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
        pollInterval.current = null;
      }
    }
  }
};

  const startPolling = (cid) => {
    if (pollInterval.current) clearInterval(pollInterval.current);
    checkStatus(cid);
    pollInterval.current = setInterval(() => checkStatus(cid), 10000);
  };

  const createNewChat = async () => {
    try {
      const data = await chatApi.startNewConversation();
      localStorage.setItem("conversationId", data.conversationId);
      setConversationId(data.conversationId);
      setMessages([]);
      setDiagram(null);
      setHasBA(false);
      setIsExported(false);
      startPolling(data.conversationId);
    } catch (err) {
      console.error("Create chat error:", err);
      alert("Failed to create new chat");
    }
  };

  const loadMessages = async (id) => {
    try {
      const data = await chatApi.loadMessages(id);
      if (Array.isArray(data)) {
        setMessages(data);
      }
    } catch (err) {
      console.error("Load messages error:", err);
    }
  };


  const loadDiagram = async (id) => {
  try {
    const data = await chatApi.loadDiagram(id);

    // 👇 PASTE THESE 3 LINES RIGHT HERE
    console.log("RAW API RESPONSE:", data);
    console.log("TYPE OF RESPONSE:", typeof data);
    console.log("PROTOTYPE FIELD:", data?.prototype);

    setDiagram(data.diagram || "");
    setGherkin(data.gherkin || "");
    setDataSchema(data.schema || "");

    const protoRaw = data.prototype || "";

let codeToRun = protoRaw.replace(/<PreviewApp \/>$/, "").trim();

// FIX JSX interpolation syntax
const fixedPrototype = codeToRun.replace(/\$\{(\w+)\}/g, '{$1}');

// Append proper render for React Runner
const finalCode = fixedPrototype + "\n\nReact.createElement(PreviewApp)";

setPrototypeCode(finalCode);

  } catch (err) {
    console.error("Failed to load specifications:", err);
  }
};
    

  useEffect(() => {
  if (activeTab !== "diagram" || !diagram || !diagramRef.current) return; // Only render when active tab is diagram

  const cleanDiagram = diagram
  .replace(/```mermaid/g, "")
  .replace(/```/g, "")
  .replace(/^workflowDiagram\s*/i, "")
  // 1. Remove spaces ONLY after commas in class definitions
  .replace(/(class\s+[\w,]+),\s+/g, "$1,") 
  // 2. Fix the specific "A1, C1, C2" issue by removing space after comma globally in class lines
  .replace(/class\s+([^;]+)/g, (match, p1) => {
    return `class ${p1.replace(/,\s+/g, ',').trim()}`;
  })
  // 3. Remove trailing commas before a newline or end of string
  .replace(/,\s*$/gm, "")
  .replace(/stroke:\s*$/gm, "")
  .trim();

const renderDiagram = async () => {
  try {
    const { svg } = await mermaid.render(
      "activityDiagram-" + Date.now(),
      cleanDiagram
    );

    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'center';
    wrapper.style.alignItems = 'flex-start';
    wrapper.style.overflow = 'auto'; // Allow vertical scrolling if necessary
    wrapper.style.width = '100%';    // Make sure wrapper width is 100% of parent container
    wrapper.style.maxWidth = '100%'; // Ensure no overflow

    wrapper.innerHTML = svg;

    diagramRef.current.innerHTML = ''; // Clear any previous diagram
    diagramRef.current.appendChild(wrapper);

    const svgElement = wrapper.querySelector("svg");
    if (svgElement) {
      svgElement.style.width = "auto";  // let width grow with zoom
svgElement.style.maxWidth = "none"; // remove max width restrictions
svgElement.style.height = "auto";
svgElement.style.display = "block";
svgElement.style.transformOrigin = "top left"; // zoom from top-left for natural scroll
svgElement.style.transform = `scale(${diagramZoom / 100})`;
    }
  } catch (err) {
    console.error("Mermaid render error:", err);
    diagramRef.current.innerHTML = `
      <pre style="color:#ae2a19;padding:12px;background:#ffeceb;border-radius:6px;border-left:4px solid #ae2a19;margin:0;font-size:12px;">
  Invalid Mermaid syntax.

  ${cleanDiagram}
      </pre>
    `;
  }
};



  renderDiagram();
}, [diagram, diagramZoom, activeTab]); // Add activeTab to the dependency array


  const handleZoomIn = () => {
    setDiagramZoom(prev => Math.min(prev + 10, 200));
    applyZoom(diagramZoom + 10);
  };

  const handleZoomOut = () => {
    setDiagramZoom(prev => Math.max(prev - 10, 50));
    applyZoom(diagramZoom - 10);
  };

  const handleResetZoom = () => {
    setDiagramZoom(100);
    applyZoom(100);
  };

  const applyZoom = (zoomLevel) => {
    if (diagramWrapperRef.current) {
      const svg = diagramWrapperRef.current.querySelector("svg");
      if (svg) {
        svg.style.transform = `scale(${zoomLevel / 100})`;
        svg.style.transformOrigin = "top center";
      }
    }
  };

  const handleDownloadDiagram = () => {
    if (!diagramWrapperRef.current) return;

    const svg = diagramWrapperRef.current.querySelector("svg");
    if (!svg) return;

    // Create a download link for SVG
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    // Download SVG
    const link = document.createElement("a");
    link.href = url;
    link.download = `activity-diagram-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const sendMessage = async () => {
    if (!input.trim() || isAiThinking) return;

    const content = input;
    setInput("");
    setIsAiThinking(true);

    setMessages(prev => [...prev, { sender: "user", content }]);

    try {
      await chatApi.sendMessage(conversationId, content);
      await loadMessages(conversationId);
      await loadDiagram(conversationId);
      await checkStatus(conversationId);
    } catch (err) {
      console.error("Send message error:", err);
      alert("Failed to send message");
    } finally {
      setIsAiThinking(false);
    }
  };

 const handleExport = async () => {
    if (isExporting || !hasBA) return;

    // Check if Jira credentials exist in the user context
    const isJiraConfigured = 
      user?.jira_base_url && 
      user?.jira_email && 
      user?.jira_lead_account_id;

    if (!isJiraConfigured) {
      setShowJiraError(true);
      return;
    }

    setIsExporting(true);
    try {
      const data = await chatApi.exportToJira(conversationId);
      if (data.projectKey) {
        setIsExported(true);
        // Use the user's base URL instead of a hardcoded one
        window.open(
          `${user.jira_base_url}/browse/${data.projectKey}`,
          "_blank"
        );
      } else if (data.error) {
        alert(data.error);
      }
    } catch (err) {
      alert("Export failed. Check console.");
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  const sanitizePrototypeCode = (code) => {
  if (!code) return "";

  let cleaned = code
    .replace(/```javascript/g, "")
    .replace(/```jsx/g, "")
    .replace(/```/g, "") // Remove all backticks
    .trim();

  // Remove the manual root.render calls if the LLM included them, 
  // because your iframe script adds its own.
  cleaned = cleaned.replace(/const root = ReactDOM\.createRoot[\s\S]*$/g, "");
  cleaned = cleaned.replace(/ReactDOM\.render[\s\S]*$/g, "");
  
  // Fix JSX interpolation syntax
  cleaned = cleaned.replace(/\$\{(\w+)\}/g, '{$1}');

  return cleaned;
};

const [previewHtml, setPreviewHtml] = useState("");

useEffect(() => {
  if (activeTab !== "preview" || !prototypeCode) return;

  const html = generateIframeHtml(prototypeCode);
  setPreviewHtml(html);

}, [activeTab, prototypeCode]);



const generateIframeHtml = (prototypeCode) => {
  const fixedCode = sanitizePrototypeCode(prototypeCode);
  
  // Ensure these URLs are clean strings without any leading/trailing whitespace or brackets
  const scripts = {
    babel: "https://unpkg.com/@babel/standalone/babel.min.js",
    react: "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
    reactDom: "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"
  };

  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <script src="${scripts.babel}" crossorigin></script>
      <script src="${scripts.react}" crossorigin></script>
      <script src="${scripts.reactDom}" crossorigin></script>
      <style>
        body { margin: 0; font-family: sans-serif; background-color: #f4f4f9; }
        #root { height: 100vh; }
      </style>
    </head>
    <body>
      <div id="root"></div>
      <script type="text/babel">
        try {
          const { useState, useEffect } = React;

          // Injected Code
          ${fixedCode}

          // Safe Render
          if (typeof PreviewApp !== 'undefined') {
            const root = ReactDOM.createRoot(document.getElementById("root"));
            root.render(<PreviewApp />);
          } else {
            document.getElementById("root").innerHTML = 
              '<div style="color:red;padding:20px;">Error: <b>PreviewApp</b> component not found.</div>';
          }
        } catch (err) {
          document.getElementById("root").innerHTML = 
            '<pre style="color:red;padding:20px;white-space:pre-wrap;">' + err.stack + '</pre>';
        }
      </script>
    </body>
  </html>
  `.trim();
};


return (
    <div style={styles.container}>
      {showProfile ? (
        <Profile onBackToChat={() => setShowProfile(false)} />
      ) : (
        <>
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <button
                onClick={handleExport}
                disabled={!hasBA || isExporting}
                style={{
                  ...styles.exportBtn,
                  backgroundColor: !hasBA
                    ? "#ccc"
                    : isExported
                    ? "#00875A"
                    : "#0052CC",
                  cursor:
                    hasBA && !isExporting ? "pointer" : "not-allowed"
                }}
              >
                {isExporting
                  ? "Syncing Jira..."
                  : !hasBA
                  ? "Generating BA..."
                  : isExported
                  ? "Update Jira Epic"
                  : "Export to Jira"}
              </button>
              {isAiThinking && (
                <span style={styles.thinkingText}>
                  AI is thinking...
                </span>
              )}
            </div>
            <div style={styles.headerRight}>
              <span style={styles.userEmail}>{user?.email}</span>
              <button
                style={styles.profileBtn}
                onClick={() => setShowProfile(true)}
                title="Profile Settings"
              >
                👤
              </button>
              <button style={styles.logoutBtn} onClick={logout}>
                Logout
              </button>
            </div>
          </div>

          <div style={styles.mainContainer}>
            <ConversationHistory 
              currentConversationId={conversationId}
              onSelectConversation={(id) => {
                localStorage.setItem("conversationId", id);
                setConversationId(id);
                setMessages([]);
                setDiagram(null);
                setHasBA(false);
                setIsExported(false);
                loadMessages(id);
                loadDiagram(id);
                startPolling(id);
              }}
              onNewChat={createNewChat}
            />
            
            <div style={styles.splitContainer}>
              <div style={styles.chat}>
                {messages.length === 0 && (
                  <div style={styles.emptyState}>
                    Describe your requirement to get started.
                  </div>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      ...styles.msg,
                      alignSelf:
                        m.sender === "user" ? "flex-end" : "flex-start",
                      background:
                        m.sender === "user" ? "#DCF8C6" : "#FFF",
                      border:
                        m.sender === "user"
                          ? "none"
                          : "1px solid #ddd"
                    }}
                  >
                    <pre style={styles.pre}>{m.content}</pre>
                  </div>
                ))}
              </div>

              <div style={styles.diagramPane}>
              <div style={styles.tabHeader}>
                <button 
                  onClick={() => setActiveTab("diagram")} 
                  style={{...styles.tabBtn, borderBottom: activeTab === "diagram" ? "2px solid #0052CC" : "none"}}
                >
                  Diagram
                </button>
                <button 
                  onClick={() => setActiveTab("gherkin")} 
                  style={{...styles.tabBtn, borderBottom: activeTab === "gherkin" ? "2px solid #0052CC" : "none"}}
                >
                  Gherkin (QA)
                </button>
                <button 
                  onClick={() => setActiveTab("schema")} 
                  style={{...styles.tabBtn, borderBottom: activeTab === "schema" ? "2px solid #0052CC" : "none"}}
                >
                  Data Schema
                </button>
                <button onClick={() => setActiveTab("preview")}>Preview App</button>
              </div>
              

              <div style={styles.tabContent}>
                {activeTab === "diagram" && (
                  <>
                    <div style={styles.diagramHeader}>
                      <h3 style={styles.diagramPaneTitle}>Activity Diagram</h3>
                      {diagram && (
                        <div style={styles.diagramControls}>
                          <button onClick={handleZoomOut} style={styles.diagramBtn}>🔍−</button>
                          <span style={styles.zoomLevel}>{diagramZoom}%</span>
                          <button onClick={handleZoomIn} style={styles.diagramBtn}>🔍+</button>
                          <button onClick={handleResetZoom} style={styles.diagramBtn}>↺</button>
                          <button onClick={handleDownloadDiagram} style={styles.diagramBtn}>⬇️</button>
                        </div>
                      )}
                    </div>
                    {diagram ? (
                      <div style={styles.diagramRefWrapper} ref={diagramWrapperRef}>
                        <div ref={diagramRef} />
                      </div>
                    ) : (
                      <div style={styles.emptyTabState}>Diagram will appear here.</div>
                    )}
                  </>
                )}

                {activeTab === "gherkin" && (
  <div style={styles.textTabContent}>
    <h3 style={styles.tabHeading}>Acceptance Criteria (Gherkin)</h3>
    {gherkin ? (
      <div style={styles.preBlock}>
        <ReactMarkdown>{gherkin}</ReactMarkdown>
      </div>
    ) : (
      <div style={styles.emptyTabState}>Gherkin scenarios will appear here.</div>
    )}
  </div>
)}

                {activeTab === "schema" && (
  <div style={styles.textTabContent}>
    <h3 style={styles.tabHeading}>Data Dictionary</h3>
    {dataSchema ? (
      <div className="markdown-table-wrapper" style={styles.schemaWrapper}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {dataSchema}
        </ReactMarkdown>
      </div>
    ) : (
      <div style={styles.emptyTabState}>Data schema will appear here.</div>
    )}
  </div>
)}
{activeTab === "preview" && (
  <div style={{ width: "100%", height: "100%" }}>
    {previewHtml ? (
      <iframe
        style={{ width: "100%", height: "100%", border: "none" }}
        srcDoc={previewHtml}
      />
    ) : (
      <div>Loading preview...</div>
    )}
  </div>
)}

              </div>
            </div>
            </div>
          </div>

          <div style={styles.inputBar}>
            <input
              style={styles.input}
              value={input}
              disabled={isAiThinking}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder={
                isAiThinking
                  ? "Waiting for response..."
                  : "Ask a question or request a change..."
              }
            />
            <button
              onClick={sendMessage}
              disabled={isAiThinking || !input.trim()}
              style={{
                ...styles.sendBtn,
                opacity:
                  isAiThinking || !input.trim() ? 0.5 : 1
              }}
            >
              Send
            </button>
            {/* Jira Credentials Popup */}
          {showJiraError && (
            <div style={styles.modalOverlay}>
              <div style={styles.modalContent}>
                <div style={{ fontSize: "40px", marginBottom: "15px" }}>⚠️</div>
                <h3 style={{ margin: "0 0 10px 0", color: "#333" }}>Jira Configuration Required</h3>
                <p style={{ color: "#666", marginBottom: "25px", fontSize: "14px", lineHeight: "1.5" }}>
                  Please update jira credentials in profile for export.
                </p>
                <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                  <button 
                    style={styles.diagramBtn} 
                    onClick={() => setShowJiraError(false)}
                  >
                    Cancel
                  </button>
                  <button 
                    style={styles.sendBtn} 
                    onClick={() => {
                      setShowJiraError(false);
                      setShowProfile(true);
                    }}
                  >
                    Go to Profile
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        </>
      )}
    </div>
  );
}

function App() {
  const { user, loading } = useContext(AuthContext);
  // view can be: "login", "signup", "forgot"
  const [view, setView] = useState("login");

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    if (view === "signup") {
      return <Signup onSwitchToLogin={() => setView("login")} />;
    }
    if (view === "forgot") {
      return <ForgotPassword onBackToLogin={() => setView("login")} />;
    }
    return (
      <Login 
        onSwitchToSignup={() => setView("signup")} 
        onSwitchToForgot={() => setView("forgot")} 
      />
    );
  }

  return <ChatInterface />;
}

/* ===============================
   Styles
================================ */
const styles = {

  previewContainer: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#f1f5f9",
    borderRadius: "8px",
    overflow: "hidden"
  },
  previewToolbar: {
    padding: "10px",
    background: "#1e293b",
    color: "#f8fafc",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "12px"
  },
  previewBox: {
    flex: 1,
    padding: "20px",
    overflowY: "auto",
    backgroundColor: "#ffffff"
  },
  tabHeading: {
    margin: "0 0 10px 0",
    fontSize: "15px",
    fontWeight: "600",
    color: "#161B22"
  },
  schemaWrapper: {
    padding: "5px", // Reduced padding as table has its own
    overflowX: "auto",
    backgroundColor: "#fff",
    borderRadius: "6px"
  },
  // ... rest of your styles
  container: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Segoe UI', 'Roboto', '-apple-system', 'BlinkMacSystemFont', sans-serif",
    backgroundColor: "#f6f8fa"
  },
  tabHeader: {
    display: "flex",
    borderBottom: "1px solid #d0d7de",
    marginBottom: "15px",
    gap: "10px"
  },
  tabBtn: {
    padding: "8px 16px",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "600",
    color: "#57606a",
    transition: "all 0.2s"
  },
 
  tabContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "auto"
  },
  textTabContent: {
    padding: "10px",
    backgroundColor: "#ffffff"
  },
  emptyTabState: {
    color: "#8c959b",
    fontSize: "13px",
    textAlign: "center",
    marginTop: "20px"
  },
  preBlock: {
    background: "#f6f8fa",
    padding: "15px",
    borderRadius: "6px",
    border: "1px solid #d0d7de",
    whiteSpace: "pre-wrap",
    fontSize: "13px",
    fontFamily: "monospace",
    lineHeight: "1.6"
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2000,
  },
  modalContent: {
    background: "white",
    padding: "30px",
    borderRadius: "12px",
    width: "90%",
    maxWidth: "400px",
    textAlign: "center",
    boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
  },
  loadingContainer: {
    height: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI', Roboto, Helvetica, sans-serif",
    fontSize: "16px",
    background: "linear-gradient(135deg, #f6f8fa 0%, #ffffff 100%)"
  },
  header: {
    padding: "14px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#ffffff",
    borderBottom: "1px solid #d0d7de",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    zIndex: 10
  },
  headerLeft: { 
    display: "flex", 
    alignItems: "center", 
    gap: "16px" 
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "12px"
  },
  userEmail: {
    fontSize: "13px",
    color: "#57606a",
    fontWeight: "500"
  },
  profileBtn: {
    padding: "8px 12px",
    background: "#ffffff",
    border: "1px solid #bcc5cf",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "16px",
    transition: "all 150ms cubic-bezier(0.2, 0, 0.13, 1)",
    hover: {
      background: "#f6f8fa",
      borderColor: "#0052CC"
    }
  },
  exportBtn: {
    padding: "9px 18px",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontWeight: "600",
    fontSize: "13px",
    transition: "all 150ms cubic-bezier(0.2, 0, 0.13, 1)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
  },
  thinkingText: {
    fontSize: "12px",
    color: "#57606a",
    fontStyle: "italic",
    animation: "pulse 1.5s infinite"
  },
  newChatBtn: {
    padding: "8px 12px",
    background: "transparent",
    color: "#0052CC",
    border: "1px solid #bcc5cf",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "all 150ms cubic-bezier(0.2, 0, 0.13, 1)"
  },
  logoutBtn: {
    padding: "8px 14px",
    background: "#ae2a19",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "600",
    transition: "all 150ms cubic-bezier(0.2, 0, 0.13, 1)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)"
  },
  mainContainer: {
    display: "flex",
    height: "calc(100vh - 120px)",
    overflow: "hidden",
    gap: "0"
  },
  chat: {
    width: "60%",
    height: "100%",
    overflowY: "auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    backgroundColor: "#f6f8fa",
    flexGrow: 0,
    borderRight: "1px solid #d0d7de"
  },
  emptyState: {
    textAlign: "center",
    marginTop: "60px",
    color: "#8c959b",
    fontSize: "15px"
  },
  msg: {
    padding: "12px 16px",
    borderRadius: "12px",
    maxWidth: "85%",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
    lineHeight: "1.5"
  },
  pre: { 
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    margin: 0,
    fontSize: "13px",
    fontFamily: "'Monaco', 'Menlo', monospace"
  },
  inputBar: {
    display: "flex",
    padding: "16px 20px",
    background: "#ffffff",
    borderTop: "1px solid #d0d7de",
    gap: "12px",
    alignItems: "center"
  },
  input: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: "6px",
    border: "1px solid #bcc5cf",
    fontSize: "14px",
    outline: "none",
    fontFamily: "inherit",
    transition: "all 150ms cubic-bezier(0.2, 0, 0.13, 1)"
  },
  sendBtn: {
    padding: "8px 20px",
    background: "#0052CC",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontWeight: "600",
    fontSize: "13px",
    cursor: "pointer",
    transition: "all 150ms cubic-bezier(0.2, 0, 0.13, 1)",
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    flexShrink: 0
  },
  splitContainer: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
    gap: "0"
  },

  diagramHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
    gap: "12px",
    overflowX: "hidden"
  },
  diagramPaneTitle: {
    margin: "0",
    fontSize: "15px",
    fontWeight: "600",
    color: "#161B22"
  },
  diagramControls: {
    display: "flex",
    gap: "6px",
    alignItems: "center"
  },
  diagramBtn: {
    padding: "6px 10px",
    background: "#f6f8fa",
    color: "#161b22",
    border: "1px solid #d0d7de",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "600",
    transition: "all 150ms cubic-bezier(0.2, 0, 0.13, 1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  zoomLevel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#57606a",
    minWidth: "45px",
    textAlign: "center"
  },
  diagramRefWrapper: {
  width: "100%",
  maxHeight: "100%",
  overflowX: "auto",       // allow horizontal scroll when zoomed
  overflowY: "auto",       // vertical scroll if content is tall
  borderRadius: "8px",
  border: "1px solid #d0d7de",
  background: "#f6f8fa",
  padding: "12px",
  flex: 1,
  boxSizing: "border-box",   // important so padding doesn’t cause overflow
  position: "relative",      // allow positioning children if needed
  // OPTIONAL: add padding-bottom to give scrollbar space if needed
  paddingBottom: "20px"      // extra space so horizontal scrollbar doesn’t cover content
},

diagramPane: {
  width: "40%",
  padding: "20px",
  background: "#ffffff",
  borderLeft: "1px solid #d0d7de",
  overflow: "hidden",       // no scrollbars here
  maxHeight: "100%",
  flexGrow: 0,
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box"
},

};

export default App;
