// === VALIDATION MODE ===
// Questionnaire shown to validator doctors right after they finish a case.
// Questions are in Romanian (the app UI stays English). See CHESTIONAR_VALIDARE.md.
import React, { useState } from 'react';
import {
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButton,
    IonTextarea,
    IonToast,
} from '@ionic/react';

export interface ValidationAnswers {
    q1_targeted_answers: number | null;
    q2_realistic_conversation: number | null;
    q3_no_contradictions: number | null;
    q4_complementary_exams: number | null;
    q5_valid_for_training: number | null;
    q6_comment: string;
}

interface Props {
    isOpen: boolean;
    diagnosisName?: string;
    onSubmit: (answers: ValidationAnswers) => void;
    /** In preview mode the modal cannot be dismissed by submitting to a backend. */
    previewMode?: boolean;
}

const LikertRow: React.FC<{
    value: number | null;
    onChange: (v: number) => void;
}> = ({ value, onChange }) => (
    <div className="flex flex-wrap items-center gap-2 mt-2">
        {[1, 2, 3, 4, 5].map((n) => (
            <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`w-10 h-10 rounded-full font-bold border transition-colors ${
                    value === n
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-300'
                }`}
            >
                {n}
            </button>
        ))}
    </div>
);

const ValidationQuestionnaire: React.FC<Props> = ({ isOpen, diagnosisName, onSubmit, previewMode }) => {
    const [q1, setQ1] = useState<number | null>(null);
    const [q2, setQ2] = useState<number | null>(null);
    const [q3, setQ3] = useState<number | null>(null);
    const [q4, setQ4] = useState<number | null>(null);
    const [q5, setQ5] = useState<number | null>(null);
    const [q6, setQ6] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (q1 === null || q2 === null || q3 === null || q4 === null || q5 === null) {
            setError('Te rugăm să răspunzi la toate întrebările (1–5).');
            return;
        }
        onSubmit({
            q1_targeted_answers: q1,
            q2_realistic_conversation: q2,
            q3_no_contradictions: q3,
            q4_complementary_exams: q4,
            q5_valid_for_training: q5,
            q6_comment: q6,
        });
    };

    const diag = diagnosisName ? ` „${diagnosisName}"` : '';

    return (
        <IonModal isOpen={isOpen} backdropDismiss={false}>
            <IonHeader>
                <IonToolbar>
                    <IonTitle>Chestionar de validare</IonTitle>
                </IonToolbar>
            </IonHeader>
            <IonContent className="ion-padding">
                <p className="text-sm text-gray-500 mb-1">
                    Evaluează cazul{diag} pe care tocmai l-ai parcurs.
                </p>
                <p className="text-xs text-gray-400 mb-5">
                    Scala 1–5: 1 = Dezacord total · 3 = Neutru · 5 = Acord total
                </p>

                <div className="mb-6">
                    <p className="font-semibold text-gray-800">
                        1. Pacientul a răspuns clar și concis la întrebările adresate.
                    </p>
                    <LikertRow value={q1} onChange={setQ1} />
                </div>

                <div className="mb-6">
                    <p className="font-semibold text-gray-800">
                        2. Conversația a simulat în mod realist interacțiunea dintre medic și pacient.
                    </p>
                    <LikertRow value={q2} onChange={setQ2} />
                </div>

                <div className="mb-6">
                    <p className="font-semibold text-gray-800">
                        3. Răspunsurile pacientului au fost consistente pe tot parcursul conversației, fără contradicții.
                    </p>
                    <LikertRow value={q3} onChange={setQ3} />
                </div>

                <div className="mb-6">
                    <p className="font-semibold text-gray-800">
                        4. Examinările complementare efectuate (percuție, termic, radiografie) au contribuit la orientarea diagnosticului.
                    </p>
                    <LikertRow value={q4} onChange={setQ4} />
                </div>

                <div className="mb-6">
                    <p className="font-semibold text-gray-800">
                        5. Cazul este valid din punct de vedere medical și adecvat pentru instruirea studenților stomatologi.
                    </p>
                    <LikertRow value={q5} onChange={setQ5} />
                </div>

                <div className="mb-8">
                    <p className="font-semibold text-gray-800">
                        6. Observații punctuale pentru acest caz (dacă considerați necesar):
                    </p>
                    <IonTextarea
                        className="border border-gray-300 rounded-md p-2 mt-2 bg-white"
                        placeholder="Scrieți aici observațiile dvs. (opțional)..."
                        value={q6}
                        autoGrow
                        onIonInput={(e) => setQ6(e.detail.value || '')}
                    />
                </div>

                <IonButton expand="block" onClick={handleSubmit} className="mb-6">
                    {previewMode ? 'Trimite (previzualizare)' : 'Trimite și termină'}
                </IonButton>
            </IonContent>

            <IonToast
                isOpen={!!error}
                onDidDismiss={() => setError('')}
                message={error}
                duration={2500}
                color="warning"
                position="top"
            />
        </IonModal>
    );
};

export default ValidationQuestionnaire;
