from typing import List, Dict, Optional, Any
import backend.database as db

class ConversationManager:
    """
    Manages persistent conversations using SQLite with session caching.
    """
    def __init__(self, max_turns: int = 15):
        self.max_turns = max_turns

    def get_history(self, conversation_id: Optional[str] = None) -> List[Dict[str, str]]:
        if not conversation_id:
            # Fallback to latest conversation or create new
            convs = db.list_conversations()
            if convs:
                conversation_id = convs[0]["id"]
            else:
                new_c = db.create_conversation("Default Chat")
                conversation_id = new_c["id"]
                
        messages = db.get_messages(conversation_id, limit=self.max_turns * 2)
        return [{"role": m["role"], "content": m["content"]} for m in messages]

    def add_user_message(self, content: str, conversation_id: Optional[str] = None) -> str:
        if not conversation_id:
            convs = db.list_conversations()
            if convs:
                conversation_id = convs[0]["id"]
            else:
                new_c = db.create_conversation("New Chat")
                conversation_id = new_c["id"]
        db.add_message(conversation_id, "user", content)
        return conversation_id

    def add_assistant_message(self, content: str, conversation_id: Optional[str] = None, metadata: Optional[Dict[str, Any]] = None):
        if not conversation_id:
            convs = db.list_conversations()
            if convs:
                conversation_id = convs[0]["id"]
            else:
                new_c = db.create_conversation("New Chat")
                conversation_id = new_c["id"]
        db.add_message(conversation_id, "assistant", content, metadata=metadata)

    def clear(self, conversation_id: Optional[str] = None):
        if conversation_id:
            db.delete_conversation(conversation_id)

# Global singleton
session_conversation = ConversationManager()
