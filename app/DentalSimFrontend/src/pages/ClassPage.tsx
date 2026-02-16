import React, { useState } from 'react';
import {
    IonPage,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonButton,
    IonIcon,
    IonSpinner,
    IonToast,
    useIonViewWillEnter,
    IonItem,
    IonInput,
} from '@ionic/react';
import { useHistory, useParams } from 'react-router-dom';
import { people, bookOutline } from 'ionicons/icons';
import { API_BASE_URL } from '../config';

interface RouteParams {
    classId: string;
}

interface Classroom {
    id: string;
    name: string;
    university?: string;
    course_category?: string;
    join_code?: string;
    role_in_class?: string;
}

interface Assignment {
    id: string;
    title: string;
    description?: string;
    required_sessions: number;
    allowed_names: string[];
    start_at?: string;
    due_at?: string;
}

interface LeaderboardEntry {
    user_id: string;
    username: string;
    xp: number;
    streak: number;
    level: number;
    rank: number;
    role_in_class?: string;
}

interface AssignmentProgressEntry {
    user_id: string;
    username: string;
    completed_sessions: number;
    correct_sessions: number;
    required_sessions: number;
    is_completed: boolean;
    avg_time_seconds: number;
}

const ClassPage: React.FC = () => {
    const { classId } = useParams<RouteParams>();
    const history = useHistory();

    const [classInfo, setClassInfo] = useState<Classroom | null>(null);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [progress, setProgress] = useState<AssignmentProgressEntry[] | null>(null);

    const [selectedSegment, setSelectedSegment] =
        useState<'assignments' | 'leaderboard' | 'report'>('assignments');
    const [selectedAssignmentForReport, setSelectedAssignmentForReport] =
        useState<Assignment | null>(null);

    const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
    const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
    const [isLoadingReport, setIsLoadingReport] = useState(false);
    const [isLoadingCase, setIsLoadingCase] = useState(false);

    const [error, setError] = useState('');
    const [infoMessage, setInfoMessage] = useState('');

    // --- user global profile (ca să știm dacă e Professor) ---
    const [userInfo, setUserInfo] = useState<any>(null);

    // --- Create assignment state ---
    const [createTitle, setCreateTitle] = useState('');
    const [createDescription, setCreateDescription] = useState('');
    const [createRequiredSessions, setCreateRequiredSessions] = useState('5');
    const [createAllowedNamesText, setCreateAllowedNamesText] = useState('');
    const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);

    useIonViewWillEnter(() => {
        fetchUserProfile();
        fetchClassroomsAndSelect();
        fetchAssignments();
        fetchLeaderboard();
    });

    const fetchUserProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_BASE_URL}/auth/profile`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setUserInfo(data);
            }
        } catch (err) {
            console.error('Failed to fetch user profile in ClassPage:', err);
        }
    };

    const fetchClassroomsAndSelect = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_BASE_URL}/classroom/my`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data: Classroom[] = await response.json();
                const found = data.find((c) => c.id === classId);
                if (found) {
                    setClassInfo(found);
                } else {
                    setError('You are not a member of this class.');
                }
            }
        } catch (err) {
            console.error('Failed to fetch classrooms for class page:', err);
        }
    };

    const fetchAssignments = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            setIsLoadingAssignments(true);
            const response = await fetch(
                `${API_BASE_URL}/classroom/${classId}/assignments`,
                {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            );

            if (response.ok) {
                const data: Assignment[] = await response.json();
                setAssignments(data || []);
            } else {
                setError('Failed to load assignments.');
            }
        } catch (err) {
            console.error('Failed to fetch assignments:', err);
            setError('Failed to load assignments.');
        } finally {
            setIsLoadingAssignments(false);
        }
    };

    const fetchLeaderboard = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            setIsLoadingLeaderboard(true);
            const response = await fetch(
                `${API_BASE_URL}/classroom/${classId}/leaderboard`,
                {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            );

            if (response.ok) {
                const data: LeaderboardEntry[] = await response.json();
                setLeaderboard(data || []);
            } else {
                setError('Failed to load leaderboard.');
            }
        } catch (err) {
            console.error('Failed to fetch leaderboard:', err);
            setError('Failed to load leaderboard.');
        } finally {
            setIsLoadingLeaderboard(false);
        }
    };

    const handleStartAssignmentCase = async (assignmentId: string) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('You must be logged in.');
                return;
            }

            setIsLoadingCase(true);

            const response = await fetch(`${API_BASE_URL}/chat/start/assignment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ assignment_id: assignmentId }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to start assignment case');
            }

            history.push(`/diagnosis/${data.session_id}`);
        } catch (err: any) {
            console.error('Failed to start assignment case:', err);
            setError(err.message || 'Failed to start assignment case');
        } finally {
            setIsLoadingCase(false);
        }
    };

    const handleLoadReportForAssignment = async (assignment: Assignment) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('You must be logged in.');
                return;
            }

            setSelectedAssignmentForReport(assignment);
            setSelectedSegment('report');
            setIsLoadingReport(true);
            setProgress(null);

            const response = await fetch(
                `${API_BASE_URL}/assignment/${assignment.id}/progress`,
                {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            );

            if (response.ok) {
                const data: AssignmentProgressEntry[] = await response.json();
                setProgress(data || []);
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to load assignment progress');
            }
        } catch (err: any) {
            console.error('Failed to load assignment progress:', err);
            setError(err.message || 'Failed to load assignment progress.');
        } finally {
            setIsLoadingReport(false);
        }
    };

    const handleCreateAssignment = async () => {
        if (!createTitle.trim()) {
            setError('Please enter an assignment title.');
            return;
        }

        const required = parseInt(createRequiredSessions, 10);
        if (isNaN(required) || required <= 0) {
            setError('Required cases must be a positive number.');
            return;
        }

        const allowedNames = createAllowedNamesText
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('You must be logged in.');
                return;
            }

            setIsCreatingAssignment(true);

            const body = {
                title: createTitle.trim(),
                description: createDescription.trim() || undefined,
                required_sessions: required,
                allowed_names: allowedNames.length > 0 ? allowedNames : undefined,
            };

            const response = await fetch(
                `${API_BASE_URL}/classroom/${classId}/assignments`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(body),
                },
            );

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create assignment.');
            }

            setInfoMessage('Assignment created.');
            setCreateTitle('');
            setCreateDescription('');
            setCreateRequiredSessions('5');
            setCreateAllowedNamesText('');
            fetchAssignments();
        } catch (err: any) {
            console.error('Create assignment failed:', err);
            setError(err.message || 'Failed to create assignment.');
        } finally {
            setIsCreatingAssignment(false);
        }
    };

    const formatSeconds = (sec: number) => {
        if (!sec || sec <= 0) return '—';
        const minutes = Math.floor(sec / 60);
        const seconds = Math.round(sec % 60);
        if (minutes === 0) return `${seconds}s`;
        return `${minutes}m ${seconds}s`;
    };

    // ești profesor global?
    const isProfessorGlobal =
        userInfo?.role &&
        userInfo.role.toLowerCase().includes('prof');

    // ești profesor în clasa asta? (dacă backend-ul pune role_in_class)
    const isProfessorInClass =
        classInfo?.role_in_class &&
        classInfo.role_in_class.toLowerCase().includes('prof');

    const canCreateAssignment = isProfessorGlobal || isProfessorInClass;

    return (
        <IonPage>
            <IonHeader>
                <IonToolbar>
                    <IonButtons slot="start">
                        <IonBackButton defaultHref="/home" />
                    </IonButtons>
                    <IonTitle>{classInfo ? classInfo.name : 'Class'}</IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent>
                <div className="px-4 py-3">
                    {/* Class info card */}
                    {classInfo && (
                        <IonCard>
                            <IonCardHeader>
                                <IonCardTitle>{classInfo.name}</IonCardTitle>
                            </IonCardHeader>
                            <IonCardContent>
                                {classInfo.university && (
                                    <p className="text-sm text-gray-600">
                                        University:{' '}
                                        <span className="font-medium">{classInfo.university}</span>
                                    </p>
                                )}
                                {classInfo.course_category && (
                                    <p className="text-sm text-gray-600">
                                        Course:{' '}
                                        <span className="font-medium">
                      {classInfo.course_category}
                    </span>
                                    </p>
                                )}
                                <p className="text-sm text-gray-500 mt-1">
                                    Your role:{' '}
                                    <span className="font-medium">
                    {classInfo.role_in_class || userInfo?.role || 'Student'}
                  </span>
                                </p>
                            </IonCardContent>
                        </IonCard>
                    )}

                    {/* Segmente */}
                    <IonSegment
                        value={selectedSegment}
                        onIonChange={(e) => setSelectedSegment(e.detail.value as any)}
                        className="mt-2"
                    >
                        <IonSegmentButton value="assignments">
                            <IonLabel>Assignments</IonLabel>
                        </IonSegmentButton>
                        <IonSegmentButton value="leaderboard">
                            <IonLabel>Leaderboard</IonLabel>
                        </IonSegmentButton>
                        <IonSegmentButton value="report">
                            <IonLabel>Report</IonLabel>
                        </IonSegmentButton>
                    </IonSegment>

                    {/* ASSIGNMENTS */}
                    {selectedSegment === 'assignments' && (
                        <div className="mt-3 space-y-3">
                            {/* Create assignment – doar pentru profesori */}
                            {canCreateAssignment && (
                                <IonCard>
                                    <IonCardContent>
                                        <h4 className="font-semibold text-gray-800 mb-2">
                                            Create Assignment
                                        </h4>

                                        <IonItem lines="none" className="rounded-xl bg-gray-50 mb-2">
                                            <IonLabel position="stacked">Title</IonLabel>
                                            <IonInput
                                                value={createTitle}
                                                placeholder="e.g. 5 pulpal cases"
                                                onIonChange={(e) =>
                                                    setCreateTitle(e.detail.value || '')
                                                }
                                            />
                                        </IonItem>

                                        <IonItem lines="none" className="rounded-xl bg-gray-50 mb-2">
                                            <IonLabel position="stacked">
                                                Description (optional)
                                            </IonLabel>
                                            <IonInput
                                                value={createDescription}
                                                placeholder="Short description"
                                                onIonChange={(e) =>
                                                    setCreateDescription(e.detail.value || '')
                                                }
                                            />
                                        </IonItem>

                                        <IonItem lines="none" className="rounded-xl bg-gray-50 mb-2">
                                            <IonLabel position="stacked">Required cases</IonLabel>
                                            <IonInput
                                                type="number"
                                                value={createRequiredSessions}
                                                onIonChange={(e) =>
                                                    setCreateRequiredSessions(e.detail.value || '1')
                                                }
                                            />
                                        </IonItem>

                                        <IonItem lines="none" className="rounded-xl bg-gray-50 mb-2">
                                            <IonLabel position="stacked">
                                                Diseases (comma separated, optional)
                                            </IonLabel>
                                            <IonInput
                                                value={createAllowedNamesText}
                                                placeholder="e.g. Pulpitis acuta, Parodontita cronica"
                                                onIonChange={(e) =>
                                                    setCreateAllowedNamesText(e.detail.value || '')
                                                }
                                            />
                                        </IonItem>

                                        <IonButton
                                            expand="block"
                                            onClick={handleCreateAssignment}
                                            disabled={isCreatingAssignment}
                                        >
                                            {isCreatingAssignment
                                                ? 'Creating...'
                                                : 'Create Assignment'}
                                        </IonButton>
                                    </IonCardContent>
                                </IonCard>
                            )}

                            {isLoadingAssignments ? (
                                <div className="flex justify-center py-4">
                                    <IonSpinner />
                                </div>
                            ) : assignments.length === 0 ? (
                                <p className="text-sm text-gray-500">
                                    No assignments for this class yet.
                                </p>
                            ) : (
                                assignments.map((a) => (
                                    <IonCard key={a.id}>
                                        <IonCardContent>
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <IonIcon
                                                            icon={bookOutline}
                                                            className="text-indigo-500"
                                                        />
                                                        <h4 className="font-bold text-gray-800 text-sm">
                                                            {a.title}
                                                        </h4>
                                                    </div>
                                                    {a.description && (
                                                        <p className="text-xs text-gray-500 mb-1">
                                                            {a.description}
                                                        </p>
                                                    )}
                                                    <p className="text-xs text-gray-500">
                                                        Required cases:{' '}
                                                        <span className="font-semibold">
                              {a.required_sessions}
                            </span>
                                                    </p>
                                                    {a.allowed_names && a.allowed_names.length > 0 && (
                                                        <p className="text-[11px] text-gray-400 mt-1">
                                                            Diseases: {a.allowed_names.join(', ')}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <IonButton
                                                        size="small"
                                                        onClick={() => handleStartAssignmentCase(a.id)}
                                                        disabled={isLoadingCase}
                                                    >
                                                        {isLoadingCase ? 'Starting...' : 'Start'}
                                                    </IonButton>
                                                    <IonButton
                                                        size="small"
                                                        fill="clear"
                                                        onClick={() => handleLoadReportForAssignment(a)}
                                                    >
                                                        View report
                                                    </IonButton>
                                                </div>
                                            </div>
                                        </IonCardContent>
                                    </IonCard>
                                ))
                            )}
                        </div>
                    )}

                    {/* LEADERBOARD */}
                    {selectedSegment === 'leaderboard' && (
                        <div className="mt-3">
                            {isLoadingLeaderboard ? (
                                <div className="flex justify-center py-4">
                                    <IonSpinner />
                                </div>
                            ) : leaderboard.length === 0 ? (
                                <p className="text-sm text-gray-500">
                                    No students in this class yet.
                                </p>
                            ) : (
                                <IonCard>
                                    <IonCardContent>
                                        {leaderboard.map((entry) => (
                                            <div
                                                key={entry.user_id}
                                                className="flex items-center justify-between py-2 border-b last:border-b-0 border-gray-100"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <IonIcon
                                                        icon={people}
                                                        className="text-indigo-500"
                                                    />
                                                    <div>
                                                        <p className="text-sm font-medium">
                                                            #{entry.rank} {entry.username}
                                                        </p>
                                                        <p className="text-[11px] text-gray-500">
                                                            XP: {entry.xp} · Level {entry.level} · Streak{' '}
                                                            {entry.streak}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    {entry.role_in_class || 'Student'}
                                                </div>
                                            </div>
                                        ))}
                                    </IonCardContent>
                                </IonCard>
                            )}
                        </div>
                    )}

                    {/* REPORT */}
                    {selectedSegment === 'report' && (
                        <div className="mt-3">
                            {!selectedAssignmentForReport ? (
                                <p className="text-sm text-gray-500">
                                    Select an assignment and click "View report" to see progress.
                                </p>
                            ) : isLoadingReport ? (
                                <div className="flex justify-center py-4">
                                    <IonSpinner />
                                </div>
                            ) : !progress || progress.length === 0 ? (
                                <p className="text-sm text-gray-500">
                                    No progress data yet for "{selectedAssignmentForReport.title}".
                                </p>
                            ) : (
                                <>
                                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                                        {selectedAssignmentForReport.title} – Progress
                                    </h4>
                                    <IonCard>
                                        <IonCardContent>
                                            {progress.map((p) => (
                                                <div
                                                    key={p.user_id}
                                                    className="flex items-center justify-between py-2 border-b last:border-b-0 border-gray-100"
                                                >
                                                    <div>
                                                        <p className="text-sm font-medium">{p.username}</p>
                                                        <p className="text-[11px] text-gray-500">
                                                            {p.correct_sessions}/{p.required_sessions} correct ·{' '}
                                                            {p.completed_sessions}/{p.required_sessions}{' '}
                                                            completed
                                                        </p>
                                                    </div>
                                                    <div className="text-xs text-gray-500 text-right">
                                                        <div>
                                                            {p.is_completed ? '✅ Done' : '⏳ Ongoing'}
                                                        </div>
                                                        <div>
                                                            Avg time: {formatSeconds(p.avg_time_seconds)}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </IonCardContent>
                                    </IonCard>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <IonToast
                    isOpen={!!error}
                    onDidDismiss={() => setError('')}
                    message={error}
                    duration={3000}
                    color="danger"
                    position="top"
                />

                <IonToast
                    isOpen={!!infoMessage}
                    onDidDismiss={() => setInfoMessage('')}
                    message={infoMessage}
                    duration={2500}
                    color="success"
                    position="top"
                />
            </IonContent>
        </IonPage>
    );
};

export default ClassPage;
