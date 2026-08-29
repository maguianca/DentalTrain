# Chestionar de validare medicală — primă variantă (de corectat)

> Apare imediat după terminarea fiecărui caz (după ce diagnosticul corect a fost
> dezvăluit). Scop: a valida dacă AI-ul livrează **consistent** informații
> **corecte medical** despre boala pacientului.
>
> Reguli de design:
> - Întrebări scurte, cu răspuns clar (numeric / Da-Nu) → ușor de comparat între medici.
> - Un singur câmp de text liber la final (pentru context), opțional.
> - Se completează de 28 ori/medic (14 cazuri × 2 runde) → trebuie să rămână scurt.
>
> Date salvate automat (NU se întreabă): medicul, boala/diagnosticul, runda,
> sesiunea, ce a diagnosticat medicul, dacă a fost corect, data/ora.

---

**Scala folosită pentru întrebările 1–4 și 7:**
1 = Dezacord total · 2 = Dezacord · 3 = Neutru · 4 = Acord · 5 = Acord total

---

### 1. Realismul prezentării
*Simptomele și istoricul relatate de pacientul AI au fost realiste din punct de vedere medical pentru diagnosticul [DIAGNOSTIC].*
→ 1 – 5

### 2. Acuratețea tabloului clinic
*Tabloul clinic (simptomele prezente ȘI cele absente) a fost corect și complet pentru acest diagnostic.*
→ 1 – 5

### 3. Consistența AI-ului
*Răspunsurile pacientului AI au fost consecvente pe tot parcursul conversației (fără informații contradictorii sau care se schimbă).*
→ 1 – 5

### 4. Testele clinice
*Rezultatele testelor clinice folosite (percuție, termic, examinare, radiografie) au fost în concordanță cu acest diagnostic.*
→ 1 – 5  ·  sau „N/A – nu am folosit teste"

### 5. Corectitudinea diagnosticului ⭐ (cheie)
*Diagnosticul pe care sistemul l-a considerat „corect" a fost cel potrivit pentru această prezentare.*
→ Da  ·  Parțial  ·  Nu

### 6. Informații greșite / periculoase ⭐ (siguranță)
*AI-ul a furnizat vreo informație incorectă medical, înșelătoare sau imposibilă?*
→ Nu  ·  Da
*(dacă „Da": descrieți pe scurt ce anume)* → [text]

### 7. Validitate generală
*În ansamblu, acest caz este valid medical și potrivit pentru instruire/evaluare.*
→ 1 – 5

### 8. Observații (opțional)
*Alte observații despre acest caz (ce ar trebui corectat/îmbunătățit)?*
→ [text liber]

---

## De decis (de către tine)
- [ ] Limba chestionarului în aplicație: **română** sau **engleză** (aplicația e momentan în engleză)?
- [ ] Vrei să adaug/scot vreo întrebare?
- [ ] Întrebările 5 și 6 sunt cele mai importante pentru validare — sunt formulate bine?
- [ ] E ok lungimea (7 + 1), sau o vrei și mai scurtă?
