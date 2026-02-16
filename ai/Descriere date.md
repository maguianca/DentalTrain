## Descriere scurta EDA a datelor
30 de conversatii, fiecare a cate 15-20 de replici,
"assistant"- pacientul/chatul
"system"-prompt ul sistemului
"user"- viitorul doctor care incearca sa diagnosticheze boala

Scripturile sunt facut cu ajutorul cu Flash 2.5 si GPT 5
pe baza simpromelor din endodontic_codbook.xlsx

Se antreneaza un model TinyLLama de la hugging face 
cu 1.1 B parametrii, 3 milioane de tokeni. A fost antrenat si pe limba romana ceea ce il face un potential model pentru aplicatie, mai ales luand in considerare dimensiunea mica a modelului, fiind accesibil pe multe dispozitive.

Phi-3-mini, un model open-source de la Microsoft, cu aproximativ 3,8 miliarde de parametri, optimizat pentru raționament și conversație.
A fost ales datorită performanței sale ridicate în task-uri logice și conversaționale, a suportului parțial pentru limba română și a eficienței în rularea pe hardware modest.

## Descriere algoritm inteligent

Tehnica de antrenare: QLoRA (LoRA peste greutăți cuantizate 4-bit), adică:

Greutățile modelului sunt încărcate în 4-bit (NF4) → consum mic de VRAM.

Se adaugă adaptoare LoRA pe proiecțiile de atenție (q_proj, k_proj, v_proj, o_proj).

Se antrenează doar adaptoarele (câteva milioane de parametri), restul modelului rămâne înghețat.

Motivație:

Set mic de date + GPU modest ➝ QLoRA oferă cost redus, stabilitate și timp scurt.

TinyLlama-Chat are deja comportament conversațional; noi îl specializăm pe simptomatologia stomatologică.

Modelul Phi-3-mini a fost selectat pentru că oferă un echilibru între dimensiune și capacitate conversațională, fiind deja optimizat pentru dialoguri instructive.
Scopul fine-tuning-ului a fost adaptarea comportamentului conversațional la simptomatologia stomatologică și simularea realistă a unui pacient virtual.
Tehnica QLoRA a fost folosită pentru a reduce semnificativ cerințele de VRAM, antrenând doar adaptoarele LoRA peste greutăți cuantizate 4-bit (NF4).

Librării:

* transformers (model, tokenizer, chat template),

* bitsandbytes (quantizare 4-bit),

* peft (LoRA/QLoRA),

* trl (SFTTrainer – Supervised Fine-Tuning),

* datasets (gestionare date).

## Descriere metodologie experimentala si rezultate obtinute

### Hiperparametri 

Quantizare: 4-bit NF4, bnb_4bit_use_double_quant=True.

LoRA: r=8, alpha=16, target_modules=["q_proj","k_proj","v_proj","o_proj"], dropout=0.05.

Secvență: max_seq_length=1024 (ajustează la p95 lungimi; dacă OOM → 768/512).

Optimizare: optim="paged_adamw_32bit", lr=2e-4.

Batch: per_device_train_batch_size=1, gradient_accumulation_steps=8 (batch efectiv ≈8).

Precizie: fp16=True (bf16 dacă GPU suportă).

Epoci: 1–3 (începe cu max_steps=300 pentru smoke test).

Altele: gradient_checkpointing_enable=True, use_cache=False.


## Antrenament 
S-a antrenat pe tot setul de date 30 de conversatii.
Testarea s-a realizat pe o conversatie scurta pe una dintre cele 3 boli, pe Pulpita Ireversibila.

Pentru Phi-3-mini testarea s-a realizat, dar modelul este incoerent.

In limba romana este incapabil de a vorbi corect gramatical.
```
Tu ești un pacient care are o problemă dentară. Nu spui diagnosticul. 
<|user|>
Ce vă supără cel mai mult? 
<|assistant|>
Am băut un foarte bun de ceptăti, am încercat să ne supără, dar am făcut un test. E către ulcere.
```
In limba engleza, modelul nu halucineaza, este mai aproape de realitate.
```
Patient: My daughter noticed that her tooth on the left side is turning gray. It hasn't been hurting before and it came out yesterday. We didn't have any pain, but it's there.
Doctor: does the pain appear at night?
Patient: No, the pain was only in the daytime. It felt stronger when I tried to sleep last night.
```
Metrici pentru evaluare:
* Hallucination Rate
* Relevance Score
* Consistency Rate  
S-ar putea folosi pe viitor si un BLEUScore
