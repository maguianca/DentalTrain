import React, { useState, useEffect } from 'react';
import { useHistory, useLocation} from 'react-router-dom';
import {
    IonPage,
    IonContent,
    IonButton,
    IonInput,
    IonIcon,
    IonSpinner,
    IonText,
    IonToast,
    IonSelect,
    IonSelectOption,
    IonAlert,
    IonItem,
    IonLabel,
    IonList,
} from '@ionic/react';
import {
    personOutline,
    lockClosedOutline,
    mailOutline,
    schoolOutline,
    medkitOutline,
    checkmarkCircleOutline,
    informationCircleOutline,
} from 'ionicons/icons';

import logoImg from '../assets/NoBackground.png';
import { API_BASE_URL } from '../config';

const SignupPage: React.FC = () => {
    const history = useHistory();

    // Form State
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('Dental Student');
    const [classCode, setClassCode] = useState('');

    // NEW: University list and detection
    const [universities, setUniversities] = useState<string[]>([]);
    const [detectedUniversity, setDetectedUniversity] = useState<string>('');

    // Verification State
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');

    // UI State
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [usernameError, setUsernameError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [toast, setToast] = useState({ show: false, msg: '', color: 'success' });
    const [showEmailTakenAlert, setShowEmailTakenAlert] = useState(false);
    const [showUniversityInfo, setShowUniversityInfo] = useState(false);

    const location = useLocation<{ verifyEmail?: string; startVerification?: boolean }>();

    // NEW: Check if we were redirected here to verify a specific email
    useEffect(() => {
        if (location.state?.startVerification && location.state?.verifyEmail) {
            setEmail(location.state.verifyEmail);
            setIsVerifying(true);

            // Optional: clear state so a browser refresh doesn't stick in verify mode
            history.replace({ ...location, state: {} });
        }
    }, [location.state]);

    // Load universities on mount
    useEffect(() => {
        fetchUniversities();
    }, []);

    // Detect university from email domain
    useEffect(() => {
        if (email.includes('@')) {
            const domain = email.split('@')[1];
            // You could call an endpoint to validate, or just show info
            checkEmailDomain(domain);
        } else {
            setDetectedUniversity('');
            setEmailError('');
        }
    }, [email]);

    const fetchUniversities = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/universities`);
            const data = await response.json();
            setUniversities(data.universities || []);
        } catch (err) {
            console.error('Failed to load universities', err);
        }
    };

    const checkEmailDomain = (domain: string) => {
        // Basic validation - you could call backend to verify
        const institutionalDomains = ['.edu', '.ro', '.ac.uk', 'umfcluj', 'umfcd', 'umfiasi', 'umfst', 'umft'];
        const isInstitutional = institutionalDomains.some(d => domain.includes(d));

        if (isInstitutional) {
            setDetectedUniversity(`Email domain recognized: ${domain}`);
            setEmailError('');
        } else if (domain === 'gmail.com') {
            setDetectedUniversity('Test Account (gmail.com)');
            setEmailError('');
        } else {
            setDetectedUniversity('');
            setEmailError('Please use an institutional email (.edu, .ro, etc.)');
        }
    };

    // --- HELPER: Check Username Availability ---
    const checkUsername = async () => {
        if (!username) return;
        try {
            const response = await fetch(`${API_BASE_URL}/auth/check-username`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username }),
            });
            const data = await response.json();

            if (!data.available) {
                setUsernameError('Username is already taken.');
            } else {
                setUsernameError('');
            }
        } catch (e) {
            console.error("Validation error", e);
        }
    };

    // --- STEP 1: Handle Initial Registration ---
    const handleRegister = async () => {
        // Basic Validation
        if (!email.includes('@') || !username || !password) {
            setError('Please fill in all required fields.');
            return;
        }
        if (usernameError) {
            setError('Please fix the username error.');
            return;
        }
        if (emailError) {
            setError('Please use a valid institutional email.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters long.');
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    email,
                    password,
                    role,
                    class_code: classCode
                }),
            });

            const data = await response.json();

            // Handle "Email Already Exists" specifically
            if (response.status === 409 && data.code === 'EMAIL_TAKEN') {
                setIsLoading(false);
                setShowEmailTakenAlert(true);
                return;
            }

            // Handle institutional email validation error
            if (response.status === 403) {
                setError(data.error || 'Please use a supported institutional email.');
                setIsLoading(false);
                return;
            }

            if (!response.ok) throw new Error(data.error || 'Registration failed');

            // Success! Switch to Verification Mode
            setIsLoading(false);
            setIsVerifying(true);
            setToast({ show: true, msg: 'Code sent to your email!', color: 'success' });

        } catch (err: any) {
            setError(err.message || 'Unable to connect to server');
            setIsLoading(false);
        }
    };

    // --- STEP 2: Handle Code Submission ---
    const handleVerify = async () => {
        if (!verificationCode || verificationCode.length < 6) {
            setError('Please enter the 6-digit code.');
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code: verificationCode }),
            });

            if (!response.ok) throw new Error('Invalid Code');

            setToast({ show: true, msg: 'Account Verified! Logging in...', color: 'success' });
            setTimeout(() => history.replace('/login'), 1500);

        } catch (err: any) {
            setError('Invalid Code. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <IonPage>
            <IonContent fullscreen className="login-content">
                <div className="h-full flex flex-col justify-center px-6 py-12">

                    {/* Logo Section */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-30 h-30 bg-gradient-to-br rounded-2xl flex items-center justify-center shadow-lg mb-4 overflow-hidden">
                            <img
                                src={logoImg}
                                alt="DentSim Logo"
                                className="w-24 h-24 object-contain"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800">
                            {isVerifying ? 'Verify Account' : 'Create Account'}
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            {isVerifying ? 'Check your institutional email' : 'Join DentalTrain today'}
                        </p>
                    </div>

                    <div className="bg-white rounded-3xl shadow-lg p-6 mb-6">

                        {!isVerifying ? (
                            // --- VIEW 1: REGISTRATION FORM ---
                            <div className="space-y-4">

                                {/* Email Input with University Detection */}
                                <div className="login-input-group">
                                    <div className={`flex items-center bg-gray-100 rounded-2xl px-4 py-1 ${emailError ? 'border-2 border-red-500' : detectedUniversity ? 'border-2 border-green-500' : ''}`}>
                                        <IonIcon icon={mailOutline} className="text-gray-400 text-xl mr-3" />
                                        <IonInput
                                            type="email"
                                            placeholder="Institutional Email"
                                            value={email}
                                            onIonInput={e => setEmail(e.detail.value!)}
                                        />
                                        {detectedUniversity && !emailError && (
                                            <IonIcon icon={checkmarkCircleOutline} className="text-green-500 text-xl" />
                                        )}
                                    </div>
                                    {detectedUniversity && !emailError && (
                                        <p className="text-xs text-green-600 mt-1 ml-2 flex items-center gap-1">
                                            <IonIcon icon={checkmarkCircleOutline} />
                                            {detectedUniversity}
                                        </p>
                                    )}
                                    {emailError && (
                                        <p className="text-xs text-red-500 mt-1 ml-2">{emailError}</p>
                                    )}
                                    <button
                                        className="text-xs text-indigo-600 mt-1 ml-2 flex items-center gap-1"
                                        onClick={() => setShowUniversityInfo(true)}
                                    >
                                        <IonIcon icon={informationCircleOutline} />
                                        View supported universities
                                    </button>
                                </div>

                                {/* Username Input (with Validation) */}
                                <div className="login-input-group">
                                    <div className={`flex items-center bg-gray-100 rounded-2xl px-4 py-1 ${usernameError ? 'border-2 border-red-500' : ''}`}>
                                        <IonIcon icon={personOutline} className="text-gray-400 text-xl mr-3" />
                                        <IonInput
                                            placeholder="Choose a Username"
                                            value={username}
                                            onIonInput={e => setUsername(e.detail.value!)}
                                            onIonBlur={checkUsername}
                                        />
                                    </div>
                                    {usernameError && (
                                        <p className="text-xs text-red-500 mt-1 ml-2">{usernameError}</p>
                                    )}
                                </div>

                                {/* Password Input */}
                                <div className="login-input-group">
                                    <div className="flex items-center bg-gray-100 rounded-2xl px-4 py-1">
                                        <IonIcon icon={lockClosedOutline} className="text-gray-400 text-xl mr-3" />
                                        <IonInput
                                            type="password"
                                            placeholder="Password (min 6 characters)"
                                            value={password}
                                            onIonInput={e => setPassword(e.detail.value!)}
                                        />
                                    </div>
                                </div>

                                {/* Role Select */}
                                <div className="login-input-group">
                                    <div className="flex items-center bg-gray-100 rounded-2xl px-4 py-1">
                                        <IonIcon icon={medkitOutline} className="text-gray-400 text-xl mr-3" />
                                        <div className="w-full">
                                            <IonSelect
                                                value={role}
                                                onIonChange={(e) => setRole(e.detail.value)}
                                                interface="popover"
                                                className="w-full text-gray-700"
                                                style={{ paddingLeft: 0 }}
                                            >
                                                <IonSelectOption value="Dental Student">Dental Student</IonSelectOption>
                                                <IonSelectOption value="Resident">Resident</IonSelectOption>
                                                <IonSelectOption value="General Dentist">General Dentist</IonSelectOption>
                                                <IonSelectOption value="Professor">Professor</IonSelectOption>
                                            </IonSelect>
                                        </div>
                                    </div>
                                </div>

                                {/* Class Code (Optional) */}
                                <div className="login-input-group">
                                    <div className="flex items-center bg-gray-100 rounded-2xl px-4 py-1">
                                        <IonIcon icon={schoolOutline} className="text-gray-400 text-xl mr-3" />
                                        <IonInput
                                            placeholder="Class Code (Optional)"
                                            value={classCode}
                                            onIonInput={e => setClassCode(e.detail.value!)}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 ml-2">
                                        If your professor gave you a code, enter it here
                                    </p>
                                </div>

                                {error && (
                                    <div className="text-center">
                                        <IonText color="danger" className="text-sm font-medium">{error}</IonText>
                                    </div>
                                )}

                                <IonButton
                                    expand="block"
                                    className="login-button mt-4"
                                    onClick={handleRegister}
                                    disabled={isLoading || !!usernameError || !!emailError}
                                >
                                    {isLoading ? <IonSpinner name="crescent" /> : 'Sign Up'}
                                </IonButton>

                                <div className="text-center mt-2">
                                    <p className="text-gray-500 text-sm">
                                        Already have an account?{' '}
                                        <button className="text-indigo-600 font-semibold" onClick={() => history.replace('/login')}>
                                            Sign In
                                        </button>
                                    </p>
                                </div>
                            </div>
                        ) : (
                            // --- VIEW 2: VERIFICATION CODE INPUT ---
                            <div className="space-y-4">
                                <p className="text-center text-gray-500 text-sm">
                                    We sent a 6-digit code to <span className="font-bold">{email}</span>
                                </p>
                                <p className="text-center text-xs text-gray-400">
                                    (If you don't see it, please check your Spam/Junk folder)
                                </p>

                                <div className="flex items-center bg-gray-100 rounded-2xl px-4 py-3 border-2 border-indigo-100">
                                    <IonInput
                                        className="text-center text-2xl tracking-widest font-bold"
                                        placeholder="000000"
                                        maxlength={6}
                                        type="tel"
                                        value={verificationCode}
                                        onIonInput={e => setVerificationCode(e.detail.value!)}
                                    />
                                </div>

                                {error && (
                                    <div className="text-center">
                                        <IonText color="danger" className="text-sm font-medium">{error}</IonText>
                                    </div>
                                )}

                                <IonButton expand="block" color="success" onClick={handleVerify} disabled={isLoading}>
                                    {isLoading ? <IonSpinner name="crescent" /> : 'Verify Account'}
                                </IonButton>

                                <IonButton fill="clear" size="small" expand="block" onClick={() => setIsVerifying(false)}>
                                    Change Email / Edit Details
                                </IonButton>
                            </div>
                        )}
                    </div>
                </div>

                {/* Email Taken Alert */}
                <IonAlert
                    isOpen={showEmailTakenAlert}
                    onDidDismiss={() => setShowEmailTakenAlert(false)}
                    header="Account Exists"
                    subHeader="This email is already registered."
                    message="Would you like to log in instead?"
                    buttons={[
                        {
                            text: 'Cancel',
                            role: 'cancel',
                            handler: () => {
                                setEmail('');
                            }
                        },
                        {
                            text: 'Go to Login',
                            handler: () => {
                                history.replace('/login');
                            }
                        }
                    ]}
                />

                {/* University Info Modal */}
                <IonAlert
                    isOpen={showUniversityInfo}
                    onDidDismiss={() => setShowUniversityInfo(false)}
                    header="Supported Universities"
                    message={
                        universities.length > 0
                            ? `We support students from: ${universities.join(', ')}`
                            : 'Loading supported universities...'
                    }
                    buttons={['Close']}
                />

                <IonToast
                    isOpen={toast.show}
                    onDidDismiss={() => setToast({ ...toast, show: false })}
                    message={toast.msg}
                    duration={2000}
                    color={toast.color}
                    position="top"
                />
            </IonContent>
        </IonPage>
    );
};

export default SignupPage;