import React from 'react';
import { IonIcon, IonProgressBar, IonRippleEffect } from '@ionic/react';
import { lockClosed, checkmarkCircle } from 'ionicons/icons';
import { Badge, getBadgeRarityGradient, getBadgeRarityColor } from '../services/BadgeService';

interface BadgeComponentProps {
  badge: Badge;
  size?: 'small' | 'medium' | 'large';
  showProgress?: boolean;
  onClick?: (badge: Badge) => void;
}

const BadgeComponent: React.FC<BadgeComponentProps> = ({
  badge,
  size = 'medium',
  showProgress = true,
  onClick,
}) => {
  const isEarned = badge.earnedAt !== undefined;
  const progress = badge.progress || 0;

  // Size configurations
  const sizeClasses = {
    small: {
      container: 'w-20 h-24',
      icon: 'text-2xl',
      iconContainer: 'w-12 h-12',
      name: 'text-xs',
      ribbon: 'text-[8px] px-1.5 py-0.5',
    },
    medium: {
      container: 'w-28 h-32',
      icon: 'text-3xl',
      iconContainer: 'w-16 h-16',
      name: 'text-sm',
      ribbon: 'text-[10px] px-2 py-0.5',
    },
    large: {
      container: 'w-36 h-40',
      icon: 'text-4xl',
      iconContainer: 'w-20 h-20',
      name: 'text-base',
      ribbon: 'text-xs px-2 py-1',
    },
  };

  const currentSize = sizeClasses[size];
  const rarityGradient = getBadgeRarityGradient(badge.rarity);
  const rarityColor = getBadgeRarityColor(badge.rarity);

  const getRarityLabel = (rarity: Badge['rarity']): string => {
    return rarity.charAt(0).toUpperCase() + rarity.slice(1);
  };

  return (
    <div
      className={`
        badge-component relative flex flex-col items-center 
        ${currentSize.container} p-2 rounded-2xl
        ${isEarned ? 'bg-white' : 'bg-gray-100'}
        ${onClick ? 'cursor-pointer ion-activatable overflow-hidden' : ''}
        transition-all duration-200 hover:scale-105
        shadow-sm hover:shadow-md
      `}
      onClick={() => onClick?.(badge)}
    >
      {onClick && <IonRippleEffect />}

      {/* Badge Icon Container */}
      <div
        className={`
          relative ${currentSize.iconContainer} rounded-full 
          flex items-center justify-center
          ${isEarned ? `bg-gradient-to-br ${rarityGradient}` : 'bg-gray-200'}
          shadow-inner
        `}
      >
        {/* Icon */}
        <span
          className={`
            ${currentSize.icon}
            ${isEarned ? '' : 'grayscale opacity-40'}
          `}
        >
          {badge.icon}
        </span>

        {/* Lock overlay for unearned badges */}
        {!isEarned && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-full">
            <IonIcon
              icon={lockClosed}
              className="text-gray-400 text-lg"
            />
          </div>
        )}

        {/* Checkmark for earned badges */}
        {isEarned && (
          <div
            className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-sm"
            style={{ color: rarityColor }}
          >
            <IonIcon icon={checkmarkCircle} className="text-lg" />
          </div>
        )}

        {/* Shine effect for earned badges */}
        {isEarned && (
          <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
            <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/30 to-transparent rotate-45 animate-shine" />
          </div>
        )}
      </div>

      {/* Badge Name */}
      <p
        className={`
          ${currentSize.name} font-semibold text-center mt-2 
          ${isEarned ? 'text-gray-800' : 'text-gray-400'}
          line-clamp-2 leading-tight
        `}
      >
        {badge.name}
      </p>

      {/* Progress bar for unearned badges with progress */}
      {!isEarned && showProgress && progress > 0 && (
        <div className="w-full mt-1 px-1">
          <IonProgressBar
            value={progress / 100}
            className="badge-progress h-1 rounded-full"
          />
          <p className="text-[10px] text-gray-400 text-center mt-0.5">
            {progress}%
          </p>
        </div>
      )}

      {/* Rarity Ribbon */}
      <div
        className={`
          absolute top-1 right-1 ${currentSize.ribbon} rounded-full
          font-bold uppercase tracking-wide
          ${isEarned ? 'text-white' : 'text-gray-400 bg-gray-200'}
        `}
        style={{
          backgroundColor: isEarned ? rarityColor : undefined,
        }}
      >
        {getRarityLabel(badge.rarity)}
      </div>
    </div>
  );
};

// Badge Detail Modal Content Component
export const BadgeDetail: React.FC<{ badge: Badge; onClose?: () => void }> = ({
  badge,
  onClose,
}) => {
  const isEarned = badge.earnedAt !== undefined;
  const rarityGradient = getBadgeRarityGradient(badge.rarity);
  const rarityColor = getBadgeRarityColor(badge.rarity);

  return (
    <div className="badge-detail p-6 flex flex-col items-center">
      {/* Large Badge Icon */}
      <div
        className={`
          w-32 h-32 rounded-full flex items-center justify-center mb-4
          ${isEarned ? `bg-gradient-to-br ${rarityGradient}` : 'bg-gray-200'}
          shadow-lg
        `}
      >
        <span className={`text-6xl ${isEarned ? '' : 'grayscale opacity-40'}`}>
          {badge.icon}
        </span>
      </div>

      {/* Badge Name */}
      <h2 className="text-2xl font-bold text-gray-800 text-center mb-1">
        {badge.name}
      </h2>

      {/* Rarity Tag */}
      <span
        className="px-3 py-1 rounded-full text-sm font-bold uppercase text-white mb-4"
        style={{ backgroundColor: rarityColor }}
      >
        {badge.rarity}
      </span>

      {/* Description */}
      <p className="text-gray-600 text-center mb-4">{badge.description}</p>

      {/* Requirement */}
      <div className="bg-gray-100 rounded-xl p-4 w-full mb-4">
        <p className="text-sm text-gray-500 text-center">
          <span className="font-semibold">Requirement:</span> {badge.requirement}
        </p>
      </div>

      {/* Status */}
      {isEarned ? (
        <div className="bg-green-50 rounded-xl p-4 w-full text-center">
          <p className="text-green-700 font-semibold">
            ✓ Earned on{' '}
            {badge.earnedAt?.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          <p className="text-green-600 text-sm mt-1">
            +{badge.xpReward} XP Rewarded
          </p>
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-4 w-full">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600 text-sm">Progress</span>
            <span className="text-gray-800 font-semibold">
              {badge.progress || 0}%
            </span>
          </div>
          <IonProgressBar
            value={(badge.progress || 0) / 100}
            className="badge-progress-large h-2 rounded-full"
          />
          <p className="text-amber-600 text-sm text-center mt-3">
            🎁 {badge.xpReward} XP on completion
          </p>
        </div>
      )}
    </div>
  );
};

export default BadgeComponent;
