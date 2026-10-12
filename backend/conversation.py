from typing import List, Dict

class ConversationManager:
    """Manages session conversation history."""
    def __init__(self, max_turns: int = 10):
        self.history: List[Dict[str, str]] = []
        self.max_turns = max_turns

    def add_user_message(self, content: str):
        self.history.append({"role": "user", "content": content.strip()})
        self._truncate()

    def add_assistant_message(self, content: str):
        self.history.append({"role": "assistant", "content": content.strip()})
        self._truncate()

    def get_history(self) -> List[Dict[str, str]]:
        return self.history

    def set_history(self, history: List[Dict[str, str]]):
        self.history = [m for m in history if isinstance(m, dict) and "role" in m and "content" in m]
        self._truncate()

    def clear(self):
        self.history = []

    def _truncate(self):
        if len(self.history) > self.max_turns * 2:
            self.history = self.history[-(self.max_turns * 2):]

# Global session instance
session_conversation = ConversationManager()
