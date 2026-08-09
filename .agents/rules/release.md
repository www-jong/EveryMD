# EveryMD 프로젝트 규칙

## 릴리즈 / 버전 업 규칙

- **버전 태그 push 및 GitHub Release 업로드는 사용자가 직접 수행한다.**
- AI는 코드 수정, 빌드 확인(npm run build), 커밋, master push까지만 담당한다.
- 버전 번호 변경(tauri.conf.json, Cargo.toml) 및 CHANGELOG 작성까지는 AI가 준비해도 되지만, `git tag` 및 `git push origin vX.X.X` 는 사용자가 테스트 완료 후 직접 실행한다.
- AI가 태그를 먼저 push하거나 릴리즈를 올리는 행위는 금지.

## 개발/테스트 흐름

1. AI: 코드 수정 → `npm run build` 빌드 확인 → `git commit` → `git push origin master`
2. 사용자: `npm run tauri dev` 로 로컬 테스트
3. 사용자: 이상 없으면 `git tag -a vX.X.X -m "..."` → `git push origin vX.X.X`
4. GitHub Actions가 자동으로 exe/dmg 빌드 후 Release 등록
