import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonPage, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';

/* Core Ionic CSS */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/* Tailwind CSS */
import './theme/tailwind.css';

/* Custom theme variables */
import './theme/variables.css';

/* Pages */
import MainTabs from './pages/MainTabs';
import DiagnosisPage from './pages/DiagnosisPage';
import HomeTab from './pages/HomeTab';
import LoginPage from './pages/LoginPage';
import SignupPage from "./pages/SignupPage";
import SettingsPage from "./pages/SettingsPage";
import ClassPage from './pages/ClassPage';
import PrivateRoute from './components/PrivateRoute';
import ValidationQuestionnaire from './components/ValidationQuestionnaire';

setupIonicReact({
  mode: 'ios', // Consistent iOS-like transitions across platforms
  animated: true,
});

// Helper function to check if user is authenticated
const isAuthenticated = (): boolean => {
  const token = localStorage.getItem('token');
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;
    return Date.now() < exp;
  } catch {
    return false;
  }
};

// Smart redirect component - redirects based on auth status
const SmartRedirect: React.FC = () => {
  return isAuthenticated() ? <Redirect to="/tabs/home" /> : <Redirect to="/login" />;
};

const App: React.FC = () => {
  return (
    <IonApp>
      <IonReactRouter basename="/aiinference/4">
        <IonRouterOutlet>
          {/* Public routes */}
          <Route path="/login" component={LoginPage} exact />
          <Route path="/signup" component={SignupPage} exact />

          {/* Tutorial preview routes (no login required) — for previewing the onboarding tour */}
          <Route path="/tour-preview/home" exact render={(props) => <HomeTab {...props} tourPreview />} />
          <Route path="/tour-preview/chat" exact render={(props) => <DiagnosisPage {...props} tourPreview />} />

          {/* Validation questionnaire preview (no login required) */}
          <Route path="/tour-preview/questionnaire" exact render={() => (
            <IonPage>
              <ValidationQuestionnaire
                isOpen
                previewMode
                diagnosisName="Irreversible Pulpitis"
                onSubmit={() => window.alert('Previzualizare: răspunsurile ar fi trimise (nu se salvează nimic aici).')}
              />
            </IonPage>
          )} />

          {/* Protected routes - require JWT token */}
          <PrivateRoute path="/tabs" component={MainTabs} />
          <PrivateRoute path="/diagnosis/:caseId?" component={DiagnosisPage} exact />
          <PrivateRoute path="/settings" component={SettingsPage} exact />
          <PrivateRoute path="/class/:classId" component={ClassPage} exact />

          {/* Default redirect */}
          <Route exact path="/">
            <SmartRedirect />
          </Route>

          {/* Catch-all route for unknown paths */}
          <Route render={() => <SmartRedirect />} />
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
