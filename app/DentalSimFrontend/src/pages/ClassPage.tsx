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
    IonSelect,
    IonSelectOption,
    IonChip,
    IonAlert,
} from '@ionic/react';
import { useHistory, useParams } from 'react-router-dom';
import { people, bookOutline, closeCircle, trash } from 'ionicons/icons';
import { API_BASE_URL } from '../config';
import PoweredByFooter from '../components/PoweredByFooter';

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
    allowed_categories: string[];
    start_at?: string;
    due_at?: string;
    completed_sessions?: number;
    correct_sessions?: number;
    is_completed?: boolean;
    avg_time_seconds?: number;
    created_by?: string;
}

interface LeaderboardEntry {
    user_id: string;
    username: string;
    xp: number;
    streak: number;
    level: number;
    rank: number;
    role_in_class?: string;
    cases_completed?: number;
    accuracy?: number;
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
    const [createAllowedNames, setCreateAllowedNames] = useState<string[]>([]);
    const [availableDiseases, setAvailableDiseases] = useState<{ id: string, name: string }[]>([]);
    const [createDueAt, setCreateDueAt] = useState('');
    const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
    const [assignmentToDelete, setAssignmentToDelete] = useState<string | null>(null);

    useIonViewWillEnter(() => {
        fetchUserProfile();
        fetchClassroomsAndSelect();
        fetchAssignments();
        fetchLeaderboard();
        fetchDiseases();
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

    const fetchDiseases = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_BASE_URL}/diseases`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setAvailableDiseases(data);
            }
        } catch (err) {
            console.error('Failed to fetch diseases:', err);
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

        const allowedNames = createAllowedNames;

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
                due_at: createDueAt || undefined,
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
            setCreateAllowedNames([]);
            setCreateDueAt('');
            fetchAssignments();
        } catch (err: any) {
            console.error('Create assignment failed:', err);
            setError(err.message || 'Failed to create assignment.');
        } finally {
            setIsCreatingAssignment(false);
        }
    };

    const handleDeleteAssignment = async (assignmentId: string) => {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('You must be logged in.');
                return;
            }

            const response = await fetch(`${API_BASE_URL}/assignment/${assignmentId}/delete`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete assignment.');
            }

            setInfoMessage('Assignment deleted successfully.');
            fetchAssignments();
        } catch (err: any) {
            console.error('Delete assignment failed:', err);
            setError(err.message || 'Failed to delete assignment.');
        } finally {
            setAssignmentToDelete(null);
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

    const canCreateAssignment = isProfessorGlobal && isProfessorInClass;

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
                                {classInfo.join_code && (
                                    <p className="text-sm text-gray-600 mt-1">
                                        Class Code:{' '}
                                        <span className="font-bold text-indigo-600 tracking-wider">
                                            {classInfo.join_code}
                                        </span>
                                    </p>
                                )}
                                    <p className="text-sm text-gray-500 mt-1">
                                        Your role:{' '}
                                        <span className="font-medium">
                                            {isProfessorGlobal ? (classInfo.role_in_class || 'Professor') : 'Student'}
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
                        {canCreateAssignment && (
                            <IonSegmentButton value="leaderboard">
                                <IonLabel>Leaderboard</IonLabel>
                            </IonSegmentButton>
                        )}
                        {canCreateAssignment && (
                            <IonSegmentButton value="report">
                                <IonLabel>Report</IonLabel>
                            </IonSegmentButton>
                        )}
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
                                            <IonLabel position="stacked">Number of cases to solve</IonLabel>
                                            <IonInput
                                                type="number"
                                                value={createRequiredSessions}
                                                onIonChange={(e) =>
                                                    setCreateRequiredSessions(e.detail.value || '1')
                                                }
                                            />
                                        </IonItem>

                                        <IonItem lines="none" className="rounded-xl bg-gray-50 mb-2 overflow-visible">
                                            <IonLabel position="stacked">
                                                Select Diseases
                                            </IonLabel>
                                            <IonSelect
                                                value={null}
                                                placeholder="Select disease to add"
                                                onIonChange={(e) => {
                                                    const val = e.detail.value;
                                                    if (val && !createAllowedNames.includes(val)) {
                                                        setCreateAllowedNames([...createAllowedNames, val]);
                                                    }
                                                }}
                                            >
                                                {availableDiseases.map((d) => (
                                                    <IonSelectOption key={d.id} value={d.name}>
                                                        {d.name}
                                                    </IonSelectOption>
                                                ))}
                                            </IonSelect>
                                        </IonItem>

                                        {createAllowedNames.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {createAllowedNames.map((name) => (
                                                    <IonChip key={name} color="primary" className="m-0">
                                                        <IonLabel>{name}</IonLabel>
                                                        <IonIcon
                                                            icon={closeCircle}
                                                            onClick={() => {
                                                                setCreateAllowedNames(createAllowedNames.filter(n => n !== name));
                                                            }}
                                                        />
                                                    </IonChip>
                                                ))}
                                            </div>
                                        )}



                                        <IonItem lines="none" className="rounded-xl bg-gray-50 mb-3">
                                            <IonLabel position="stacked">Deadline (optional)</IonLabel>
                                            <IonInput
                                                type="datetime-local"
                                                value={createDueAt}
                                                onIonChange={(e) => setCreateDueAt(e.detail.value || '')}
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

                                                    {a.completed_sessions !== undefined && (
                                                        <div className="mt-1 text-xs">
                                                            <p className={`${a.is_completed ? 'text-green-600 font-medium' : 'text-amber-600'} mb-0.5`}>
                                                                Status: {a.is_completed ? '✅ Completed' : '⏳ In Progress'}
                                                            </p>
                                                            <p className="text-gray-500">
                                                                Progress: {a.completed_sessions}/{a.required_sessions} cases done
                                                            </p>
                                                            <p className="text-gray-500">
                                                                Accuracy: {a.correct_sessions}/{a.completed_sessions > 0 ? a.completed_sessions : 0} correct
                                                            </p>
                                                            <p className="text-gray-500">
                                                                Avg time: {formatSeconds(a.avg_time_seconds || 0)}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {a.due_at && (
                                                        <p className={`text-[11px] mt-1 ${new Date(a.due_at) < new Date() ? 'text-red-500 font-bold' : 'text-indigo-500'}`}>
                                                            Deadline: {new Date(a.due_at).toLocaleString()}
                                                        </p>
                                                    )}
                                                    {isProfessorGlobal && a.created_by === userInfo?.id && a.allowed_names && a.allowed_names.length > 0 && (
                                                        <p className="text-[11px] text-gray-400 mt-1">
                                                            Diseases: {a.allowed_names.join(', ')}
                                                        </p>
                                                    )}
                                                    {isProfessorGlobal && a.created_by === userInfo?.id && a.allowed_categories && a.allowed_categories.length > 0 && (
                                                        <p className="text-[11px] text-gray-400 mt-1">
                                                            Categories: {a.allowed_categories.join(', ')}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <IonButton
                                                        size="small"
                                                        onClick={() => handleStartAssignmentCase(a.id)}
                                                        disabled={isLoadingCase || (a.due_at ? new Date(a.due_at) < new Date() : false)}
                                                        color={a.due_at && new Date(a.due_at) < new Date() ? 'medium' : 'primary'}
                                                    >
                                                        {isLoadingCase ? 'Starting...' : (a.due_at && new Date(a.due_at) < new Date() ? 'Expired' : 'Start')}
                                                    </IonButton>
                                                    {canCreateAssignment && (
                                                        <IonButton
                                                            size="small"
                                                            fill="clear"
                                                            onClick={() => handleLoadReportForAssignment(a)}
                                                        >
                                                            View report
                                                        </IonButton>
                                                    )}
                                                    {isProfessorGlobal && a.created_by === userInfo?.id && (
                                                        <IonButton
                                                            size="small"
                                                            fill="clear"
                                                            color="danger"
                                                            onClick={() => setAssignmentToDelete(a.id)}
                                                        >
                                                            <IonIcon icon={trash} slot="icon-only" />
                                                        </IonButton>
                                                    )}
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
                                                            XP: {entry.xp} · Lvl {entry.level} · {entry.cases_completed || 0} cases · {entry.accuracy || 0}% acc
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
                                <div className="p-4 text-center">
                                    <p className="text-sm text-gray-500 mb-2">
                                        No students found or no progress data yet for "{selectedAssignmentForReport.title}".
                                    </p>
                                    <IonButton 
                                        size="small" 
                                        fill="clear" 
                                        onClick={() => setSelectedSegment('assignments')}
                                    >
                                        Back to Assignments
                                    </IonButton>
                                </div>
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

                <div className="px-4">
                    <PoweredByFooter />
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
                <IonAlert
                    isOpen={!!assignmentToDelete}
                    onDidDismiss={() => setAssignmentToDelete(null)}
                    header="Delete Assignment?"
                    message="Are you sure you want to delete this assignment? All student progress for this assignment will be lost."
                    buttons={[
                        {
                            text: 'Cancel',
                            role: 'cancel',
                            cssClass: 'secondary',
                            handler: () => {
                                setAssignmentToDelete(null);
                            },
                        },
                        {
                            text: 'Delete',
                            role: 'destructive',
                            handler: () => {
                                if (assignmentToDelete) {
                                    handleDeleteAssignment(assignmentToDelete);
                                }
                            },
                        },
                    ]}
                />
            </IonContent>
        </IonPage>
    );
};

export default ClassPage;
