import sqlite3
import os
import json
import uuid
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any
from pathlib import Path

# Database file location
DATA_DIR = Path(__file__).resolve().parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "assistant.db"

def get_db_connection() -> sqlite3.Connection:
    """Creates a thread-safe connection to the local SQLite database."""
    conn = sqlite3.connect(str(DB_PATH), timeout=20.0)
    conn.row_factory = sqlite3.Row
    # Enable Write-Ahead Logging for better concurrent read/write performance
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    """Initializes tables and indexes if they do not exist."""
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        # 1. Conversations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                mode TEXT NOT NULL DEFAULT 'chat',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)
        
        # 2. Messages table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
            );
        """)
        
        # 3. User Memories & Preferences table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                key TEXT,
                content TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'fact',
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        """)
        
        # 4. Uploaded Documents table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                conversation_id TEXT,
                filename TEXT NOT NULL,
                stored_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                file_type TEXT NOT NULL,
                page_count INTEGER NOT NULL DEFAULT 1,
                summary TEXT,
                created_at TEXT NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
            );
        """)
        
        # 5. Document text chunks for Q&A
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS document_chunks (
                id TEXT PRIMARY KEY,
                document_id TEXT NOT NULL,
                chunk_index INTEGER NOT NULL,
                page_number INTEGER NOT NULL DEFAULT 1,
                content TEXT NOT NULL,
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
            );
        """)

        # Indexes for fast querying
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_doc_chunks_doc ON document_chunks(document_id);")
        conn.commit()

# --- CONVERSATION CRUD ---

def create_conversation(title: str = "New Conversation", mode: str = "chat") -> Dict[str, Any]:
    conv_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        conn.execute(
            "INSERT INTO conversations (id, title, mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (conv_id, title.strip(), mode, now, now)
        )
        conn.commit()
    return {
        "id": conv_id,
        "title": title.strip(),
        "mode": mode,
        "created_at": now,
        "updated_at": now
    }

def list_conversations(search_query: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        if search_query and search_query.strip():
            pattern = f"%{search_query.strip()}%"
            # Search both title and message contents
            query = """
                SELECT DISTINCT c.id, c.title, c.mode, c.created_at, c.updated_at
                FROM conversations c
                LEFT JOIN messages m ON c.id = m.conversation_id
                WHERE c.title LIKE ? OR m.content LIKE ?
                ORDER BY c.updated_at DESC
            """
            rows = conn.execute(query, (pattern, pattern)).fetchall()
        else:
            query = "SELECT id, title, mode, created_at, updated_at FROM conversations ORDER BY updated_at DESC"
            rows = conn.execute(query).fetchall()
        
        result = []
        for r in rows:
            # Fetch last message preview
            last_msg = conn.execute(
                "SELECT content, role FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1",
                (r["id"],)
            ).fetchone()
            preview = last_msg["content"][:100] if last_msg else ""
            result.append({
                "id": r["id"],
                "title": r["title"],
                "mode": r["mode"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
                "preview": preview
            })
        return result

def get_conversation(conv_id: str) -> Optional[Dict[str, Any]]:
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT id, title, mode, created_at, updated_at FROM conversations WHERE id = ?",
            (conv_id,)
        ).fetchone()
        if not row:
            return None
        return dict(row)

def rename_conversation(conv_id: str, new_title: str) -> bool:
    now = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        res = conn.execute(
            "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?",
            (new_title.strip(), now, conv_id)
        )
        conn.commit()
        return res.rowcount > 0

def touch_conversation(conv_id: str):
    now = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conv_id))
        conn.commit()

def delete_conversation(conv_id: str) -> bool:
    with get_db_connection() as conn:
        res = conn.execute("DELETE FROM conversations WHERE id = ?", (conv_id,))
        conn.commit()
        return res.rowcount > 0

# --- MESSAGES CRUD ---

def add_message(
    conversation_id: str,
    role: str,
    content: str,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    msg_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    meta_json = json.dumps(metadata) if metadata else None
    
    with get_db_connection() as conn:
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (msg_id, conversation_id, role, content.strip(), meta_json, now)
        )
        # Update conversation updated_at
        conn.execute("UPDATE conversations SET updated_at = ? WHERE id = ?", (now, conversation_id))
        conn.commit()
        
    return {
        "id": msg_id,
        "conversation_id": conversation_id,
        "role": role,
        "content": content.strip(),
        "metadata": metadata or {},
        "created_at": now
    }

def get_messages(conversation_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT id, conversation_id, role, content, metadata, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?",
            (conversation_id, limit)
        ).fetchall()
        
        messages = []
        for r in rows:
            meta = {}
            if r["metadata"]:
                try:
                    meta = json.loads(r["metadata"])
                except Exception:
                    meta = {}
            messages.append({
                "id": r["id"],
                "conversation_id": r["conversation_id"],
                "role": r["role"],
                "content": r["content"],
                "metadata": meta,
                "created_at": r["created_at"]
            })
        return messages

# --- MEMORIES CRUD ---

def list_memories(active_only: bool = False) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        query = "SELECT id, key, content, category, is_active, created_at, updated_at FROM memories"
        if active_only:
            query += " WHERE is_active = 1"
        query += " ORDER BY updated_at DESC"
        rows = conn.execute(query).fetchall()
        return [dict(r) for r in rows]

def add_memory(content: str, category: str = "fact", key: Optional[str] = None) -> Dict[str, Any]:
    mem_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        conn.execute(
            "INSERT INTO memories (id, key, content, category, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)",
            (mem_id, key, content.strip(), category, now, now)
        )
        conn.commit()
    return {
        "id": mem_id,
        "key": key,
        "content": content.strip(),
        "category": category,
        "is_active": 1,
        "created_at": now,
        "updated_at": now
    }

def update_memory(mem_id: str, content: Optional[str] = None, is_active: Optional[int] = None) -> bool:
    now = datetime.now(timezone.utc).isoformat()
    fields = ["updated_at = ?"]
    params = [now]
    if content is not None:
        fields.append("content = ?")
        params.append(content.strip())
    if is_active is not None:
        fields.append("is_active = ?")
        params.append(is_active)
    params.append(mem_id)
    
    with get_db_connection() as conn:
        res = conn.execute(f"UPDATE memories SET {', '.join(fields)} WHERE id = ?", params)
        conn.commit()
        return res.rowcount > 0

def delete_memory(mem_id: str) -> bool:
    with get_db_connection() as conn:
        res = conn.execute("DELETE FROM memories WHERE id = ?", (mem_id,))
        conn.commit()
        return res.rowcount > 0

def clear_memories() -> int:
    with get_db_connection() as conn:
        res = conn.execute("DELETE FROM memories")
        conn.commit()
        return res.rowcount

# --- DOCUMENTS CRUD ---

def save_document(
    filename: str,
    stored_path: str,
    file_size: int,
    file_type: str,
    page_count: int,
    conversation_id: Optional[str] = None,
    summary: Optional[str] = None,
    chunks: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    doc_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with get_db_connection() as conn:
        conn.execute(
            """INSERT INTO documents 
               (id, conversation_id, filename, stored_path, file_size, file_type, page_count, summary, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (doc_id, conversation_id, filename, stored_path, file_size, file_type, page_count, summary, now)
        )
        if chunks:
            for idx, ch in enumerate(chunks):
                chunk_id = str(uuid.uuid4())
                conn.execute(
                    """INSERT INTO document_chunks (id, document_id, chunk_index, page_number, content)
                       VALUES (?, ?, ?, ?, ?)""",
                    (chunk_id, doc_id, idx, ch.get("page_number", 1), ch.get("content", ""))
                )
        conn.commit()
    return {
        "id": doc_id,
        "filename": filename,
        "file_size": file_size,
        "file_type": file_type,
        "page_count": page_count,
        "summary": summary,
        "created_at": now
    }

def list_documents(conversation_id: Optional[str] = None) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        if conversation_id:
            query = "SELECT * FROM documents WHERE conversation_id = ? ORDER BY created_at DESC"
            rows = conn.execute(query, (conversation_id,)).fetchall()
        else:
            query = "SELECT * FROM documents ORDER BY created_at DESC"
            rows = conn.execute(query).fetchall()
        return [dict(r) for r in rows]

def get_document_chunks(document_id: str) -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        rows = conn.execute(
            "SELECT chunk_index, page_number, content FROM document_chunks WHERE document_id = ? ORDER BY chunk_index ASC",
            (document_id,)
        ).fetchall()
        return [dict(r) for r in rows]

def search_document_chunks(query_terms: List[str], conversation_id: Optional[str] = None, limit: int = 5) -> List[Dict[str, Any]]:
    """Searches document chunks for matching terms to provide grounded context."""
    if not query_terms:
        return []
    with get_db_connection() as conn:
        # Build query for relevant chunks
        base_query = """
            SELECT dc.chunk_index, dc.page_number, dc.content, d.filename, d.id as document_id
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
        """
        params = []
        conditions = []
        if conversation_id:
            conditions.append("d.conversation_id = ?")
            params.append(conversation_id)
            
        term_conditions = []
        for term in query_terms[:8]:
            if len(term) > 2:
                term_conditions.append("dc.content LIKE ?")
                params.append(f"%{term}%")
                
        if term_conditions:
            conditions.append(f"({' OR '.join(term_conditions)})")
            
        if conditions:
            base_query += " WHERE " + " AND ".join(conditions)
            
        base_query += f" LIMIT {limit}"
        rows = conn.execute(base_query, params).fetchall()
        return [dict(r) for r in rows]

def delete_document(doc_id: str) -> bool:
    with get_db_connection() as conn:
        doc = conn.execute("SELECT stored_path FROM documents WHERE id = ?", (doc_id,)).fetchone()
        if doc and doc["stored_path"] and os.path.exists(doc["stored_path"]):
            try:
                os.remove(doc["stored_path"])
            except Exception:
                pass
        res = conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        conn.commit()
        return res.rowcount > 0

# Initialize schema on module import
init_db()
