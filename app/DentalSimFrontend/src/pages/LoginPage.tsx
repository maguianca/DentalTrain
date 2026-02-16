import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
    IonPage,
    IonContent,
    IonButton,
    IonInput,
    IonIcon,
    IonSpinner,
    IonText,
    IonToast,
    IonAlert,
} from '@ionic/react';
import { mailOutline, lockClosedOutline } from 'ionicons/icons';

import logoImg from '../assets/NoBackground.png';
import { API_BASE_URL } from '../config';

const LoginPage: React.FC = () => {
    const history = useHistory();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showToast, setShowToast] = useState(false);

    // NEW: Handle unverified account
    const [showVerificationAlert, setShowVerificationAlert] = useState(false);
    const [unverifiedEmail, setUnverifiedEmail] = useState('');

    const handleLogin = async () => {
        if (!email || !password) {
            setError('Please enter both username/email and password.');
            return;
        }

        setError('');
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: email,
                    password: password
                }),
            });

            const data = await response.json();

            // FIXED: Handle unverified account
            if (response.status === 403 && !data.is_verified) {
                setUnverifiedEmail(data.email);
                setShowVerificationAlert(true);
                setIsLoading(false);
                return;
            }

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // FIXED: Store complete user data including email, university, etc.
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));

            setShowToast(true);

            setTimeout(() => {
                history.replace('/tabs/home');
            }, 500);

        } catch (err: any) {
            setError(err.message || 'Unable to connect to server');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <IonPage>
            <IonContent fullscreen className="login-content">
                <div className="flex flex-col justify-center px-6 py-12 min-h-screen">

                    {/* Logo & Title */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-50 h-50 bg-gradient-to-br rounded-2xl flex items-center justify-center shadow-lg mb-4 overflow-hidden">
                            <img
                                src={logoImg}
                                alt="DentSim Logo"
                                className="w-40 h-40 object-contain"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                    (e.target as HTMLImageElement).parentElement!.innerHTML =
                                        '<span class="text-5xl">🦷</span>';
                                }}
                            />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-800 mb-2">Welcome Back</h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Master dental diagnosis through AI-powered practice
                        </p>
                    </div>

                    {/* Login Form */}
                    <div className="bg-white rounded-3xl shadow-lg p-6 mb-6">
                        <div className="space-y-4">

                            <div className="login-input-group">
                                <div className="flex items-center bg-gray-100 rounded-2xl px-4 py-1">
                                    <IonIcon
                                        icon={mailOutline}
                                        className="text-gray-400 text-xl mr-3"
                                    />
                                    <IonInput
                                        type="text"
                                        placeholder="Username or Email"
                                        value={email}
                                        onIonInput={(e) => setEmail(e.detail.value || '')}
                                        className="login-input"
                                    />
                                </div>
                            </div>

                            <div className="login-input-group">
                                <div className="flex items-center bg-gray-100 rounded-2xl px-4 py-1">
                                    <IonIcon
                                        icon={lockClosedOutline}
                                        className="text-gray-400 text-xl mr-3"
                                    />
                                    <IonInput
                                        type="password"
                                        placeholder="Password"
                                        value={password}
                                        onIonInput={(e) => setPassword(e.detail.value || '')}
                                        className="login-input"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="text-center">
                                    <IonText color="danger" className="text-sm font-medium">
                                        {error}
                                    </IonText>
                                </div>
                            )}

                            <IonButton
                                expand="block"
                                className="login-button mt-4"
                                onClick={handleLogin}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <IonSpinner name="crescent" className="mr-2" />
                                ) : null}
                                {isLoading ? 'Signing in...' : 'Sign In'}
                            </IonButton>
                        </div>
                    </div>

                    {/* Sign Up Link */}
                    <div className="text-center">
                        <p className="text-gray-500">
                            Don't have an account?{' '}
                            <button className="text-indigo-600 font-semibold" onClick={() => history.push('/signup')}>
                                Sign Up
                            </button>
                        </p>
                    </div>
                </div>

                {/* Success Toast */}
                <IonToast
                    isOpen={showToast}
                    onDidDismiss={() => setShowToast(false)}
                    message="Welcome back!"
                    duration={1500}
                    color="success"
                    position="top"
                />

                {/* NEW: Unverified Account Alert */}
                <IonAlert
                    isOpen={showVerificationAlert}
                    onDidDismiss={() => setShowVerificationAlert(false)}
                    header="Account Not Verified"
                    subHeader="Please verify your email"
                    message={`A verification code was sent to ${unverifiedEmail}. Please check your email (including spam folder) and verify your account.`}
                    buttons={[
                        {
                            text: 'OK',
                            role: 'cancel',
                        },
                        {
                            text: 'Go to Verification',
                            handler: () => {
                                // Pass the unverified email and a flag to the Signup page
                                history.push({
                                    pathname: '/signup',
                                    state: {
                                        verifyEmail: unverifiedEmail,
                                        startVerification: true
                                    }
                                });
                            }
                        }
                    ]}
                />
            </IonContent>
        </IonPage>
    );
};

export default LoginPage;