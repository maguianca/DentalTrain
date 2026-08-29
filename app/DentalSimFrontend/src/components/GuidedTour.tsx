import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { IonIcon } from '@ionic/react';
import { arrowForwardOutline, arrowBackOutline, closeOutline } from 'ionicons/icons';

export interface TourStep {
    /** CSS selector of the element to highlight, e.g. '[data-tour="begin-case"]' */
    selector: string;
    title: string;
    /** Plain text, or rich JSX (paragraphs, <strong>, etc.) for richer steps. */
    description: React.ReactNode;
}

interface GuidedTourProps {
    steps: TourStep[];
    isOpen: boolean;
    onClose: () => void;
}

interface Rect {
    top: number;
    left: number;
    width: number;
    height: number;
}

// How much breathing room to leave around the highlighted element.
const PADDING = 8;

const GuidedTour: React.FC<GuidedTourProps> = ({ steps, isOpen, onClose }) => {
    const [current, setCurrent] = useState(0);
    const [rect, setRect] = useState<Rect | null>(null);

    // Always start from the first step whenever the tour is (re)opened.
    useEffect(() => {
        if (isOpen) setCurrent(0);
    }, [isOpen]);

    // Find the current target element, scroll it into view and measure it.
    const measure = useCallback(() => {
        const step = steps[current];
        if (!step) return;
        const el = document.querySelector(step.selector) as HTMLElement | null;
        if (!el) {
            setRect(null);
            return;
        }
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        // Wait for the (possible) scroll to settle before measuring.
        window.setTimeout(() => {
            const r = el.getBoundingClientRect();
            setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }, 320);
    }, [current, steps]);

    useEffect(() => {
        if (!isOpen) return;
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [isOpen, current, measure]);

    if (!isOpen) return null;

    const step = steps[current];
    if (!step) return null;

    const isLast = current === steps.length - 1;
    const isFirst = current === 0;

    const next = () => (isLast ? onClose() : setCurrent((c) => c + 1));
    const back = () => setCurrent((c) => Math.max(0, c - 1));

    // Decide where to place the explanation card relative to the target.
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const TOOLTIP_W = Math.min(320, vw - 32);

    // Cap the card to the viewport height and let its own content scroll,
    // so a long description scrolls inside the card instead of the page behind it.
    // Use window.innerHeight (px) rather than the 100vh CSS unit: on mobile
    // browsers 100vh can be taller than the actually-visible area, which would
    // make the card "fit" by CSS's measure while still overflowing the screen.
    const scrollableCard: React.CSSProperties = {
        maxHeight: vh - 32,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
    };

    let tooltipStyle: React.CSSProperties;
    if (rect) {
        const spaceBelow = vh - (rect.top + rect.height);
        const placeBelow = spaceBelow > 200;
        const top = placeBelow
            ? rect.top + rect.height + PADDING + 12
            : rect.top - PADDING - 12;
        let left = rect.left + rect.width / 2 - TOOLTIP_W / 2;
        left = Math.max(16, Math.min(left, vw - TOOLTIP_W - 16));
        tooltipStyle = {
            position: 'fixed',
            top,
            left,
            width: TOOLTIP_W,
            transform: placeBelow ? 'none' : 'translateY(-100%)',
            zIndex: 2,
            ...scrollableCard,
        };
    } else {
        // No target found: anchor near the top of the screen so a tall card
        // (e.g. the welcome message) fits within the viewport and can scroll.
        tooltipStyle = {
            position: 'fixed',
            top: 16,
            left: vw / 2 - TOOLTIP_W / 2,
            width: TOOLTIP_W,
            zIndex: 2,
            ...scrollableCard,
        };
    }

    // Render into <body>, outside the Ionic page (which uses `contain: layout`
    // and would otherwise turn our `position: fixed` overlay into something
    // positioned relative to the page rather than the actual viewport).
    return createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 100000 }}>
            {/* Transparent backdrop: blocks clicks on the page behind the tour. */}
            <div
                onClick={(e) => e.stopPropagation()}
                style={{ position: 'fixed', inset: 0, cursor: 'default' }}
            />

            {/* Spotlight: a transparent "hole" with a huge shadow that dims everything else. */}
            {rect ? (
                <div
                    style={{
                        position: 'fixed',
                        top: rect.top - PADDING,
                        left: rect.left - PADDING,
                        width: rect.width + PADDING * 2,
                        height: rect.height + PADDING * 2,
                        borderRadius: 14,
                        boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.72)',
                        transition: 'all 0.3s ease',
                        pointerEvents: 'none',
                    }}
                />
            ) : (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15, 23, 42, 0.72)',
                        pointerEvents: 'none',
                    }}
                />
            )}

            {/* Explanation card */}
            <div style={tooltipStyle} className="bg-white rounded-2xl shadow-2xl p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-base font-bold text-gray-900">{step.title}</h3>
                    <button
                        onClick={onClose}
                        aria-label="Close tutorial"
                        className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                    >
                        <IonIcon icon={closeOutline} className="text-xl" />
                    </button>
                </div>

                <div className="text-sm text-gray-600 leading-relaxed space-y-2">{step.description}</div>

                <div className="flex items-center justify-between mt-4">
                    <span className="text-xs text-gray-400">
                        {current + 1} / {steps.length}
                    </span>
                    <div className="flex items-center gap-2">
                        {!isFirst && (
                            <button
                                onClick={back}
                                className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-gray-100 text-gray-600 text-sm font-medium"
                            >
                                <IonIcon icon={arrowBackOutline} />
                                Back
                            </button>
                        )}
                        <button
                            onClick={next}
                            className="inline-flex items-center gap-1 px-4 py-2 rounded-full bg-indigo-600 text-white text-sm font-semibold"
                        >
                            {isLast ? 'Done' : 'Next'}
                            {!isLast && <IonIcon icon={arrowForwardOutline} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default GuidedTour;
