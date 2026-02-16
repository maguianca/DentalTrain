// typescript
// File: app/DentalSimFrontend/src/pages/DiagnosisPage.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import {
    IonPage,
    IonHeader,
    IonToolbar,
    IonContent,
    IonFooter,
    IonButton,
    IonIcon,
    IonTextarea,
    IonModal,
    IonList,
    IonItem,
    IonLabel,
    IonRadio,
    IonRadioGroup,
    IonButtons,
    IonChip,
    IonAlert,
    IonSpinner,
    IonToast, IonLoading,
} from '@ionic/react';
import {
    arrowBack,
    send,
    medkit,
    time,
    clipboard,
    search,
    pulse,
    eyedrop,
    checkmarkCircle,
    closeCircle,
} from 'ionicons/icons';
import { getDiagnosisOptions } from '../services/BadgeService';
import { API_BASE_URL } from '../config';
interface Message {
    id: string;
    type: 'patient' | 'student' | 'system';
    content: string;
    timestamp: Date;
}

interface RouteParams {
    caseId?: string;
}

const INACTIVITY_THRESHOLD = 120;

const DiagnosisPage: React.FC = () => {
    const history = useHistory();
    const { caseId } = useParams<RouteParams>();
    const contentRef = useRef<HTMLIonContentElement>(null);
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [showPauseAlert, setShowPauseAlert] = useState(false);

    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'init-1',
            type: 'system',
            content: 'Patient has entered the office. Review the case file and begin.',
            timestamp: new Date(),
        },
    ]);
    const [inputText, setInputText] = useState('');
    const [isAITyping, setIsAITyping] = useState(false);
    const [error, setError] = useState('');

    const [showDiagnosisModal, setShowDiagnosisModal] = useState(false);
    const [selectedDiagnosisId, setSelectedDiagnosisId] = useState<string>('');
    const [showConfirmAlert, setShowConfirmAlert] = useState(false);
    const [showExitAlert, setShowExitAlert] = useState(false);
    const [showResultModal, setShowResultModal] = useState(false);
    const [isSubmittingDiagnosis, setIsSubmittingDiagnosis] = useState(false);

    const [diagnosisResult, setDiagnosisResult] = useState<{
        correct: boolean;
        xpEarned: number;
        feedback: string;
        correctDiagnosis?: string;
    } | null>(null);

    const diagnosisOptions = getDiagnosisOptions();

    const [showImageModal, setShowImageModal] = useState(false);
    const [currentImageUrl, setCurrentImageUrl] = useState('');
    const [currentImageTitle, setCurrentImageTitle] = useState('');
    const [isTesting, setIsTesting] = useState(false); // To show a spinner while fetching test results

    // for treatment plan modal
    const [showTreatmentModal, setShowTreatmentModal] = useState(false);
    const [treatmentPlan, setTreatmentPlan] = useState('');
    const [pendingDiagnosisResult, setPendingDiagnosisResult] = useState<any>(null);
    const [isSubmittingTreatment, setIsSubmittingTreatment] = useState(false);

    useEffect(() => {
        contentRef.current?.scrollToBottom(300);
    }, [messages, isAITyping]);

    const inactivityTimerRef = useRef<number | null>(null);
    const resetInactivityTimer = useCallback(() => {
        if (inactivityTimerRef.current) {
            window.clearTimeout(inactivityTimerRef.current);
        }
        inactivityTimerRef.current = window.setTimeout(() => {
            setIsPaused(true);
            setShowPauseAlert(true);
        }, INACTIVITY_THRESHOLD * 1000);
    }, []);

    useEffect(() => {
        resetInactivityTimer();
        const events = ['mousemove', 'keydown', 'touchstart'];
        const onActivity = () => {
            if (isPaused) return;
            resetInactivityTimer();
        };
        events.forEach((ev) => window.addEventListener(ev, onActivity));
        return () => {
            events.forEach((ev) => window.removeEventListener(ev, onActivity));
            if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
        };
    }, [resetInactivityTimer, isPaused]);


    useEffect(() => {
        const timerId = window.setInterval(() => {
            setTimeRemaining((prev) => (isPaused ? prev : prev + 1));
        }, 1000);
        return () => window.clearInterval(timerId);
    }, [isPaused]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSendMessage = async () => {
        if (!inputText.trim() || isAITyping) return;

        const userMsgText = inputText.trim();

        const newMessage: Message = {
            id: Date.now().toString(),
            type: 'student',
            content: userMsgText,
            timestamp: new Date(),
        };

        setMessages((prev) => [...prev, newMessage]);
        setInputText('');
        setIsAITyping(true);

        try {
            const token = localStorage.getItem('token');
            if (!token || !caseId) throw new Error("Session invalid");

            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    session_id: caseId,
                    message: userMsgText
                })
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error || 'Failed to send');

            const aiMessage: Message = {
                id: (Date.now() + 1).toString(),
                type: 'patient',
                content: data.reply,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, aiMessage]);

        } catch (e: unknown) {
            console.error(e);
            setError("Could not reach the patient (AI Error)");
        } finally {
            setIsAITyping(false);
        }
    };

    const confirmDiagnosis = async () => {
        setIsSubmittingDiagnosis(true);

        try {
            const selectedOption = diagnosisOptions.find(d => d.id === selectedDiagnosisId);
            if (!selectedOption) return;

            const token = localStorage.getItem('token');

            const response = await fetch(`${API_BASE_URL}/chat/diagnose`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    session_id: caseId,
                    diagnosis: selectedOption.name
                })
            });

            const data = await response.json();

            const resultData = {
                correct: data.correct,
                xpEarned: data.xp_gained,
                feedback: data.message,
                correctDiagnosis: data.correct_diagnosis
            };

            if (data.correct) {
                // --- NEW LOGIC: Stop! Ask for treatment first. ---
                setPendingDiagnosisResult(resultData); // Save the XP/Win data for later
                setShowTreatmentModal(true);           // Open the text input
            } else {
                // --- OLD LOGIC: Wrong answer, show failure immediately ---
                setDiagnosisResult(resultData);
                setShowResultModal(true);
            }

        } catch (e: unknown) {
            console.error(e);
            setError("Failed to submit diagnosis");
        } finally {
            setIsSubmittingDiagnosis(false);
        }
    };

    const submitTreatmentPlan = async () => {
        if (!treatmentPlan.trim()) {
            setError("Please enter a treatment plan.");
            return;
        }

        setIsSubmittingTreatment(true);

        try {
            const token = localStorage.getItem('token');

            // Send the plan to your backend
            await fetch(`${API_BASE_URL}/chat/submit-treatment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    session_id: caseId,
                    treatment_text: treatmentPlan
                })
            });

            // NOW show the final success screen
            setDiagnosisResult(pendingDiagnosisResult); // Restore the XP/Success data
            setShowTreatmentModal(false);               // Close input
            setShowResultModal(true);                   // Show the confetti/XP modal

        } catch (e) {
            console.error(e);
            setError("Failed to save treatment plan.");
        } finally {
            setIsSubmittingTreatment(false);
        }
    };

    const handleToolAction = async (tool: string) => {
        if (isPaused || isTesting) return;
        setIsTesting(true);

        try {
            const token = localStorage.getItem('token');
            if (!token || !caseId) throw new Error("Session invalid");

            // 1. Fetch the data from your new endpoint
            const response = await fetch(`${API_BASE_URL}/chat/clinical-test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    session_id: caseId,
                    test_type: tool
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to perform test');
            }

            // 2. Handle "No Data" gracefully (The "Nice Error")
            if (!data.content || data.content === "") {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    type: 'system',
                    content: `[${tool.toUpperCase()}] No specific findings or data available for this case.`,
                    timestamp: new Date(),
                }]);
                return;
            }

            // 3. Handle Images (X-Ray / Examine)
            if (data.type === 'image') {
                const secureImageUrl = `${API_BASE_URL}/chat/media/${caseId}/${tool}?t=${Date.now()}`;
                setCurrentImageUrl(secureImageUrl);
                setCurrentImageTitle(tool === 'xray' ? 'Radiograph' : 'Clinical Examination');
                setShowImageModal(true);

                // Optional: Log that they looked at it in chat
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    type: 'system',
                    content: `[${tool.toUpperCase()}] Image viewed by student.`,
                    timestamp: new Date(),
                }]);
            }

            // 4. Handle Text Results (Percussion / Thermal)
            else if (data.type === 'text') {
                const toolNames: Record<string, string> = {
                    percussion: 'Percussion Test',
                    thermal: 'Thermal Test'
                };

                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    type: 'system',
                    content: `[${toolNames[tool] || tool}] ${data.content}`,
                    timestamp: new Date(),
                }]);
            }

        } catch (e) {
            console.error(e);
            // Fallback error in chat
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                type: 'system',
                content: `Error performing ${tool}: Connection failed.`,
                timestamp: new Date(),
            }]);
        } finally {
            setIsTesting(false);
        }
    };

    const handleExit = () => history.replace('/tabs/home');

    return (
        <IonPage className="diagnosis-page">
            <IonHeader className="ion-no-border" translucent={false}>
                <IonToolbar className="diagnosis-toolbar">
                    <IonButtons slot="start">
                        <IonButton onClick={() => setShowExitAlert(true)} color="medium">
                            <IonIcon icon={arrowBack} slot="icon-only" />
                        </IonButton>
                    </IonButtons>

                    <div className="flex items-center justify-center">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100`}>
                            <IonIcon icon={time} className={"text-emerald-600"} />
                            <span className="font-mono font-bold text-lg">{formatTime(timeRemaining)}</span>
                        </div>
                    </div>

                    <IonButtons slot="end">
                        <IonButton onClick={() => setShowDiagnosisModal(true)}>
                            <IonChip className="diagnosis-submit-chip">
                                <IonIcon icon={clipboard} className="mr-1" />
                                Submit
                            </IonChip>
                        </IonButton>
                    </IonButtons>
                </IonToolbar>

                <div className="clinician-toolbar bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center justify-around py-2 px-4">
                        <button onClick={() => handleToolAction('examine')} className="flex flex-col items-center gap-1 p-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center"><IonIcon icon={search} className="text-blue-600" /></div>
                            <span className="text-[10px] text-gray-600">Examine</span>
                        </button>
                        <button onClick={() => handleToolAction('percussion')} className="flex flex-col items-center gap-1 p-2">
                            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center"><IonIcon icon={pulse} className="text-orange-600" /></div>
                            <span className="text-[10px] text-gray-600">Percussion Test</span>
                        </button>
                        <button onClick={() => handleToolAction('thermal')} className="flex flex-col items-center gap-1 p-2">
                            <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center"><IonIcon icon={eyedrop} className="text-cyan-600" /></div>
                            <span className="text-[10px] text-gray-600">Thermal Test</span>
                        </button>
                        <button onClick={() => handleToolAction('xray')} className="flex flex-col items-center gap-1 p-2">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center"><IonIcon icon={medkit} className="text-purple-600" /></div>
                            <span className="text-[10px] text-gray-600">X-Ray</span>
                        </button>
                    </div>
                </div>
            </IonHeader>

            <IonContent ref={contentRef} className="chat-content">
                <div className="flex flex-col p-4 gap-3">
                    {messages.map((message) => (
                        <div key={message.id} className={`flex ${message.type === 'student' ? 'justify-end' : message.type === 'system' ? 'justify-center' : 'justify-start'}`}>
                            {message.type === 'system' ? (
                                <div className="bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full text-center max-w-[90%]">
                                    {message.content}
                                </div>
                            ) : (
                                <div className={`max-w-[80%] ${message.type === 'student' ? 'chat-bubble-student' : 'chat-bubble-patient'}`}>
                                    {message.type === 'patient' && (
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-bold text-blue-600">Patient</span>
                                        </div>
                                    )}
                                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                                </div>
                            )}
                        </div>
                    ))}
                    {isAITyping && (
                        <div className="flex justify-start">
                            <div className="chat-bubble-patient">
                                <div className="typing-indicator"><span></span><span></span><span></span></div>
                            </div>
                        </div>
                    )}
                </div>
            </IonContent>

            <IonFooter className="chat-footer ion-no-border" translucent={false}>
                <div className="flex items-end gap-2 p-3 pb-safe bg-white border-t border-gray-100">
                    <div className="flex-1 bg-gray-100 rounded-2xl px-4 py-2">
                        <IonTextarea
                            value={inputText}
                            placeholder="Ask a question..."
                            autoGrow
                            rows={1}
                            enterkeyhint="send"
                            onIonInput={(e) => setInputText(e.detail.value || '')}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                            className="chat-input"
                        />
                    </div>
                    <IonButton
                        className="send-button"
                        onClick={handleSendMessage}
                        disabled={!inputText.trim() || isAITyping || isPaused}
                    >
                        <IonIcon icon={send} slot="icon-only" />
                    </IonButton>
                </div>
            </IonFooter>

            <IonModal isOpen={showDiagnosisModal} onDidDismiss={() => setShowDiagnosisModal(false)} className="diagnosis-modal">
                <IonHeader>
                    <IonToolbar>
                        <IonButtons slot="start"><IonButton onClick={() => setShowDiagnosisModal(false)}>Cancel</IonButton></IonButtons>
                        <IonButtons slot="end">
                            <IonButton strong onClick={() => { setShowDiagnosisModal(false); setShowConfirmAlert(true); }} disabled={!selectedDiagnosisId}>
                                Next
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent>
                    <div className="p-4">
                        <h2 className="text-xl font-bold mb-4">Select Diagnosis</h2>
                        <IonRadioGroup value={selectedDiagnosisId} onIonChange={(e) => setSelectedDiagnosisId(e.detail.value)}>
                            <IonList>
                                {diagnosisOptions.map((option) => (
                                    <IonItem
                                        key={option.id}
                                        button={true}
                                        detail={false}
                                        onClick={() => setSelectedDiagnosisId(option.id)}
                                        className="diagnosis-option"
                                    >
                                        <IonLabel>
                                            <h3 className="font-bold">{option.name}</h3>
                                            <p className="text-xs text-gray-500">{option.description}</p>
                                        </IonLabel>
                                        <IonRadio slot="end" value={option.id} />
                                    </IonItem>
                                ))}
                            </IonList>
                        </IonRadioGroup>
                    </div>
                </IonContent>
            </IonModal>
            {/* TREATMENT PLAN INPUT MODAL */}
            <IonModal
                isOpen={showTreatmentModal}
                className="diagnosis-modal"
                backdropDismiss={false}
            >
                <IonHeader>
                    <IonToolbar>
                        <IonButtons slot="start">
                            {/* Optional: Allow them to cancel back to diagnosis if needed */}
                            <IonButton onClick={() => setShowTreatmentModal(false)}>Back</IonButton>
                        </IonButtons>
                        <IonLabel className="text-center font-bold">Treatment Plan</IonLabel>
                        <IonButtons slot="end">
                            <IonButton strong onClick={submitTreatmentPlan} disabled={isSubmittingTreatment}>
                                {isSubmittingTreatment ? 'Saving...' : 'Finish'}
                            </IonButton>
                        </IonButtons>
                    </IonToolbar>
                </IonHeader>
                <IonContent className="ion-padding">
                    <div className="flex flex-col h-full">
                        <div className="bg-green-50 p-4 rounded-lg mb-4 text-green-800 border border-green-200 flex items-center gap-3">
                            <IonIcon icon={checkmarkCircle} className="text-2xl" />
                            <div>
                                <h3 className="font-bold">Correct Diagnosis!</h3>
                                <p className="text-sm mt-1">
                                    Great job identifying the issue. Now, please prescribe the treatment plan.
                                </p>
                            </div>
                        </div>

                        <IonLabel className="font-bold text-gray-700 mb-2 block">
                            Proposed Treatment Schema
                        </IonLabel>
                        <IonTextarea
                            rows={10}
                            placeholder="Describe the clinical procedure, medication, and follow-up..."
                            value={treatmentPlan}
                            onIonInput={e => setTreatmentPlan(e.detail.value!)}
                            className="border border-gray-300 rounded-md p-2 flex-grow bg-white"
                        />
                    </div>
                </IonContent>
            </IonModal>
            <IonAlert
                isOpen={showConfirmAlert}
                onDidDismiss={() => setShowConfirmAlert(false)}
                header="Finalize Diagnosis"
                message="Are you sure? You cannot change this later."
                buttons={[
                    { text: 'Cancel', role: 'cancel' },
                    { text: 'Submit', handler: confirmDiagnosis }
                ]}
            />

            <IonAlert
                isOpen={showExitAlert}
                onDidDismiss={() => setShowExitAlert(false)}
                header="Exit Session?"
                message="If you leave now, you won't get any XP, but your accuracy score won't be affected."
                buttons={[
                    { text: 'Stay', role: 'cancel' },
                    { text: 'Leave', role: 'destructive', handler: handleExit },
                ]}
            />

            {/* Pause alert for inactivity */}
            <IonAlert
                isOpen={showPauseAlert}
                onDidDismiss={() => setShowPauseAlert(false)}
                header="Session Paused due to inactivity"
                message="Session Paused due to inactivity. Do you want to continue?"
                buttons={[
                    {
                        text: 'Resume Case',
                        handler: () => {
                            setIsPaused(false);
                            resetInactivityTimer();
                        }
                    },
                    {
                        text: 'Submit Diagnosis Now',
                        handler: () => {
                            setShowPauseAlert(false);
                            setIsPaused(false);
                            setShowDiagnosisModal(true);
                        }
                    }
                ]}
            />

            <IonModal isOpen={showResultModal} backdropDismiss={false} className="result-modal">
                <IonContent>
                    <div className="flex flex-col items-center justify-center min-h-full p-6 text-center">
                        {isSubmittingDiagnosis ? (
                            <IonSpinner name="crescent" />
                        ) : (
                            <>
                                <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 ${diagnosisResult?.correct ? 'bg-green-100 text-green-500' : 'bg-red-100 text-red-500'}`}>
                                    <IonIcon icon={diagnosisResult?.correct ? checkmarkCircle : closeCircle} className="text-6xl" />
                                </div>

                                <h2 className="text-2xl font-bold mb-2">{diagnosisResult?.correct ? 'Correct Diagnosis!' : 'Incorrect'}</h2>

                                {!diagnosisResult?.correct && (
                                    <p className="text-gray-500 mb-4">Correct was: <span className="font-bold">{diagnosisResult?.correctDiagnosis}</span></p>
                                )}

                                <div className="bg-yellow-50 px-6 py-3 rounded-xl mb-6 border border-yellow-100">
                                    <span className="text-yellow-700 font-bold text-xl">+{diagnosisResult?.xpEarned} XP</span>
                                </div>

                                <p className="text-sm text-gray-600 mb-8 leading-relaxed">{diagnosisResult?.feedback}</p>

                                <IonButton expand="block" onClick={handleExit} className="dentsim-primary-button">
                                    Return to Home
                                </IonButton>
                            </>
                        )}
                    </div>
                </IonContent>
            </IonModal>

            {/* 1. Loading Spinner (Shows while fetching data/image) */}
            <IonLoading
                isOpen={isTesting}
                message={'Performing clinical test...'}
                spinner="crescent"
            />

            {/* 2. Image Viewer Modal (Pops up for X-Ray or Examine) */}
            <IonModal
                isOpen={showImageModal}
                onDidDismiss={() => setShowImageModal(false)}
                className="image-viewer-modal"
            >
                <IonHeader>
                    <IonToolbar color="dark">
                        <IonButtons slot="start">
                            <IonButton onClick={() => setShowImageModal(false)}>
                                <IonIcon icon={closeCircle} slot="start" />
                                Close
                            </IonButton>
                        </IonButtons>
                        <IonLabel className="font-bold text-center">
                            {currentImageTitle}
                        </IonLabel>
                    </IonToolbar>
                </IonHeader>

                <IonContent className="ion-padding" color="dark">
                    <div className="flex items-center justify-center h-full w-full bg-black">
                        {/* Display the image if we have a URL.
                           We use a standard <img> tag for better control over sizing
                           than the default IonImg.
                        */}
                        {currentImageUrl ? (
                            <img
                                src={currentImageUrl}
                                alt="Clinical Finding"
                                style={{
                                    maxHeight: '85vh',
                                    maxWidth: '100%',
                                    objectFit: 'contain'
                                }}
                            />
                        ) : (
                            <div className="text-center text-white p-4">
                                <p>Image failed to load.</p>
                            </div>
                        )}
                    </div>
                </IonContent>
            </IonModal>

            <IonToast isOpen={!!error} onDidDismiss={() => setError('')} message={error} duration={3000} color="danger" />
        </IonPage>
    );
};

export default DiagnosisPage;


