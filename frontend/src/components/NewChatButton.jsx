export default function NewChatButton({ onNewChat }) {
  return (
    <button onClick={onNewChat} className="new-chat-btn">
      + New Chat
    </button>
  );
}
