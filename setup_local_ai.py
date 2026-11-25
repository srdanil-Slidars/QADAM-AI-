"""Download official, checksum-verified Qwen3 + llama.cpp into this project."""
import hashlib
from pathlib import Path
import sys
from urllib.request import Request, urlopen
import zipfile

ROOT=Path(__file__).resolve().parent
DEST=ROOT/'.local-ai'
FILES=[
 ('https://github.com/ggml-org/llama.cpp/releases/download/b12359/llama-b12359-bin-win-vulkan-x64.zip','runtime.zip','e8d18c6e4210cca87e7307c2ea78363ac8d158e4e1397358ec96ab70b53a0d5e'),
 ('https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf','Qwen3-4B-Q4_K_M.gguf','7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5')
]

def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        while chunk:=f.read(8*1024*1024):h.update(chunk)
    return h.hexdigest()

def install():
    DEST.mkdir(exist_ok=True)
    for url,name,expected in FILES:
        target=DEST/name
        if target.exists() and digest(target)==expected:
            print('Verified existing',name,flush=True);continue
        partial=target.with_suffix(target.suffix+'.partial')
        count=0
        print('Downloading',name,flush=True)
        with urlopen(Request(url,headers={'User-Agent':'Qadam-AI-setup'}),timeout=60) as source, partial.open('wb') as output:
            while chunk:=source.read(1024*1024):
                output.write(chunk);count+=len(chunk)
                if count//(128*1024*1024)!=(count-len(chunk))//(128*1024*1024):print(f'{name}: {count//(1024*1024)} MiB',flush=True)
        if digest(partial)!=expected:raise RuntimeError('Checksum mismatch: '+name)
        partial.replace(target)
        print('Verified',name,flush=True)
    runtime=DEST/'runtime';runtime.mkdir(exist_ok=True)
    with zipfile.ZipFile(DEST/'runtime.zip') as z:
        for member in z.infolist():
            target=(runtime/member.filename).resolve()
            if not target.is_relative_to(runtime.resolve()):raise RuntimeError('Unsafe archive path')
        z.extractall(runtime)
    print('Local AI installed. Run: python run_local.py',flush=True)

if __name__=='__main__':install()
