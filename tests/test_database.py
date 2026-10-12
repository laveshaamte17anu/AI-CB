import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import backend.database as db

def test_conversations_crud():
    # 1. Create
    conv = db.create_conversation("PyTest Conversation", mode="code")
    assert conv["id"] is not None
    assert conv["title"] == "PyTest Conversation"
    assert conv["mode"] == "code"
    
    # 2. Get
    fetched = db.get_conversation(conv["id"])
    assert fetched is not None
    assert fetched["title"] == "PyTest Conversation"
    
    # 3. Rename
    renamed = db.rename_conversation(conv["id"], "Renamed Conversation")
    assert renamed is True
    assert db.get_conversation(conv["id"])["title"] == "Renamed Conversation"
    
    # 4. Search
    results = db.list_conversations(search_query="Renamed")
    assert any(c["id"] == conv["id"] for c in results)
    
    # 5. Add messages
    m1 = db.add_message(conv["id"], "user", "Hello PyTest")
    m2 = db.add_message(conv["id"], "assistant", "Hello from Assistant", metadata={"sources": [{"page": 1}]})
    assert m1["role"] == "user"
    assert m2["role"] == "assistant"
    assert m2["metadata"]["sources"][0]["page"] == 1
    
    messages = db.get_messages(conv["id"])
    assert len(messages) == 2
    assert messages[0]["content"] == "Hello PyTest"
    assert messages[1]["content"] == "Hello from Assistant"
    
    # 6. Delete
    deleted = db.delete_conversation(conv["id"])
    assert deleted is True
    assert db.get_conversation(conv["id"]) is None

def test_memories_crud():
    # 1. Add
    mem = db.add_memory("Prefers Python over C++", category="preference")
    assert mem["id"] is not None
    assert mem["content"] == "Prefers Python over C++"
    assert mem["is_active"] == 1
    
    # 2. List
    mems = db.list_memories(active_only=True)
    assert any(m["id"] == mem["id"] for m in mems)
    
    # 3. Toggle inactive
    updated = db.update_memory(mem["id"], is_active=0)
    assert updated is True
    assert db.list_memories(active_only=True)
    assert not any(m["id"] == mem["id"] for m in db.list_memories(active_only=True))
    
    # 4. Delete
    deleted = db.delete_memory(mem["id"])
    assert deleted is True
