import subprocess
import secrets
import time
from pathlib import Path
from urllib.request import urlopen
from .llm import config

ROOT=Path(__file__).resolve().parent.parent

def ready():
    try:
        with urlopen('http://127.0.0.1:8081/health',timeout=2) as r:return r.status==200
    except Exception:return False

def run_with_model(app):
    child=None;log=None
    with app.app_context():cfg=config()
    try:
        if cfg['provider']=='local' and not ready():
            exe=ROOT/'.local-ai/runtime/llama-server.exe'
            model=ROOT/'.local-ai/Qwen3-4B-Q4_K_M.gguf'
            if not exe.exists() or not model.exists():raise RuntimeError('Run python setup_local_ai.py first')
            log=(ROOT/'.local-ai/server.log').open('a',encoding='utf-8')
            keyfile=ROOT/'instance'/'local-ai.key'
            keyfile.parent.mkdir(exist_ok=True)
            if not keyfile.exists():keyfile.write_text(secrets.token_urlsafe(32))
            command=[str(exe),'-m',str(model),'--alias','qwen3-4b','--host','127.0.0.1','--port','8081','--api-key-file',str(keyfile),'-c','8192','-ngl','99','-np','1','--reasoning','off','--jinja']
            child=subprocess.Popen(command,cwd=str(exe.parent),stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            print('Loading Qwen3. First start may take a minute...',flush=True)
            for _ in range(90):
                if ready():break
                if child.poll() is not None:raise RuntimeError('Model server stopped. See .local-ai/server.log')
                time.sleep(1)
            else:raise RuntimeError('Model did not start. See .local-ai/server.log')
            print('Qwen3 ready. Qadam: http://127.0.0.1:5000',flush=True)
        app.run(host='127.0.0.1',port=5000,debug=False)
    finally:
        if child is not None:
            child.terminate()
            try:child.wait(timeout=10)
            except subprocess.TimeoutExpired:child.kill()
        if log:log.close()
