"""One command starts the local language model and the Flask application."""
from app import app
from qadam.local_runtime import run_with_model

if __name__=='__main__':run_with_model(app)
