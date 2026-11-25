"""Train a small neural topic classifier on explicitly synthetic examples."""
import json
import random
import time
from pathlib import Path
from qadam.neural import features,forward

def train():
    start=time.monotonic()
    rng=random.Random(2026)
    source=Path(__file__).parent/'data/topic-examples.json'
    dataset=json.loads(source.read_text(encoding='utf-8'))
    labels=list(dataset['examples'])
    size,hidden=512,24
    model={'features':size,'hidden':hidden,'labels':labels,
           'w1':[[rng.gauss(0,.08) for _ in range(hidden)] for _ in range(size)],
           'w2':[[rng.gauss(0,.08) for _ in labels] for _ in range(hidden)],
           'b1':[0.0]*hidden,'b2':[0.0]*len(labels)}
    training,validation=[],[]
    for k,label in enumerate(labels):
        texts=list(dataset['examples'][label]);rng.shuffle(texts)
        validation.extend((features(t,size),k,t) for t in texts[:4])
        training.extend((features(t,size),k) for t in texts[4:])
    for epoch in range(140):
        rng.shuffle(training)
        rate=.12/(1+epoch/140)
        for values,target in training:
            h,p=forward(model,values)
            delta=[prob-(k==target) for k,prob in enumerate(p)]
            dh=[(1-h[j]*h[j])*sum(delta[k]*model['w2'][j][k] for k in range(len(labels))) for j in range(hidden)]
            for j in range(hidden):
                for k in range(len(labels)):
                    model['w2'][j][k]-=rate*(h[j]*delta[k]+.0001*model['w2'][j][k])
                model['b1'][j]-=rate*dh[j]
            for i,x in values.items():
                for j in range(hidden):model['w1'][i][j]-=rate*x*dh[j]
            for k in range(len(labels)):model['b2'][k]-=rate*delta[k]
    correct=0
    results=[]
    for values,target,text in validation:
        _,p=forward(model,values);prediction=max(range(len(p)),key=p.__getitem__)
        correct+=prediction==target
        results.append({'text':text,'expected':labels[target],'predicted':labels[prediction]})
    report={'training_examples':len(training),'validation_examples':len(validation),
            'validation_correct':correct,'validation_accuracy':correct/len(validation),
            'provenance':dataset['provenance'],'seed':2026,'epochs':140,
            'limits':'Small synthetic validation split. Not clinical validation or a measure of real-world safety.',
            'results':results}
    model['training']={k:v for k,v in report.items() if k!='results'}
    folder=Path(__file__).parent/'models';folder.mkdir(exist_ok=True)
    (folder/'topic-model.json').write_text(json.dumps(model,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    (folder/'training-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Trained {len(training)} synthetic examples, validation {correct}/{len(validation)}, {time.monotonic()-start:.1f}s')

if __name__=='__main__':train()
