import React from 'react';

interface TransactionAnimationProps {
  isSuccess?: boolean;
}

const TransactionAnimation: React.FC<TransactionAnimationProps> = ({ isSuccess = true }) => {
  const baseColor = isSuccess ? '#CE9F48' : '#ef4444';
  const lightColor = isSuccess ? '#f5e6c0' : '#fecaca';
  const mediumColor = isSuccess ? '#d4a843' : '#f87171';
  const darkColor = isSuccess ? '#a07830' : '#dc2626';
  const shadowColor = isSuccess ? 'rgba(206, 159, 72, 0.6)' : 'rgba(239, 68, 68, 0.6)';
  const dollarColor = isSuccess ? '#7a5820' : '#991b1b';

  return (
    <div className="transaction-container">
      <div className="transaction-left-side" style={{ backgroundColor: baseColor }}>
        <div className="transaction-card" style={{
          backgroundColor: lightColor,
          boxShadow: `9px 9px 9px -2px ${shadowColor}`
        }}>
          <div className="transaction-card-line" style={{ backgroundColor: mediumColor }}></div>
          <div className="transaction-buttons" style={{
            backgroundColor: darkColor,
            boxShadow: `0 -10px 0 0 ${darkColor}, 0 10px 0 0 ${mediumColor}`
          }}></div>
        </div>
        <div className="transaction-post">
          <div className="transaction-post-line"></div>
          <div className="transaction-screen">
            <div className="transaction-dollar" style={{ color: dollarColor }}>$</div>
          </div>
          <div className="transaction-numbers"></div>
          <div className="transaction-numbers-line2"></div>
        </div>
      </div>
      <div className="transaction-right-side">
        <svg viewBox="0 0 451.846 451.847" height="512" width="512" xmlns="http://www.w3.org/2000/svg" className="transaction-arrow">
          <path fill="#CE9F48" d="M345.441 248.292L151.154 442.573c-12.359 12.365-32.397 12.365-44.75 0-12.354-12.354-12.354-32.391 0-44.744L278.318 225.92 106.409 54.017c-12.354-12.359-12.354-32.394 0-44.748 12.354-12.359 32.391-12.359 44.75 0l194.287 194.284c6.177 6.18 9.262 14.271 9.262 22.366 0 8.099-3.091 16.196-9.267 22.373z"></path>
        </svg>
      </div>

      <style>{`
        .transaction-container {
          background-color: #1a1208;
          border: 1px solid rgba(206, 159, 72, 0.2);
          display: flex;
          width: 100%;
          max-width: 460px;
          min-width: 280px;
          height: 120px;
          position: relative;
          border-radius: 12px;
          animation: slideInScale 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55),
                     autoExpand 1s 0.8s ease-in-out forwards;
          box-shadow: 0 20px 60px rgba(206, 159, 72, 0.15);
          margin: 0 auto;
        }

        @keyframes slideInScale {
          0% { opacity: 0; transform: scale(0.5) translateY(-20px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }

        @keyframes autoExpand {
          0% { transform: scale(1); }
          100% { transform: scale(1.03); }
        }

        .transaction-container .transaction-left-side {
          animation: autoExpandLeft 1s 0.8s ease-in-out forwards;
        }

        @keyframes autoExpandLeft {
          0% { width: 130px; }
          100% { width: 100%; }
        }

        .transaction-left-side {
          width: 130px;
          min-width: 130px;
          height: 120px;
          border-radius: 10px;
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          flex-shrink: 0;
          overflow: hidden;
        }

        .transaction-right-side {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          padding: 0 10px;
        }

        .transaction-arrow {
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          animation: slideInFromRight 0.8s 1.0s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }

        @keyframes slideInFromRight {
          0% { opacity: 0; transform: translateX(30px) scale(0.8); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }

        .transaction-card {
          width: 70px;
          height: 46px;
          border-radius: 6px;
          position: absolute;
          display: flex;
          z-index: 10;
          flex-direction: column;
          align-items: center;
          animation: slide-top 1.2s 1.5s cubic-bezier(0.645, 0.045, 0.355, 1) both;
        }

        .transaction-card-line {
          width: 65px;
          height: 13px;
          border-radius: 2px;
          margin-top: 7px;
        }

        .transaction-buttons {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          transform: rotate(90deg);
          margin: 10px 0 0 -30px;
        }

        @keyframes slide-top {
          0% { transform: translateY(0); }
          50% { transform: translateY(-70px) rotate(90deg); }
          60% { transform: translateY(-70px) rotate(90deg); }
          100% { transform: translateY(-8px) rotate(90deg); }
        }

        .transaction-post {
          width: 63px;
          height: 75px;
          background-color: #2a2010;
          position: absolute;
          z-index: 11;
          bottom: 10px;
          top: 120px;
          border-radius: 6px;
          overflow: hidden;
          animation: slide-post 1s 2s cubic-bezier(0.165, 0.84, 0.44, 1) both;
        }

        .transaction-post-line {
          width: 47px;
          height: 9px;
          background-color: #3a3020;
          position: absolute;
          border-radius: 0px 0px 3px 3px;
          right: 8px;
          top: 8px;
        }

        .transaction-post-line:before {
          content: "";
          position: absolute;
          width: 47px;
          height: 9px;
          background-color: #4a4030;
          top: -8px;
        }

        .transaction-screen {
          width: 47px;
          height: 23px;
          background-color: #1a1208;
          position: absolute;
          top: 22px;
          right: 8px;
          border-radius: 3px;
          border: 1px solid rgba(206, 159, 72, 0.3);
        }

        .transaction-numbers {
          width: 12px;
          height: 12px;
          background-color: #4a4030;
          box-shadow: 0 -18px 0 0 #4a4030, 0 18px 0 0 #4a4030;
          border-radius: 2px;
          position: absolute;
          transform: rotate(90deg);
          left: 25px;
          top: 52px;
        }

        .transaction-numbers-line2 {
          width: 12px;
          height: 12px;
          background-color: #3a3020;
          box-shadow: 0 -18px 0 0 #3a3020, 0 18px 0 0 #3a3020;
          border-radius: 2px;
          position: absolute;
          transform: rotate(90deg);
          left: 25px;
          top: 68px;
        }

        @keyframes slide-post {
          50% { transform: translateY(0); }
          100% { transform: translateY(-70px); }
        }

        .transaction-dollar {
          position: absolute;
          font-size: 16px;
          font-family: "Inter", sans-serif;
          width: 100%;
          left: 0;
          top: 0;
          text-align: center;
          font-weight: bold;
          animation: fade-in-fwd 0.3s 2.8s backwards;
        }

        @keyframes fade-in-fwd {
          0% { opacity: 0; transform: translateY(-5px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @media only screen and (max-width: 640px) {
          .transaction-container { max-width: 90vw; min-width: 260px; height: 100px; margin: 0 10px; }
          .transaction-left-side { width: 110px; min-width: 110px; height: 100px; }
          .transaction-arrow { width: 16px; height: 16px; }
          .transaction-card { width: 60px; height: 40px; }
          .transaction-card-line { width: 55px; height: 11px; }
          .transaction-post { width: 55px; height: 65px; }
          .transaction-post-line { width: 40px; }
          .transaction-screen { width: 40px; height: 20px; }
          .transaction-dollar { font-size: 14px; }
        }
      `}</style>
    </div>
  );
};

export default TransactionAnimation;
