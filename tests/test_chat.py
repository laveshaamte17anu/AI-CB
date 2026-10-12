import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.utils import clean_thinking_text
from backend.ollama_client import build_chat_messages

def test_clean_thinking_text():
    raw_response = "<think>Calculating the answer to 2+2...</think>The answer is 4."
    cleaned = clean_thinking_text(raw_response)
    assert cleaned == "The answer is 4."

def test_clean_thinking_text_multiline():
    raw_response = "<think>\nStep 1: Think\nStep 2: Reason\n</think>\nHello there!"
    cleaned = clean_thinking_text(raw_response)
    assert cleaned == "Hello there!"

def test_build_chat_messages():
    history = [
        {"role": "user", "content": "What is Python?"},
        {"role": "assistant", "content": "Python is a programming language."}
    ]
    prompt = "Who created it?"
    messages = build_chat_messages(prompt, history)
    assert messages[0]["role"] == "system"
    assert messages[1]["role"] == "user"
    assert messages[1]["content"] == "What is Python?"
    assert messages[2]["role"] == "assistant"
    assert messages[3]["role"] == "user"
    assert messages[3]["content"] == "Who created it?"

def test_build_chat_messages_modes():
    # Coding mode
    code_msgs = build_chat_messages("Write a binary search in Python", mode="code")
    assert "Coding Assistant" in code_msgs[0]["content"]

    # Doc mode with context
    doc_msgs = build_chat_messages(
        "What is the policy?",
        mode="doc",
        doc_context="[Source: policy.pdf, Page 1]: All employees must register."
    )
    assert "Document Analysis Assistant" in doc_msgs[0]["content"]
    assert "policy.pdf" in doc_msgs[0]["content"]

def test_build_chat_messages_with_memories():
    import backend.database as db
    mem = db.add_memory("Prefers concise bullet-point answers", category="preference")
    try:
        msgs = build_chat_messages("Explain Git branches", mode="chat", include_memories=True)
        assert "Prefers concise bullet-point answers" in msgs[0]["content"]
    finally:
        db.delete_memory(mem["id"])

