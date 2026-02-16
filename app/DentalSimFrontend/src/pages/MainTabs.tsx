import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import {
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonTabBar,
  IonTabButton,
  IonTabs,
} from '@ionic/react';
import { home, trophy, person } from 'ionicons/icons';

/* Tab Pages */
import HomeTab from './HomeTab';
import LeaderboardTab from './LeaderboardTab';
import ProfileTab from './ProfileTab';

const MainTabs: React.FC = () => {
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Redirect exact path="/tabs" to="/tabs/home" />
        <Route path="/tabs/home" component={HomeTab} exact />
        <Route path="/tabs/leaderboard" component={LeaderboardTab} exact />
        <Route path="/tabs/profile" component={ProfileTab} exact />
      </IonRouterOutlet>

      <IonTabBar slot="bottom" className="dentsim-tab-bar" translucent={false}>
        <IonTabButton tab="home" href="/tabs/home">
          <IonIcon icon={home} />
          <IonLabel>Home</IonLabel>
        </IonTabButton>

        <IonTabButton tab="leaderboard" href="/tabs/leaderboard">
          <IonIcon icon={trophy} />
          <IonLabel>Ranks</IonLabel>
        </IonTabButton>

        <IonTabButton tab="profile" href="/tabs/profile">
          <IonIcon icon={person} />
          <IonLabel>Profile</IonLabel>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
};

export default MainTabs;
