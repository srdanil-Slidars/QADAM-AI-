"""Small trainable neural topic router. It is not a language model or diagnosis."""
from collections import Counter
from functools import lru_cache
import hashlib
import json
import math
from pathlib import Path
import re

MODEL_PATH=Path(__file__).resolve().parent.parent/'models'/'topic-model.json'

def features(text, size=512):
    words=re.findall(r'[а-яёa-z0-9]+',text.lower().replace('ё','е'))[:120]
    counts=Counter()
    for word in words:
        for token in ['w:'+word]+['c:'+word[i:i+3] for i in range(max(1,len(word)-2))]:
            index=int.from_bytes(hashlib.blake2s(token.encode(),digest_size=4).digest(),'little')%size
            counts[index]+=1
    norm=math.sqrt(sum(v*v for v in counts.values())) or 1
    return {i:v/norm for i,v in counts.items()}

def forward(model, values):
    hidden=[math.tanh(model['b1'][j]+sum(model['w1'][i][j]*x for i,x in values.items())) for j in range(model['hidden'])]
    logits=[model['b2'][k]+sum(hidden[j]*model['w2'][j][k] for j in range(model['hidden'])) for k in range(len(model['labels']))]
    maximum=max(logits)
    exp=[math.exp(v-maximum) for v in logits]
    total=sum(exp)
    return hidden,[v/total for v in exp]

@lru_cache(maxsize=1)
def load_model():
    return json.loads(MODEL_PATH.read_text(encoding='utf-8'))

def classify(text):
    model=load_model()
    _, probabilities=forward(model,features(text,model['features']))
    index=max(range(len(probabilities)),key=probabilities.__getitem__)
    return {'topic':model['labels'][index],'score':round(probabilities[index],3)}
