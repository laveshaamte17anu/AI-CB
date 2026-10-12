import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# pyrefly: ignore [missing-import]
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_conversations_api():
    # 1. Create conversation
    create_res = client.post("/api/conversations", json={"title": "API Test", "mode": "chat"})
    assert create_res.status_code == 200
    conv_id = create_res.json()["id"]

    # 2. Get list
    list_res = client.get("/api/conversations")
    assert list_res.status_code == 200
    assert any(c["id"] == conv_id for c in list_res.json())

    # 3. Rename
    rename_res = client.patch(f"/api/conversations/{conv_id}", json={"title": "Updated API Title"})
    assert rename_res.status_code == 200

    # 4. Delete
    del_res = client.delete(f"/api/conversations/{conv_id}")
    assert del_res.status_code == 200

def test_memories_api():
    # 1. Create memory
    res = client.post("/api/memories", json={"content": "Prefers dark mode UI", "category": "preference"})
    assert res.status_code == 200
    mem_id = res.json()["id"]

    # 2. List memories
    list_res = client.get("/api/memories")
    assert list_res.status_code == 200
    assert any(m["id"] == mem_id for m in list_res.json())

    # 3. Update memory
    up_res = client.patch(f"/api/memories/{mem_id}", json={"is_active": 0})
    assert up_res.status_code == 200

    # 4. Delete memory
    del_res = client.delete(f"/api/memories/{mem_id}")
    assert del_res.status_code == 200

def test_chat_validation():
    # Empty message rejection
    res = client.post("/api/chat", json={"message": "   "})
    assert res.status_code == 400

def test_model_select():
    res = client.post("/api/model/select", json={"model": "qwen2.5:1.5b"})
    assert res.status_code == 200
    assert res.json()["model"] == "qwen2.5:1.5b"

def test_conversation_not_found():
    res = client.get("/api/conversations/non-existent-conv-id-999")
    assert res.status_code == 404

    res_del = client.delete("/api/conversations/non-existent-conv-id-999")
    assert res_del.status_code == 404

def test_memory_not_found():
    res_up = client.patch("/api/memories/non-existent-mem-id-999", json={"is_active": 0})
    assert res_up.status_code == 404

    res_del = client.delete("/api/memories/non-existent-mem-id-999")
    assert res_del.status_code == 404

def test_document_upload_and_delete_api():
    import io
    txt_content = b"Local AI assistant document grounding test content."
    file_payload = {"file": ("test_doc.txt", io.BytesIO(txt_content), "text/plain")}

    upload_res = client.post("/api/documents/upload", files=file_payload)
    assert upload_res.status_code == 200
    doc_data = upload_res.json()["document"]
    doc_id = doc_data["id"]
    assert doc_data["filename"] == "test_doc.txt"

    # List documents
    list_res = client.get("/api/documents")
    assert list_res.status_code == 200
    assert any(d["id"] == doc_id for d in list_res.json())

    # Delete document
    del_res = client.delete(f"/api/documents/{doc_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

def test_chat_streaming_api_mock(monkeypatch):
    # Mock Ollama health and stream generator
    monkeypatch.setattr("backend.main.check_ollama_health", lambda: True)
    monkeypatch.setattr(
        "backend.main.generate_response_stream",
        lambda **kwargs: iter(["Hello", " from", " stream!"])
    )

    res = client.post("/api/chat/stream", json={"message": "Stream test prompt", "mode": "chat"})
    assert res.status_code == 200
    assert "text/event-stream" in res.headers["content-type"]
    body = res.text
    assert '"event": "start"' in body
    assert '"event": "chunk"' in body
    assert '"event": "done"' in body
