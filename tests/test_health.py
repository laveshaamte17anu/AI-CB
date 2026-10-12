import sys
import os

# Add project root directory to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "ollama" in data

def test_model_endpoint():
    response = client.get("/api/model")
    assert response.status_code == 200
    data = response.json()
    assert "model" in data
    assert "ollama_running" in data
    assert "model_available" in data
