// @ts-ignore
import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
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
import LoginPage from './pages/LoginPage';
import SignupPage from "./pages/SignupPage";
import SettingsPage from "./pages/SettingsPage";
import ClassPage from './pages/ClassPage';

setupIonicReact({
  mode: 'ios', // Consistent iOS-like transitions across platforms
  animated: true,
});

const App: React.FC = () => {
  return (
    <IonApp>
      <IonReactRouter>
        <IonRouterOutlet>
            <Route path="/login" component={LoginPage} exact />
            <Route path="/signup" component={SignupPage} exact />
            <Route path="/tabs" component={MainTabs} />
            <Route path="/diagnosis/:caseId?" component={DiagnosisPage} exact />
            <Route path="/settings" component={SettingsPage} exact />
            <Route path="/class/:classId" component={ClassPage} exact />
            <Redirect exact from="/" to="/login" />
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
