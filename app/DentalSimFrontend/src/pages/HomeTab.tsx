import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
    IonPage,
    IonHeader,
    IonToolbar,
    IonContent,
    IonCard,
    IonCardContent,
    IonProgressBar,
    IonButton,
    IonIcon,
    IonSpinner,
    IonRippleEffect,
    IonToast,
    useIonViewWillEnter,
    IonItem,
    IonLabel,
    IonInput,
} from '@ionic/react';
import {
    flame,
    flash,
    medkit,
    chevronForward,
    sparkles,
    ribbon,
    school,
} from 'ionicons/icons';

import logoImg from '../assets/NoBackground.png';
import { API_BASE_URL } from '../config';

interface Classroom {
    id: string;
    name: string;
    university?: string;
    course_category?: string;
    join_code?: string;
    role_in_class?: string;
}

const HomeTab: React.FC = () => {
    const history = useHistory();

    const [userInfo, setUserInfo] = useState<any>(null);
    const [isLoadingCase, setIsLoadingCase] = useState(false);
    const [error, setError] = useState('');
    const [infoMessage, setInfoMessage] = useState('');

    const [classes, setClasses] = useState<Classroom[]>([]);
    const [joinCode, setJoinCode] = useState('');
    const [isJoining, setIsJoining] = useState(false);

    // Create class state
    const [createName, setCreateName] = useState('');
    const [createUniversity, setCreateUniversity] = useState('');
    const [createCourseCategory, setCreateCourseCategory] = useState('');
    const [isCreatingClass, setIsCreatingClass] = useState(false);


    useIonViewWillEnter(() => {
        fetchUserProfile();
        fetchClassrooms();
    });

    const fetchUserProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_BASE_URL}/auth/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const freshData = await response.json();
                setUserInfo(freshData);
                localStorage.setItem('user', JSON.stringify(freshData));
            }
        } catch (err) {
            console.error('Failed to refresh user stats:', err);
        }
    };

    const fetchClassrooms = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await fetch(`${API_BASE_URL}/classroom/my`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                setClasses(data || []);
            }
        } catch (err) {
            console.error('Failed to fetch classrooms:', err);
        }
    };

    const handleJoinClass = async () => {
        if (!joinCode.trim()) {
            setError('Please enter a class code.');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('You must be logged in to join a class.');
                return;
            }

            setIsJoining(true);
            const response = await fetch(`${API_BASE_URL}/classroom/join`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ class_code: joinCode.trim() }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to join classroom.');
            }

            setInfoMessage(`Joined class: ${data.classroom_name || 'Classroom'}`);
            setJoinCode('');
            fetchClassrooms();
        } catch (err: any) {
            console.error('Join class failed:', err);
            setError(err.message || 'Failed to join classroom.');
        } finally {
            setIsJoining(false);
        }
    };

    const handleCreateClass = async () => {
        if (!createName.trim()) {
            setError('Please enter a class name.');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('You must be logged in to create a class.');
                return;
            }

            setIsCreatingClass(true);

            const body = {
                name: createName.trim(),
                university: createUniversity.trim() || undefined,
                course_category: createCourseCategory.trim() || undefined,
            };

            const response = await fetch(`${API_BASE_URL}/classroom`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify(body),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create classroom.');
            }

            setInfoMessage(
                `Class created: ${data.classroom_name || body.name} (code: ${data.join_code || '—'})`
            );
            setCreateName('');
            setCreateUniversity('');
            setCreateCourseCategory('');
            fetchClassrooms();
        } catch (err: any) {
            console.error('Create class failed:', err);
            setError(err.message || 'Failed to create classroom.');
        } finally {
            setIsCreatingClass(false);
        }
    };

    const handleStartDiagnosis = async () => {
        setIsLoadingCase(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                throw new Error('No authentication token found. Please log in again.');
            }

            const response = await fetch(`${API_BASE_URL}/chat/start/random`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to start case');
            }

            console.log('Case started, Session ID:', data.session_id);
            history.push(`/diagnosis/${data.session_id}`);
        } catch (err: any) {
            setError(err.message);
            if (err.message.includes('token') || err.message.includes('401')) {
                history.replace('/login');
            }
        } finally {
            setIsLoadingCase(false);
        }
    };

    const displayName = userInfo?.username
        ? userInfo.username.charAt(0).toUpperCase() + userInfo.username.slice(1)
        : 'Doctor';

    const xpProgress = userInfo ? (userInfo.xp % 1000) / 1000 : 0.5;

    const localToday = new Date().toISOString().split('T')[0];

    const lastActive = userInfo?.last_active_date
        ? new Date(userInfo.last_active_date).toISOString().split('T')[0]
        : '';

    const isStreakActive = lastActive === localToday;

    const isProfessor =
        userInfo?.role && userInfo.role.toLowerCase().includes('prof');

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar className="dentsim-toolbar">
                    <div className="flex items-center justify-between px-4 py-2">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <img
                                src={logoImg}
                                alt="DentSim Logo"
                                className="h-14 w-14 rounded-xl object-contain"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                            <div>
                                <h1 className="text-xl font-bold text-gray-800">DentalTrain</h1>
                                <p className="text-xs text-gray-500">Dental Training Hub</p>
                            </div>
                        </div>

                        {/* Streak Badge */}
                        <div
                            className={` flex items-center gap-2 px-3 py-2 rounded-full transition-all duration-500
                ${
                                isStreakActive
                                    ? 'bg-gradient-to-r from-orange-100 to-amber-100 border border-orange-200'
                                    : 'bg-gray-100 border border-gray-200'
                            }
              `}
                        >
                            <IonIcon
                                icon={flame}
                                className={`
                  text-xl transition-colors duration-500
                  ${isStreakActive ? 'text-orange-500' : 'text-gray-400'}
                `}
                            />
                            <span
                                className={`
                  font-bold transition-colors duration-500
                  ${isStreakActive ? 'text-orange-600' : 'text-gray-500'}
                `}
                            >
                {userInfo?.streak || 0}
              </span>
                        </div>
                    </div>
                </IonToolbar>
            </IonHeader>

            <IonContent fullscreen className="dentsim-content">
                <div className="px-4 pb-8">
                    {/* Welcome Section */}
                    <div className="mt-4 mb-6">
                        <h2 className="text-2xl font-bold text-gray-800">
                            Welcome back, {displayName}! 👋
                        </h2>
                        <p className="text-gray-500 mt-1">
                            {isProfessor
                                ? 'Manage your classes and assignments.'
                                : 'Ready to practice today?'}
                        </p>
                    </div>

                    {/* Status Card - Real XP from Backend */}
                    <IonCard className="dentsim-card status-card">
                        <IonCardContent className="p-0">
                            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-5 rounded-2xl">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white/20 backdrop-blur-sm p-2 rounded-xl">
                                            <IonIcon icon={ribbon} className="text-white text-2xl" />
                                        </div>
                                        <div>
                                            <p className="text-emerald-100 text-sm">Current XP</p>
                                            <p className="text-white text-2xl font-bold">
                                                {userInfo?.xp || 0} XP
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* XP Progress Visual */}
                                <div className="bg-white/10 rounded-full p-1">
                                    <IonProgressBar
                                        value={xpProgress}
                                        className="dentsim-progress h-3 rounded-full"
                                    />
                                </div>
                                <div className="flex justify-between mt-2 text-sm">
                  <span className="text-emerald-100">
                    Level {Math.floor((userInfo?.xp || 0) / 1000) + 1}
                  </span>
                                    <span className="text-white font-medium">Next Level</span>
                                </div>
                            </div>
                        </IonCardContent>
                    </IonCard>

                    {/* Quick Stats Row */}
                    <div className="grid grid-cols-3 gap-3 my-5">
                        {/* CASES CARD */}
                        <div className="bg-blue-50 rounded-2xl p-4 text-center">
                            <div className="bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2">
                                <IonIcon icon={medkit} className="text-blue-600 text-xl" />
                            </div>
                            <p className="text-2xl font-bold text-blue-700">
                                {userInfo?.cases_completed || 0}
                            </p>
                            <p className="text-xs text-blue-500">Cases</p>
                        </div>

                        {/* ACCURACY CARD */}
                        <div className="bg-green-50 rounded-2xl p-4 text-center">
                            <div className="bg-green-100 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2">
                                <IonIcon icon={flash} className="text-green-600 text-xl" />
                            </div>
                            <p className="text-2xl font-bold text-green-700">
                                {userInfo?.accuracy || 0}%
                            </p>
                            <p className="text-xs text-green-500">Accuracy</p>
                        </div>

                        {/* BADGES CARD */}
                        <div className="bg-purple-50 rounded-2xl p-4 text-center">
                            <div className="bg-purple-100 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2">
                                <IonIcon icon={sparkles} className="text-purple-600 text-xl" />
                            </div>
                            <p className="text-2xl font-bold text-purple-700">
                                {userInfo?.earned_badges?.length || 0}
                            </p>
                            <p className="text-xs text-purple-500">Badges</p>
                        </div>
                    </div>

                    {/* Start Diagnosis CTA */}
                    <IonCard
                        className="dentsim-card cta-card ion-activatable overflow-hidden"
                        onClick={handleStartDiagnosis}
                        button
                        disabled={isLoadingCase}
                    >
                        <IonRippleEffect />
                        <IonCardContent className="p-0">
                            <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <h3 className="text-white text-xl font-bold mb-1">
                                            Start Diagnosis
                                        </h3>
                                        <p className="text-indigo-100 text-sm">
                                            Practice with an AI patient case
                                        </p>
                                    </div>
                                    <div className="bg-white/20 backdrop-blur-sm p-4 rounded-2xl">
                                        {isLoadingCase ? (
                                            <IonSpinner color="light" />
                                        ) : (
                                            <IonIcon icon={medkit} className="text-white text-3xl" />
                                        )}
                                    </div>
                                </div>
                                <IonButton
                                    expand="block"
                                    className="mt-4 dentsim-cta-button"
                                    fill="solid"
                                >
                                    {isLoadingCase ? 'Creating Session...' : 'Begin Case'}
                                    {!isLoadingCase && (
                                        <IonIcon slot="end" icon={chevronForward} />
                                    )}
                                </IonButton>
                            </div>
                        </IonCardContent>
                    </IonCard>

                    {/* Join Class Section */}
                    <div className="mt-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-2">
                            Join a Class
                        </h3>
                        <IonCard className="dentsim-card">
                            <IonCardContent>
                                <IonItem lines="none" className="rounded-xl bg-gray-50 mb-3">
                                    <IonIcon slot="start" icon={school} className="text-indigo-500" />
                                    <IonLabel position="stacked">Class Code</IonLabel>
                                    <IonInput
                                        value={joinCode}
                                        placeholder="Enter class code"
                                        onIonChange={(e) => setJoinCode(e.detail.value || '')}
                                    />
                                </IonItem>
                                <IonButton
                                    expand="block"
                                    onClick={handleJoinClass}
                                    disabled={isJoining}
                                >
                                    {isJoining ? 'Joining...' : 'Join Class'}
                                </IonButton>
                            </IonCardContent>
                        </IonCard>
                    </div>

                    {/* Create Class Section – vizibil doar pentru profesori */}
                    {isProfessor && (
                        <div className="mt-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-2">
                                Create a Class
                            </h3>
                            <IonCard className="dentsim-card">
                                <IonCardContent>
                                    <IonItem lines="none" className="rounded-xl bg-gray-50 mb-3">
                                        <IonLabel position="stacked">Class Name</IonLabel>
                                        <IonInput
                                            value={createName}
                                            placeholder="e.g. Endodontie 2025"
                                            onIonChange={(e) => setCreateName(e.detail.value || '')}
                                        />
                                    </IonItem>

                                    <IonItem lines="none" className="rounded-xl bg-gray-50 mb-3">
                                        <IonLabel position="stacked">University (optional)</IonLabel>
                                        <IonInput
                                            value={createUniversity}
                                            placeholder="e.g. UMF Cluj"
                                            onIonChange={(e) =>
                                                setCreateUniversity(e.detail.value || '')
                                            }
                                        />
                                    </IonItem>

                                    <IonItem lines="none" className="rounded-xl bg-gray-50 mb-3">
                                        <IonLabel position="stacked">Course Category (optional)</IonLabel>
                                        <IonInput
                                            value={createCourseCategory}
                                            placeholder="e.g. Endodontics"
                                            onIonChange={(e) =>
                                                setCreateCourseCategory(e.detail.value || '')
                                            }
                                        />
                                    </IonItem>

                                    <IonButton
                                        expand="block"
                                        onClick={handleCreateClass}
                                        disabled={isCreatingClass}
                                    >
                                        {isCreatingClass ? 'Creating...' : 'Create Class'}
                                    </IonButton>
                                </IonCardContent>
                            </IonCard>
                        </div>
                    )}

                    {/* Your Classes Section */}
                    <div className="mt-6">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-bold text-gray-800">Your Classes</h3>
                        </div>

                        {classes.length === 0 ? (
                            <p className="text-sm text-gray-500">
                                You are not enrolled in any classes yet. Use a class code to join
                                or create a class if you are a professor.
                            </p>
                        ) : (
                            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                                {classes.map((c) => (
                                    <IonCard
                                        key={c.id}
                                        className="dentsim-class-card flex-shrink-0 w-56"
                                        button
                                        onClick={() => history.push(`/class/${c.id}`)}
                                    >
                                        <IonCardContent className="p-4">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 bg-indigo-100">
                                                <IonIcon icon={school} className="text-indigo-600 text-xl" />
                                            </div>
                                            <h4 className="font-bold text-gray-800 text-sm truncate">
                                                {c.name}
                                            </h4>
                                            {c.course_category && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {c.course_category}
                                                </p>
                                            )}
                                            {c.university && (
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {c.university}
                                                </p>
                                            )}
                                            <p className="text-[11px] text-gray-400 mt-1">
                                                Role: {c.role_in_class || 'Student'}
                                            </p>
                                        </IonCardContent>
                                    </IonCard>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Error Toast */}
                <IonToast
                    isOpen={!!error}
                    onDidDismiss={() => setError('')}
                    message={error}
                    duration={3000}
                    color="danger"
                    position="top"
                />

                {/* Info Toast */}
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

export default HomeTab;
