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
    IonToast, IonLoading, IonItemDivider,
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
    helpCircleOutline,
} from 'ionicons/icons';
import { getDiagnosisOptions } from '../services/BadgeService';
import { API_BASE_URL } from '../config';
import GuidedTour, { TourStep } from '../components/GuidedTour';
import ValidationQuestionnaire, { ValidationAnswers } from '../components/ValidationQuestionnaire';

// Steps of the tutorial shown inside a case / conversation.
const CHAT_TOUR_STEPS: TourStep[] = [
    {
        selector: '[data-tour="chat-input"]',
        title: 'Start the conversation',
        description:
            "The patient will greet you first. Continue the consultation by asking about their symptoms.",
    },
    {
        selector: '[data-tour="tool-examine"]',
        title: 'Examine',
        description: 'Perform a visual clinical examination of the patient. Opens a clinical image.',
    },
    {
        selector: '[data-tour="tool-percussion"]',
        title: 'Percussion Test',
        description: "Tap to perform a percussion test and read the patient's response.",
    },
    {
        selector: '[data-tour="tool-thermal"]',
        title: 'Thermal Test',
        description: 'Run a thermal (cold/hot) sensitivity test to gather diagnostic clues.',
    },
    {
        selector: '[data-tour="tool-xray"]',
        title: 'X-Ray',
        description: "View the patient's radiograph to support your diagnosis.",
    },
    {
        selector: '[data-tour="submit-diagnosis"]',
        title: 'Submit Diagnosis',
        description:
            'When you\'re confident, tap here to submit your final diagnosis. The list is divided into two groups: Endodontic and Non-Endodontic. Pick the single option that best matches the case.',
    },
    {
        selector: '[data-tour="case-timer"]',
        title: 'Timer',
        description: 'Tracks how long your consultation takes, so you can work efficiently.',
    },
];

// Note: whether the user has seen the tutorial is stored on their account
// (Firestore field `has_seen_chat_tutorial`), checked via /auth/tutorial-status.
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

const DiagnosisPage: React.FC<{ tourPreview?: boolean }> = ({ tourPreview }) => {
    const history = useHistory();
    const { caseId } = useParams<RouteParams>();
    const contentRef = useRef<HTMLIonContentElement>(null);

    // === ONBOARDING TUTORIAL ===
    // Tutorial state.
    const [showTour, setShowTour] = useState(false);

    useEffect(() => {
        // In preview mode we always show the tour straight away.
        if (tourPreview) {
            setShowTour(true);
            return;
        }
        // Otherwise ask the backend whether this account has seen the chat tutorial.
        let cancelled = false;
        const checkStatus = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;
                const res = await fetch(`${API_BASE_URL}/auth/tutorial-status`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                });
                if (!res.ok) return;
                const data = await res.json();
                if (!cancelled && data.chat === false) {
                    setShowTour(true);
                }
            } catch (err) {
                console.error('Failed to check tutorial status:', err);
            }
        };
        checkStatus();
        return () => { cancelled = true; };
    }, [tourPreview]);

    // Persist on the account that the chat tutorial has been seen.
    const markChatTutorialSeen = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            await fetch(`${API_BASE_URL}/auth/tutorial-seen`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ which: 'chat' }),
            });
        } catch (err) {
            console.error('Failed to mark chat tutorial as seen:', err);
        }
    };

    const closeTour = () => {
        setShowTour(false);
        if (tourPreview) return; // nothing to persist in preview mode
        markChatTutorialSeen();
    };
    // === END ONBOARDING TUTORIAL ===

    // === VALIDATION MODE ===
    // Validator doctors get a questionnaire after each case. Their accounts have
    // role === 'validator' (stored locally after login). Others keep the normal flow.
    const isValidator = (() => {
        try {
            return JSON.parse(localStorage.getItem('user') || '{}').role === 'validator';
        } catch {
            return false;
        }
    })();
    const [showQuestionnaire, setShowQuestionnaire] = useState(false);
    const [showRealDiagnosis, setShowRealDiagnosis] = useState(false);

    // Round/case progress saved when the case was started (see HomeTab).
    const validationProgress = (() => {
        try {
            return JSON.parse(localStorage.getItem('validation_progress') || 'null');
        } catch {
            return null;
        }
    })();

    const handleSubmitFeedback = async (answers: ValidationAnswers) => {
        try {
            const token = localStorage.getItem('token');
            const submitted = diagnosisOptions.find((d) => d.id === selectedDiagnosisId)?.name;
            await fetch(`${API_BASE_URL}/chat/validation-feedback`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    session_id: caseId,
                    submitted_diagnosis: submitted,
                    ...answers,
                }),
            });
        } catch (e) {
            console.error('Failed to save validation feedback:', e);
        } finally {
            setShowQuestionnaire(false);
            handleNextCase();
        }
    };
    // === END VALIDATION MODE ===
    const [timeRemaining, setTimeRemaining] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [showPauseAlert, setShowPauseAlert] = useState(false);

    const [messages, setMessages] = useState<Message[]>([]);
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

    const [pendingDiagnosisResult, setPendingDiagnosisResult] = useState<any>(null);

    useEffect(() => {
        contentRef.current?.scrollToBottom(300);
    }, [messages, isAITyping]);

    useEffect(() => {
        if (!caseId) return;
        const token = localStorage.getItem('token');
        if (!token) return;
        setIsAITyping(true);
        fetch(`${API_BASE_URL}/chat/greeting`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ session_id: caseId }),
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.reply) {
                    setMessages([{
                        id: 'greeting',
                        type: 'patient',
                        content: data.reply,
                        timestamp: new Date(),
                    }]);
                }
            })
            .catch(() => {})
            .finally(() => setIsAITyping(false));
    }, [caseId]);

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

            setDiagnosisResult(resultData);
            setShowResultModal(true);

        } catch (e: unknown) {
            console.error(e);
            setError("Failed to submit diagnosis");
        } finally {
            setIsSubmittingDiagnosis(false);
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

    const [isLoadingNext, setIsLoadingNext] = useState(false);
    const handleNextCase = async () => {
        setIsLoadingNext(true);
        setShowRealDiagnosis(false);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/chat/start/random`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to start case');
            if (data.round != null) {
                localStorage.setItem('validation_progress', JSON.stringify({
                    round: data.round,
                    case_number: data.case_number,
                    total: data.total_cases,
                    disease_name: data.disease_name
                }));
            } else {
                localStorage.removeItem('validation_progress');
            }
            history.replace(`/diagnosis/${data.session_id}`);
        } catch (e) {
            setError('Failed to start next case. Please try from Home.');
            setIsLoadingNext(false);
        }
    };

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
                        <div data-tour="case-timer" className={`flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100`}>
                            <IonIcon icon={time} className={"text-emerald-600"} />
                            <span className="font-mono font-bold text-lg">{formatTime(timeRemaining)}</span>
                        </div>
                    </div>

                    <IonButtons slot="end">
                        <IonButton onClick={() => setShowTour(true)} color="medium" aria-label="Show tutorial">
                            <IonIcon icon={helpCircleOutline} slot="icon-only" />
                        </IonButton>
                        <IonButton data-tour="submit-diagnosis" onClick={() => setShowDiagnosisModal(true)}>
                            <IonChip className="diagnosis-submit-chip">
                                <IonIcon icon={clipboard} className="mr-1" />
                                Submit
                            </IonChip>
                        </IonButton>
                    </IonButtons>
                </IonToolbar>

                <div className="clinician-toolbar bg-gray-50 border-b border-gray-200">
                    <div className="flex items-center justify-around py-2 px-4">
                        <button data-tour="tool-examine" onClick={() => handleToolAction('examine')} className="flex flex-col items-center gap-1 p-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center"><IonIcon icon={search} className="text-blue-600" /></div>
                            <span className="text-[10px] text-gray-600">Examine</span>
                        </button>
                        <button data-tour="tool-percussion" onClick={() => handleToolAction('percussion')} className="flex flex-col items-center gap-1 p-2">
                            <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center"><IonIcon icon={pulse} className="text-orange-600" /></div>
                            <span className="text-[10px] text-gray-600">Percussion Test</span>
                        </button>
                        <button data-tour="tool-thermal" onClick={() => handleToolAction('thermal')} className="flex flex-col items-center gap-1 p-2">
                            <div className="w-8 h-8 bg-cyan-100 rounded-lg flex items-center justify-center"><IonIcon icon={eyedrop} className="text-cyan-600" /></div>
                            <span className="text-[10px] text-gray-600">Thermal Test</span>
                        </button>
                        <button data-tour="tool-xray" onClick={() => handleToolAction('xray')} className="flex flex-col items-center gap-1 p-2">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center"><IonIcon icon={medkit} className="text-purple-600" /></div>
                            <span className="text-[10px] text-gray-600">X-Ray</span>
                        </button>
                    </div>
                </div>
            </IonHeader>

            <IonContent ref={contentRef} className="chat-content">
                {/* === VALIDATION MODE === round/case progress banner (validators only) */}
                {isValidator && validationProgress && (
                    <div className="flex flex-col items-center justify-center text-xs font-semibold text-indigo-700 py-1.5 bg-indigo-50 border-b border-indigo-100 relative">
                        <div>Round {validationProgress.round} · Case {validationProgress.case_number}/{validationProgress.total}</div>
                        {validationProgress.disease_name && (
                            <div className="mt-1">
                                {showRealDiagnosis ? (
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">Diagnosticul Real: {validationProgress.disease_name}</span>
                                        <button onClick={() => setShowRealDiagnosis(false)} className="text-gray-500 underline text-[10px]">Ascunde</button>
                                    </div>
                                ) : (
                                    <button onClick={() => setShowRealDiagnosis(true)} className="text-indigo-500 underline text-[10px]">
                                        Afișează Diagnosticul Real
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
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
                    <div data-tour="chat-input" className="flex-1 bg-gray-100 rounded-2xl px-4 py-2">
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
                                <IonItemDivider className="font-bold text-sm uppercase tracking-wide">
                                    <IonLabel>Endodontic</IonLabel>
                                </IonItemDivider>
                                {diagnosisOptions.filter(o => o.category !== 'Non-endodontic').map((option) => (
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

                                <IonItemDivider className="font-bold text-sm uppercase tracking-wide mt-2">
                                    <IonLabel>Non-Endodontic</IonLabel>
                                </IonItemDivider>
                                {diagnosisOptions.filter(o => o.category === 'Non-endodontic').map((option) => (
                                    <IonItem
                                        key={option.id}
                                        button={true}
                                        detail={false}
                                        onClick={() => setSelectedDiagnosisId(option.id)}
                                        className="diagnosis-option"
                                    >
                                        <IonLabel>
                                            <h3 className="font-bold">{option.name}</h3>
                                            <p className="text-xs text-indigo-600 font-medium">{option.referral}</p>
                                        </IonLabel>
                                        <IonRadio slot="end" value={option.id} />
                                    </IonItem>
                                ))}
                            </IonList>
                        </IonRadioGroup>
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

                                {isValidator ? (
                                    <IonButton
                                        expand="block"
                                        className="dentsim-primary-button"
                                        onClick={() => {
                                            setShowResultModal(false);
                                            setShowQuestionnaire(true);
                                        }}
                                    >
                                        Continuă la chestionar
                                    </IonButton>
                                ) : (
                                    <>
                                        <IonButton
                                            expand="block"
                                            className="dentsim-primary-button mb-3"
                                            onClick={handleNextCase}
                                            disabled={isLoadingNext}
                                        >
                                            {isLoadingNext ? 'Loading...' : 'Next Case'}
                                        </IonButton>
                                        <IonButton
                                            expand="block"
                                            fill="outline"
                                            onClick={handleExit}
                                        >
                                            Return to Home
                                        </IonButton>
                                    </>
                                )}
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

            {/* Tutorial */}
            <GuidedTour steps={CHAT_TOUR_STEPS} isOpen={showTour} onClose={closeTour} />

            {/* === VALIDATION MODE === questionnaire shown after the case (validators only) */}
            <ValidationQuestionnaire
                isOpen={showQuestionnaire}
                diagnosisName={diagnosisResult?.correctDiagnosis || diagnosisOptions.find((d) => d.id === selectedDiagnosisId)?.name}
                onSubmit={handleSubmitFeedback}
            />
        </IonPage>
    );
};

export default DiagnosisPage;


