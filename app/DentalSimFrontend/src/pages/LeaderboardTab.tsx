import React, { useState } from 'react';
import {
    IonPage,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonAvatar,
    IonLabel,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    useIonViewWillEnter,
} from '@ionic/react';
import { trophy, medal, flame } from 'ionicons/icons';
import { API_BASE_URL } from '../config';
const LeaderboardTab: React.FC = () => {
    const [timeFilter, setTimeFilter] = useState<string>('all');
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [currentUsername, setCurrentUsername] = useState<string>('');

    useIonViewWillEnter(() => {
        fetchLeaderboard();
        const user = localStorage.getItem('user');
        if (user) {
            setCurrentUsername(JSON.parse(user).username);
        }
    });

    const fetchLeaderboard = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/leaderboard`);
            if (response.ok) {
                const data = await response.json();
                setLeaderboard(data);
            }
        } catch (err) {
            console.error("Failed to fetch leaderboard", err);
        }
    };

    const getRankIcon = (rank: number) => {
        if (rank === 1) return <IonIcon icon={trophy} className="text-yellow-500 text-2xl" />;
        if (rank === 2) return <IonIcon icon={medal} className="text-gray-400 text-2xl" />;
        if (rank === 3) return <IonIcon icon={medal} className="text-orange-500 text-2xl" />;
        return <span className="text-gray-500 font-bold w-6 text-center">{rank}</span>;
    };

    const getAvatarColor = (name: string): string => {
        const colors = ['bg-indigo-500', 'bg-emerald-500', 'bg-pink-500', 'bg-purple-500', 'bg-blue-500', 'bg-amber-500'];
        return colors[name.charCodeAt(0) % colors.length];
    };

    const first = leaderboard[0];
    const second = leaderboard[1];
    const third = leaderboard[2];

    return (
        <IonPage>
            <IonHeader className="ion-no-border">
                <IonToolbar className="dentsim-toolbar">
                    <IonTitle className="text-center font-bold text-xl">Leaderboard</IonTitle>
                </IonToolbar>
            </IonHeader>

            <IonContent fullscreen className="dentsim-content">
                <div className="px-4 pt-4 pb-2">
                    <IonSegment value={timeFilter} onIonChange={(e) => setTimeFilter(e.detail.value as string)} className="leaderboard-segment">
                        <IonSegmentButton value="all"><span className="text-sm font-medium">All Time</span></IonSegmentButton>
                    </IonSegment>
                </div>

                {/* Top 3 Podium */}
                {leaderboard.length > 0 && (
                    <div className="px-4 py-8">
                        <div className="flex items-end justify-center gap-4">

                            {/* 2nd Place */}
                            <div className="flex flex-col items-center w-1/3">
                                {second && (
                                    <>
                                        <IonAvatar className="w-14 h-14 ring-4 ring-gray-200 mb-2 overflow-hidden">
                                            {/* FIX: added rounded-full */}
                                            <div className={`w-full h-full ${getAvatarColor(second.username)} flex items-center justify-center text-white font-bold rounded-full`}>
                                                {second.username.charAt(0).toUpperCase()}
                                            </div>
                                        </IonAvatar>
                                        <p className="font-bold text-gray-700 text-sm truncate w-full text-center">{second.username}</p>
                                        <p className="text-xs text-gray-500">{second.xp} XP</p>
                                        <div className="w-full h-16 bg-gray-200 rounded-t-lg mt-2 flex items-center justify-center text-gray-400 font-bold">2</div>
                                    </>
                                )}
                            </div>

                            {/* 1st Place */}
                            <div className="flex flex-col items-center w-1/3 -mt-4">
                                {first && (
                                    <>
                                        <div className="relative">
                                            <IonIcon icon={trophy} className="absolute -top-6 left-1/2 -translate-x-1/2 text-yellow-400 text-2xl" />
                                            <IonAvatar className="w-20 h-20 ring-4 ring-yellow-300 mb-2 overflow-hidden">
                                                {/* FIX: added rounded-full */}
                                                <div className={`w-full h-full ${getAvatarColor(first.username)} flex items-center justify-center text-white font-bold text-2xl rounded-full`}>
                                                    {first.username.charAt(0).toUpperCase()}
                                                </div>
                                            </IonAvatar>
                                        </div>
                                        <p className="font-bold text-gray-800 truncate w-full text-center">{first.username}</p>
                                        <p className="text-sm text-yellow-600 font-bold">{first.xp} XP</p>
                                        <div className="w-full h-24 bg-gradient-to-b from-yellow-300 to-yellow-400 rounded-t-lg mt-2 flex items-center justify-center text-white font-bold text-xl">1</div>
                                    </>
                                )}
                            </div>

                            {/* 3rd Place */}
                            <div className="flex flex-col items-center w-1/3">
                                {third && (
                                    <>
                                        <IonAvatar className="w-14 h-14 ring-4 ring-orange-200 mb-2 overflow-hidden">
                                            {/* FIX: added rounded-full */}
                                            <div className={`w-full h-full ${getAvatarColor(third.username)} flex items-center justify-center text-white font-bold rounded-full`}>
                                                {third.username.charAt(0).toUpperCase()}
                                            </div>
                                        </IonAvatar>
                                        <p className="font-bold text-gray-700 text-sm truncate w-full text-center">{third.username}</p>
                                        <p className="text-xs text-gray-500">{third.xp} XP</p>
                                        <div className="w-full h-12 bg-orange-200 rounded-t-lg mt-2 flex items-center justify-center text-orange-400 font-bold">3</div>
                                    </>
                                )}
                            </div>

                        </div>
                    </div>
                )}

                {/* Full Leaderboard List */}
                <div className="bg-white rounded-t-3xl pt-4 min-h-full shadow-lg">
                    <h3 className="px-6 font-bold text-gray-800 mb-2">Rankings</h3>
                    <IonList className="leaderboard-list px-2">
                        {leaderboard.map((entry) => (
                            <IonItem
                                key={entry.id}
                                className={`leaderboard-item mb-2 rounded-xl ${
                                    entry.username === currentUsername ? 'bg-indigo-50 border-2 border-indigo-100' : ''
                                }`}
                                lines="none"
                            >
                                <div slot="start" className="w-8 flex justify-center">
                                    {getRankIcon(entry.rank)}
                                </div>

                                <IonAvatar slot="start" className="w-10 h-10 mr-3 overflow-hidden">
                                    {/* FIX: added rounded-full */}
                                    <div className={`w-full h-full ${getAvatarColor(entry.username)} flex items-center justify-center text-white font-bold text-sm rounded-full`}>
                                        {entry.username.charAt(0).toUpperCase()}
                                    </div>
                                </IonAvatar>

                                <IonLabel>
                                    <h2 className={`font-bold ${entry.username === currentUsername ? 'text-indigo-700' : 'text-gray-800'}`}>
                                        {entry.username}
                                        {entry.username === currentUsername && <span className="ml-2 text-[10px] bg-indigo-200 text-indigo-800 px-1.5 py-0.5 rounded">YOU</span>}
                                    </h2>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <span className="text-xs text-gray-500">Lvl {entry.level}</span>
                                        {entry.streak > 0 && (
                                            <span className="flex items-center text-xs text-orange-500 font-medium">
                        <IonIcon icon={flame} className="mr-0.5 text-[10px]" />
                                                {entry.streak}
                      </span>
                                        )}
                                    </div>
                                </IonLabel>

                                <div slot="end" className="text-right">
                                    <p className="font-bold text-indigo-600">{entry.xp.toLocaleString()}</p>
                                    <p className="text-[10px] text-gray-400">XP</p>
                                </div>
                            </IonItem>
                        ))}
                    </IonList>

                    {leaderboard.length === 0 && (
                        <div className="text-center py-10 text-gray-400">
                            No players yet. Be the first!
                        </div>
                    )}
                </div>
            </IonContent>
        </IonPage>
    );
};

export default LeaderboardTab;