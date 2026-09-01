import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './styles/editor.css';

// ── 번들 포함 웹폰트 (설치/업데이트 시 인스톨러에 자동 포함됨) ──
// 에디터에서 사용하는 weight만 로드 (400 regular, 700 bold)
import '@fontsource/inter/400.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import '@fontsource/source-code-pro/400.css';
import '@fontsource/source-code-pro/700.css';
import '@fontsource/nanum-gothic/400.css';
import '@fontsource/nanum-gothic/700.css';
// Noto Sans KR: 한국어 포함 → 파일이 크므로 400만 로드
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/700.css';

// WebView 기본 우클릭 메뉴 전역 비활성화 (Windows 우클릭 → 뒤로/새로고침/인쇄 방지)
// 커스텀 context menu가 있는 컴포넌트에서는 이미 e.preventDefault()를 호출하므로 이중 방지 불필요
document.addEventListener('contextmenu', (e) => e.preventDefault());

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('EveryMD Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '40px',
          color: '#CDD6F4',
          backgroundColor: '#1E1E2E',
          height: '100vh',
          fontFamily: 'sans-serif',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '20px'
        }}>
          <h2>EveryMD 실행 중 오류가 발생했습니다.</h2>
          <pre style={{
            backgroundColor: '#181825',
            padding: '20px',
            borderRadius: '6px',
            maxWidth: '90%',
            overflow: 'auto',
            border: '1px solid #313244',
            color: '#F38BA8'
          }}>
            {this.state.error?.toString() || '알 수 없는 오류'}
          </pre>
          <button 
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 20px',
              backgroundColor: '#B4BEFE',
              color: '#1E1E2E',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            새로고침
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
