import React from 'react';

interface PoweredByFooterProps {
    /** Use 'light' on dark backgrounds (login/signup), 'default' on normal pages */
    variant?: 'default' | 'light';
}

const PoweredByFooter: React.FC<PoweredByFooterProps> = ({ variant = 'default' }) => {
    const isLight = variant === 'light';

    return (
        <div
            className="powered-by-footer"
            style={{
                textAlign: 'center',
                padding: '16px 12px 20px',
                marginTop: '12px',
            }}
        >
            <p
                style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: isLight ? 'rgba(99,102,241,0.7)' : '#9ca3af',
                    margin: '0 0 2px 0',
                    letterSpacing: '0.3px',
                }}
            >
                Built by Anca Magui, Mădălina Mera &amp; Antonia Moga
            </p>
            <p
                style={{
                    fontSize: '10px',
                    color: isLight ? 'rgba(107,114,128,0.6)' : '#b0b5c0',
                    margin: 0,
                    letterSpacing: '0.2px',
                }}
            >
                🎓 Students at Babeș-Bolyai University, Cluj-Napoca
            </p>
        </div>
    );
};

export default PoweredByFooter;
