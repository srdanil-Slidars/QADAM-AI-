"""Configure the official Gemini API without exposing the key in shell history."""
import argparse
import getpass
import json
import os
from pathlib import Path
import tempfile
import warnings
from qadam.llm import generate, AIUnavailable

ROOT=Path(__file__).resolve().parent
DEFAULT_MODEL='gemini-3.1-flash-lite'


def verify(cfg):
    # Synthetic smoke test only: never send student records during setup.
    return generate([{'role':'user','content':'Return exactly this JSON object: {"reply":"Connection OK","actions":[]}'}],cfg)


def main():
    parser=argparse.ArgumentParser(description='Qadam AI: configure Gemini or check the existing connection')
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    filename=ROOT/'instance'/'ai.json'
    if args.check:
        if not filename.exists():raise SystemExit('No configuration. Run: python configure_ai.py')
        cfg=json.loads(filename.read_text(encoding='utf-8'))
        key=os.environ.get('GEMINI_API_KEY') or cfg.get('api_key','')
        model=cfg.get('model',DEFAULT_MODEL)
    else:
        print('Official Google Gemini API. The key is hidden and is not sent to GitHub.')
        print('Only a synthetic connection test will be sent to Google.')
        with warnings.catch_warnings():
            warnings.simplefilter('error',getpass.GetPassWarning)
            try:key=getpass.getpass('Gemini API key (input hidden): ').strip()
            except getpass.GetPassWarning:raise SystemExit('Hidden input is unavailable. Run this command in a Bash console.')
        if not key:raise SystemExit('No key entered. Nothing changed.')
        model=input(f'Model [Enter = {DEFAULT_MODEL}]: ').strip() or DEFAULT_MODEL
    cfg={'provider':'gemini','key':key,'model':model,'url':'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'}
    try:verify(cfg)
    except AIUnavailable as error:raise SystemExit('Connection failed; settings were not changed. '+str(error))
    if not args.check:
        filename.parent.mkdir(exist_ok=True)
        handle,name=tempfile.mkstemp(prefix='ai-',suffix='.json',dir=filename.parent)
        try:
            with os.fdopen(handle,'w',encoding='utf-8') as f:json.dump({'provider':'gemini','model':model,'api_key':key},f)
            os.replace(name,filename)
            os.chmod(filename,0o600)
        finally:
            if Path(name).exists():Path(name).unlink()
    print('Connection OK. In PythonAnywhere Web click Reload, then enable cloud consent in the chat.')


if __name__=='__main__':main()
