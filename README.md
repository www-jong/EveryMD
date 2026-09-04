<div align="center">

<img src="./src-tauri/icons/128x128.png" alt="EveryMD Logo" width="96" height="96" />

# EveryMD

**The Lightweight, Distraction-Free WYSIWYG Markdown Editor**  
*모두를 위한 가볍고 직관적인 모던 WYSIWYG 마크다운 에디터*

[![Release](https://img.shields.io/github/v/release/www-jong/EveryMD?color=6366f1&style=flat-square)](https://github.com/www-jong/EveryMD/releases)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue?style=flat-square)](https://github.com/www-jong/EveryMD/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg?style=flat-square)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-orange?style=flat-square&logo=tauri)](https://tauri.app)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)](https://react.dev)
[![Rust](https://img.shields.io/badge/Backend-Rust-black?style=flat-square&logo=rust)](https://www.rust-lang.org)

<p align="center">
  <a href="#-개발-배경-why-everymd">개발 배경</a> •
  <a href="#-핵심-기능-key-features">핵심 기능</a> •
  <a href="#-다운로드-및-설치-download">다운로드</a> •
  <a href="#-단축키-가이드">단축키</a> •
  <a href="#-개발-및-빌드">개발 가이드</a>
</p>

---

</div>

## 💡 개발 배경 (Why EveryMD?)

> **"Typora는 좋은데 굳이 돈까지 내야 하나? 그리고 .md 파일 하나 보려고 VS Code나 PyCharm을 켜야 해?"**

- **무거운 IDE에 대한 피로감**: 마크다운 파일 하나 가볍게 열고 수정하고 싶은데, 매번 수백 MB짜리 VS Code나 PyCharm 같은 무거운 IDE(돼지들)를 띄우는 게 답답했습니다.
- **파편화된 오픈소스 생태계**: 대안을 찾아보면 macOS 전용이거나 Windows 전용으로 갈라져 있어, 여러 OS를 오갈 때마다 사용 경험이 달라지는 불편함이 있었습니다.
- **오픈소스와 AI Agent의 결합**: 뛰어난 오픈소스 위지윅 엔진(Milkdown, ProseMirror)과 향상된 AI 코딩 에이전트의 역량을 결합하여, **Typora 수준의 직관적인 사용감과 초경량 크로스플랫폼 환경을 갖춘 에디터**를 직접 만들었습니다.

### 📊 비교표

| 항목 | **EveryMD** | **무거운 IDE (VS Code, PyCharm)** | **일반 마크다운 뷰어** |
| :--- | :---: | :---: | :---: |
| **실행 속도 및 메모리** | ⚡ **즉시 실행 (~10MB 경량)** | 🐢 수초 소요 (수백 MB 메모리) | ⚡ 빠름 |
| **편집 방식** | 📝 **실시간 인라인 WYSIWYG** | 📄 원본/미리보기 2분할 화면 | 👁️ 단순 뷰어 / 읽기 전용 |
| **수식 & 표 편집** | 📐 **LaTeX 수식 & 스마트 체크박스 표** | 🔌 별도 확장 플러그인 설치 필요 | ⚠️ 부분 지원 |
| **데이터 안전성** | 🛡️ **3-Way Auto-Merge & 미저장 모달** | ⚠️ 외부 충돌 시 덮어쓰기 위험 | ❌ 기능 부재 |
| **크로스플랫폼 일관성** | 🌐 **macOS & Windows 100% 동일 UX** | 🌐 동일 | ❌ OS별 개별 파편화 |

---

## ✨ 핵심 기능 (Key Features)

### 1. 📝 직관적인 실시간 WYSIWYG 에디터
- **인라인 실시간 렌더링**: 마크다운 문법 입력 즉시 서식이 반영되는 매끄러운 타이핑 환경
- **스마트 서식 도구바**: 볼드, 이탤릭, 취소선, 인라인 코드, 제목(H1~H3), 인용구, 목록, 표, 구분선 원클릭 적용
- **실시간 서식 인디케이터**: 커서 위치에 적용된 서식을 상단 도구바에 자동으로 강조 표시
- **콤팩트 인라인 LaTeX 수식 (`∑`)**: 1줄 인라인 수식 생성 및 팝업 실시간 수식 편집기 지원
- **스마트 체크박스 시스템**: 본문 체크리스트 토글 및 **표(Table) 셀 내부 다중 체크박스(`[ ]`)** 연속 삽입 지원
- **로컬 이미지 & 링크 모달**: 파일 탐색기 연동, 실시간 썸네일 미리보기 및 Tauri Asset 보안 프로토콜 기반 렌더링
- **에디터 내부 블록 드래그**: 핸들(`⠿`)과 이미지를 마우스로 끌어서 자유롭게 순서 변경

### 2. 📂 유연한 탭 관리 & 스마트 파일 탐색기
- **탭 더블클릭 파일명 변경**: 상단 탭 제목을 더블클릭하여 데스크톱 전용 `RenameModal`로 파일명 즉시 수정
- **통합 우클릭 컨텍스트 메뉴**: 탭바와 탐색기에서 파일명 변경, 탐색기에서 열기, 복제, 경로 복사 등 통일된 UI 제공
- **미지원 파일 회색 시각화**: `.md`, `.txt` 외의 비편집 파일(이미지, 바이너리 등)은 회색으로 비활성화하여 오작동 차단
- **안전한 탭 닫기 확인 (`UnsavedFilesModal`)**: 수정 중인 파일 닫기 시 [저장] / [저장 안 함] / [취소] 선택 다이얼로그 제공
- **작업 폴더 전환 모달 (`FolderChangeModal`)**: 새 폴더를 열 때 기존 열린 탭 일괄 닫기 또는 유지 지원

### 3. 🛡️ 파일 무손실 보호 & 외부 변경 감지
- **외부 파일 변경 감지 & 3-Way Auto-Merge**: Git이나 외부 에디터에서 파일이 바뀌면 자동 감지하여 병합하고, 충돌 시 Git Diff 스타일 시각화 제공
- **창 전환(Blur) 시 디스크 자동 저장**: 창을 벗어날 때 작성 중인 파일 디스크 자동 저장 (설정 On/Off 가능)
- **디스크 소실 파일 복구**: 외부에서 파일이 지워져도 에디터에 버퍼가 보존되며 `Ctrl+S`로 즉시 재저장 복원

### 4. 🎨 감성적인 디자인 & 커스텀 설정
- **번들 웹폰트 내장**: Inter, Noto Sans KR, 나눔고딕, JetBrains Mono, Source Code Pro 내장 (인터넷 없이 즉시 적용)
- **다크 모드 / 라이트 모드**: 시스템 테마 자동 연동 및 수동 테마 전환
- **앱 자동 업데이트**: GitHub Releases 기반 원클릭 최신 버전 자동 업데이트

---

## 📥 다운로드 및 설치 (Download)

최신 릴리즈 인스톨러는 [GitHub Releases](https://github.com/www-jong/EveryMD/releases)에서 다운로드할 수 있습니다.

| 플랫폼 | 다운로드 파일 |
| :--- | :--- |
| 🍏 **macOS** (Apple Silicon / Intel) | `.dmg` 또는 `.app.tar.gz` |
| 🪟 **Windows** (x64) | `.exe` (Setup 인스톨러) 또는 `.msi` |
| 🐧 **Linux** | `.AppImage` 또는 `.deb` |

> [!TIP]
> **macOS 최초 실행 시 안내**  
> Apple 개발자 인증서 서명이 없는 오픈소스 특성상 Gatekeeper 경고가 발생할 수 있습니다.  
> 터미널에서 다음 명령어를 실행하거나, `시스템 설정` → `개인정보 보호 및 보안`에서 *"확인 없이 열기"*를 클릭하세요.
> ```bash
> xattr -cr /Applications/EveryMD.app
> ```

---

## ⌨️ 단축키 가이드

| 기능 | 단축키 (Windows / Linux) | 단축키 (macOS) |
| :--- | :--- | :--- |
| **새 문서 만들기** | `Ctrl + N` | `Cmd + N` |
| **파일 열기** | `Ctrl + O` | `Cmd + O` |
| **파일 저장** | `Ctrl + S` | `Cmd + S` |
| **다른 이름으로 저장** | `Ctrl + Shift + S` | `Cmd + Shift + S` |
| **굵게 (Bold)** | `Ctrl + B` | `Cmd + B` |
| **기울임 (Italic)** | `Ctrl + I` | `Cmd + I` |
| **취소선 (Strike)** | `Ctrl + Shift + X` | `Cmd + Shift + X` |
| **인라인 코드 (Code)** | `Ctrl + E` | `Cmd + E` |
| **글자 크기 조절** | `Ctrl + 마우스 휠` | `Cmd + 마우스 휠` |

---

## 🚀 개발 및 빌드 (Development)

### 필수 요구사항
- **Node.js**: `>= 20.x`
- **Rust Toolchain**: `stable` (rustup)
- **OS**: Windows 10+ (WebView2) / macOS 10.15+ / Linux

### 실행 명령어
```bash
# 1. 의존성 패키지 설치
npm install

# 2. 로컬 데스크톱 개발 모드 실행
npm run tauri dev

# 3. 배포용 패키지 빌드
npm run tauri build
```

---

## 📄 License

이 프로젝트는 [MIT License](LICENSE)를 따릅니다.  
Copyright © 2026 EveryMD
