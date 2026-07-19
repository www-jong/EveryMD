# EveryMD

모두를 위한 마크다운 에디터

## 소개

EveryMD는 Typora에서 영감을 받은 크로스플랫폼(Windows, macOS) WYSIWYG 마크다운 에디터입니다.

## 기술 스택

- **프레임워크**: [Tauri 2.x](https://tauri.app/) (경량 크로스플랫폼)
- **프론트엔드**: React 19 + TypeScript + Vite
- **에디터 엔진**: [Milkdown Crepe](https://milkdown.dev/) (ProseMirror 기반 WYSIWYG)
- **상태 관리**: Zustand
- **백엔드**: Rust

## 주요 기능

- 📝 WYSIWYG 마크다운 편집 (실시간 미리보기)
- 📂 파일 열기/저장/새로 만들기
- 🌙 다크 모드 / ☀️ 라이트 모드
- 📑 다중 탭 시스템
- 🗂️ 사이드바 파일 탐색기
- ⌨️ 단축키 지원
- 🪶 경량 (~10MB 바이너리)

## 개발

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run tauri dev

# 프로덕션 빌드
npm run tauri build
```

## 요구사항

- Node.js >= 20
- Rust toolchain (rustup)
- Windows 10+ (WebView2) / macOS 10.15+

## 라이선스

MIT
