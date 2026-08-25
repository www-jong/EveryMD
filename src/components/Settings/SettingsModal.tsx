import React, { useEffect, useRef, useState } from 'react';
import { useSettingsStore, CustomTheme, THEME_PRESETS, ThemeColors, applyThemeColors } from '../../stores/settingsStore';
import { UpdateSection } from './UpdateSection';
import './SettingsModal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'general' | 'shortcuts' | 'theme';

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    fontSize,
    fontFamily,
    autoSave,
    autoSaveDelay,
    wordWrap,
    shortcuts,
    customThemes,
    activeThemeId,
    setFontSize,
    setFontFamily,
    setAutoSave,
    setAutoSaveDelay,
    setWordWrap,
    updateShortcut,
    resetShortcuts,
    setActiveThemeId,
    addCustomTheme,
    updateCustomThemeColors,
    deleteCustomTheme,
    importTheme
  } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [listeningShortcut, setListeningShortcut] = useState<string | null>(null);
  const [themeNameInput, setThemeNameInput] = useState('');
  
  // JSON 파일 업로드 패널
  const [importJsonText, setImportJsonText] = useState('');
  const [showImportArea, setShowImportArea] = useState(false);

  // 로컬 테마 편집용 상태 (즉시 실시간 전체 반영하지 않고, 저장 버튼 클릭 시 반영)
  const [editingColors, setEditingColors] = useState<ThemeColors>(THEME_PRESETS.dark.colors);
  
  // JSON 직접 에디팅 텍스트
  const [jsonEditText, setJsonEditText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement | null>(null);

  // 1. 현재 선택된 테마의 색상 읽기 헬퍼
  const getThemeColors = (themeId: string): ThemeColors => {
    const preset = THEME_PRESETS[themeId];
    if (preset) return preset.colors;
    const custom = customThemes.find(t => t.id === themeId);
    return custom ? custom.colors : THEME_PRESETS.dark.colors;
  };

  // 2. 테마 변경 시 로컬 편집 색상 상태 초기화 동기화
  useEffect(() => {
    if (isOpen) {
      const colors = getThemeColors(activeThemeId);
      setEditingColors(colors);
      setJsonEditText(JSON.stringify(colors, null, 2));
      setJsonError(null);
    }
  }, [activeThemeId, isOpen, customThemes]);

  // ESC 키 및 아웃사이드 클릭 핸들러
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !listeningShortcut) onClose();
    };
    const handleOutsideClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node) && !listeningShortcut) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen, onClose, listeningShortcut]);

  // 단축키 대기 리스너
  useEffect(() => {
    if (!listeningShortcut) return;

    const handleKeyCapture = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const parts: string[] = [];
      const isMac = navigator.userAgent.toLowerCase().includes('mac');
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl) parts.push('ctrl');
      if (e.altKey) parts.push('alt');
      if (e.shiftKey) parts.push('shift');

      let key = e.key.toLowerCase();
      if (key === 'escape') {
        setListeningShortcut(null);
        return;
      }

      if (key !== 'control' && key !== 'shift' && key !== 'alt' && key !== 'meta') {
        parts.push(key);
        const newCombination = parts.join('+');
        updateShortcut(listeningShortcut as any, newCombination);
        setListeningShortcut(null);
      }
    };

    window.addEventListener('keydown', handleKeyCapture, true);
    return () => window.removeEventListener('keydown', handleKeyCapture, true);
  }, [listeningShortcut, updateShortcut]);

  if (!isOpen) return null;

  const shortcutLabels: Record<string, string> = {
    newFile: '새 파일 만들기',
    openFile: '파일 불러오기',
    saveFile: '문서 저장',
    saveAsFile: '다른 이름으로 저장',
    closeTab: '현재 문서 닫기',
    toggleTheme: '테마 토글',
    toggleSidebar: '사이드바 접기/열기',
    openSettings: '설정창 호출'
  };

  // 3. 개별 색상 픽커 수정 시 로컬 상태 및 JSON 텍스트 동기 업데이트
  const handleColorPickerChange = (variable: keyof ThemeColors, newValue: string) => {
    const updatedColors = { ...editingColors, [variable]: newValue };
    setEditingColors(updatedColors);
    setJsonEditText(JSON.stringify(updatedColors, null, 2));
    setJsonError(null);
  };

  // 4. JSON 직접 텍스트 에디터 타이핑 수정 핸들러
  const handleJsonTextareaChange = (value: string) => {
    setJsonEditText(value);
    try {
      const parsed = JSON.parse(value);
      // 색상 키가 온전히 규격을 갖추고 있는지 검증
      const sampleKey: keyof ThemeColors = '--bg-main';
      if (parsed && typeof parsed === 'object' && parsed[sampleKey] !== undefined) {
        setEditingColors(parsed as ThemeColors);
        setJsonError(null);
      } else {
        setJsonError('올바른 테마 색상 JSON 규격이 아닙니다.');
      }
    } catch (err: any) {
      setJsonError('JSON 문법 오류: ' + err.message);
    }
  };

  // 5. 변경된 테마 색상을 실제 전체 프로그램에 적용 및 저장
  const handleSaveAndApplyTheme = () => {
    if (jsonError) {
      alert('올바르지 않은 JSON 문법이 포함되어 저장할 수 없습니다.');
      return;
    }

    if (THEME_PRESETS[activeThemeId]) {
      // 기본 프리셋 상태에서 저장을 누르면 자동으로 "My Custom Theme (커스텀)"이 자동 생성 및 승격
      const id = 'custom_theme_' + Date.now();
      const newTheme: CustomTheme = {
        id,
        name: `${THEME_PRESETS[activeThemeId].name} (커스텀)`,
        isDark: THEME_PRESETS[activeThemeId].isDark,
        colors: { ...editingColors }
      };
      addCustomTheme(newTheme);
      setActiveThemeId(id);
      applyThemeColors(editingColors);
      alert('새 커스텀 테마로 자동 저장되어 적용되었습니다!');
    } else {
      // 기존 커스텀 테마 상태인 경우 덮어쓰기 저장 및 적용
      updateCustomThemeColors(activeThemeId, editingColors);
      applyThemeColors(editingColors);
      alert('테마 수정사항이 성공적으로 저장되어 즉시 적용되었습니다!');
    }
  };

  const handleCreateCustomTheme = () => {
    if (!themeNameInput.trim()) {
      alert('테마 명칭을 입력해 주세요.');
      return;
    }
    const id = 'custom_theme_' + Date.now();
    const newTheme: CustomTheme = {
      id,
      name: themeNameInput.trim(),
      isDark: true,
      colors: { ...editingColors }
    };
    addCustomTheme(newTheme);
    setThemeNameInput('');
  };

  const handleExportTheme = () => {
    const preset = THEME_PRESETS[activeThemeId];
    const themeToExport = preset || customThemes.find(t => t.id === activeThemeId);
    if (!themeToExport) return;

    // 내보낼 때 현재 로컬 편집 상태의 최신 색상으로 내보내기 위해 조절
    const exportData = {
      ...themeToExport,
      colors: editingColors
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${themeToExport.name.replace(/\s+/g, '_')}_theme.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportThemeText = () => {
    if (!importJsonText.trim()) return;
    const success = importTheme(importJsonText.trim());
    if (success) {
      alert('테마를 성공적으로 불러왔습니다!');
      setImportJsonText('');
      setShowImportArea(false);
    } else {
      alert('올바르지 않은 테마 JSON 규격입니다.');
    }
  };

  return (
    <div className="settings-overlay">
      <div className="settings-modal" ref={modalRef}>
        <div className="settings-header">
          <h3>설정 (Preferences)</h3>
          <button className="settings-close-btn" onClick={onClose}>×</button>
        </div>

        <div className="settings-tabs">
          <button className={`tab-btn ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>일반 설정</button>
          <button className={`tab-btn ${activeTab === 'shortcuts' ? 'active' : ''}`} onClick={() => setActiveTab('shortcuts')}>단축키 에디터</button>
          <button className={`tab-btn ${activeTab === 'theme' ? 'active' : ''}`} onClick={() => setActiveTab('theme')}>테마 커스터마이저</button>
        </div>

        <div className="settings-body">
          {/* 일반 설정 */}
          {activeTab === 'general' && (
            <div className="tab-content">
              <div className="setting-row">
                <div className="setting-info">
                  <span className="setting-label">에디터 글꼴 크기</span>
                  <span className="setting-desc">마크다운 문서의 폰트 크기를 조절합니다. ({fontSize}px)</span>
                </div>
                <div className="setting-control">
                  <input 
                    type="range" 
                    min="12" 
                    max="28" 
                    value={fontSize} 
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="fontSize-slider"
                  />
                </div>
              </div>

              <div className="setting-row">
                <div className="setting-info">
                  <span className="setting-label">에디터 글꼴 (Font Family)</span>
                  <span className="setting-desc">에디터 본문에 적용되는 폰트를 선택합니다.</span>
                </div>
                <div className="setting-control">
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="theme-dropdown"
                    style={{ minWidth: '180px' }}
                  >
                    <option value="Inter">Inter (기본)</option>
                    <option value="'Noto Sans KR'">Noto Sans KR (한국어)</option>
                    <option value="'Nanum Gothic'">Nanum Gothic (나눔고딕)</option>
                    <option value="'JetBrains Mono'">JetBrains Mono (코드)</option>
                    <option value="'Source Code Pro'">Source Code Pro (코드)</option>
                    <option value="Georgia, serif">Georgia (serif)</option>
                    <option value="system-ui, sans-serif">시스템 기본 폰트</option>
                  </select>
                </div>
              </div>

              <div className="setting-row">
                <div className="setting-info">
                  <span className="setting-label">자동 줄 바꿈</span>
                  <span className="setting-desc">본문 가로 길이에 맞추어 긴 문장을 줄바꿈 처리합니다.</span>
                </div>
                <div className="setting-control">
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={wordWrap} 
                      onChange={(e) => setWordWrap(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>

              <div className="setting-row">
                <div className="setting-info">
                  <span className="setting-label">자동 저장 (Auto Save)</span>
                  <span className="setting-desc">작성 중인 문서를 백그라운드에서 실시간으로 저장합니다.</span>
                </div>
                <div className="setting-control">
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={autoSave} 
                      onChange={(e) => setAutoSave(e.target.checked)}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
              </div>

              {autoSave && (
                <div className="setting-row indent">
                  <div className="setting-info">
                    <span className="setting-label">저장 간격 지연시간</span>
                    <span className="setting-desc">입력이 중단되고 저장될 때까지의 대기 시간입니다. ({(autoSaveDelay / 1000).toFixed(1)}초)</span>
                  </div>
                  <div className="setting-control">
                    <input 
                      type="number" 
                      min="0.5" 
                      max="10" 
                      step="0.5"
                      value={autoSaveDelay / 1000} 
                      onChange={(e) => setAutoSaveDelay(Number(e.target.value) * 1000)}
                      className="delay-input"
                    />
                  </div>
                </div>
              )}

              <div className="settings-divider" />

              {/* 앱 업데이트 */}
              <UpdateSection />
            </div>
          )}

          {/* 단축키 에디터 */}
          {activeTab === 'shortcuts' && (
            <div className="tab-content">
              <div className="shortcut-editor-header">
                <span>단축키 매핑 정보</span>
                <button className="reset-shortcuts-btn" onClick={resetShortcuts}>기본 단축키로 복원</button>
              </div>
              <div className="shortcut-list">
                {Object.entries(shortcuts).map(([action, keys]) => (
                  <div className="shortcut-row" key={action}>
                    <span className="shortcut-action-label">{shortcutLabels[action] || action}</span>
                    <div className="shortcut-action-mapping">
                      {listeningShortcut === action ? (
                        <span className="shortcut-listening-badge">새로운 단축키 입력 대기 중 (Esc로 취소)...</span>
                      ) : (
                        <>
                          <kbd className="shortcut-kbd">{keys}</kbd>
                          <button className="change-shortcut-btn" onClick={() => setListeningShortcut(action)}>변경</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 테마 커스터마이저 */}
          {activeTab === 'theme' && (
            <div className="tab-content">
              
              {/* 테마 컨트롤 상단부 */}
              <div className="theme-customizer-grid">
                
                <div className="theme-selector-panel">
                  <span className="setting-label">테마 선택</span>
                  <select 
                    value={activeThemeId} 
                    onChange={(e) => setActiveThemeId(e.target.value)}
                    className="theme-dropdown"
                  >
                    <option value="" disabled>--- 기본 프리셋 ---</option>
                    {Object.entries(THEME_PRESETS).map(([id, t]) => (
                      <option value={id} key={id}>{t.name}</option>
                    ))}
                    {customThemes.length > 0 && (
                      <>
                        <option value="" disabled>--- 커스텀 테마 ---</option>
                        {customThemes.map((t) => (
                          <option value={t.id} key={t.id}>{t.name}</option>
                        ))}
                      </>
                    )}
                  </select>

                  <div className="theme-io-actions">
                    <button className="theme-btn-action" onClick={handleExportTheme}>JSON 내보내기</button>
                    <button className="theme-btn-action" onClick={() => setShowImportArea(!showImportArea)}>JSON 불러오기</button>
                  </div>

                  {showImportArea && (
                    <div className="theme-import-panel">
                      <textarea 
                        value={importJsonText} 
                        onChange={(e) => setImportJsonText(e.target.value)}
                        placeholder="이곳에 테마 JSON을 붙여넣으세요"
                        rows={5}
                      />
                      <button className="theme-btn-action import" onClick={handleImportThemeText}>불러오기 완료</button>
                    </div>
                  )}

                  <div className="theme-create-box">
                    <input 
                      type="text" 
                      placeholder="새 테마 명칭 입력" 
                      value={themeNameInput}
                      onChange={(e) => setThemeNameInput(e.target.value)}
                      className="theme-name-input"
                    />
                    <button className="theme-create-btn" onClick={handleCreateCustomTheme}>현재 복제해 추가</button>
                  </div>
                </div>

                {/* 우측 실시간 미니 프리뷰 모형 */}
                <div className="theme-preview-panel">
                  <span className="setting-label">미리보기 (실시간 반영)</span>
                  <div className="mini-app-preview" style={{ backgroundColor: editingColors['--bg-main'] }}>
                    <div className="mini-titlebar" style={{ backgroundColor: editingColors['--bg-titlebar'], borderBottom: `1px solid ${editingColors['--border-color']}` }}>
                      <span style={{ color: editingColors['--text-primary'] }}>EveryMD</span>
                      <div className="mini-buttons">
                        <span style={{ backgroundColor: editingColors['--text-muted'] }}></span>
                        <span style={{ backgroundColor: editingColors['--accent-color'] }}></span>
                        <span style={{ backgroundColor: '#e81123' }}></span>
                      </div>
                    </div>
                    
                    <div className="mini-tabs" style={{ backgroundColor: editingColors['--bg-sidebar'], borderBottom: `1px solid ${editingColors['--border-color']}` }}>
                      <span className="mini-tab active" style={{ backgroundColor: editingColors['--bg-main'], color: editingColors['--accent-color'], borderBottom: `2px solid ${editingColors['--accent-color']}` }}>Untitled.md</span>
                      <span className="mini-tab" style={{ color: editingColors['--text-secondary'] }}>Notes.md</span>
                    </div>

                    <div className="mini-layout">
                      <div className="mini-sidebar" style={{ backgroundColor: editingColors['--bg-sidebar'], borderRight: `1px solid ${editingColors['--border-color']}` }}>
                        <span style={{ color: editingColors['--text-secondary'] }}>📁 Workspace</span>
                        <span style={{ color: editingColors['--text-primary'], paddingLeft: '8px' }}>📄 README.md</span>
                      </div>
                      
                      <div className="mini-editor" style={{ backgroundColor: editingColors['--bg-main'] }}>
                        <h4 style={{ color: editingColors['--text-primary'], margin: '2px 0' }}>대제목 1</h4>
                        <p style={{ color: editingColors['--text-secondary'], fontSize: '8px', margin: '2px 0' }}>본문 텍스트가 표시됩니다.</p>
                        <code style={{ backgroundColor: editingColors['--code-bg'], color: editingColors['--accent-color'], fontSize: '7px', padding: '1px 2px' }}>const md = true;</code>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* JSON 코드 직접 수정 에디터 판넬 상시 노출 */}
              <div className="theme-json-direct-editor">
                <span className="setting-label">🎨 테마 JSON 직접 코딩 편집</span>
                <textarea 
                  className="json-direct-textarea"
                  value={jsonEditText}
                  onChange={(e) => handleJsonTextareaChange(e.target.value)}
                  placeholder="테마 색상 JSON 코드를 직접 타이핑하여 커스텀해 보세요"
                  rows={10}
                />
                {jsonError ? (
                  <div className="json-error-message">⚠️ {jsonError}</div>
                ) : (
                  <div className="json-success-message">✓ 올바른 테마 JSON 문법 규격입니다. 미리보기에 즉시 적용되었습니다.</div>
                )}
              </div>

              {/* 세부 컬러픽커 수정 */}
              <div className="theme-color-pickers">
                <div className="pickers-header">
                  <span>세부 영역 색상 조절 (Color Picker)</span>
                  {!THEME_PRESETS[activeThemeId] && (
                    <button className="delete-theme-btn" onClick={() => deleteCustomTheme(activeThemeId)}>이 테마 삭제</button>
                  )}
                </div>

                <div className="color-inputs-grid">
                  {Object.entries(editingColors).map(([variable, value]) => {
                    const labelMap: Record<string, string> = {
                      '--bg-main': '에디터 본문 배경',
                      '--bg-sidebar': '탐색기/사이드바 배경',
                      '--bg-titlebar': '상단 타이틀바 배경',
                      '--bg-hover': '마우스 오버 배경',
                      '--bg-active': '선택/활성화 배경',
                      '--bg-statusbar': '하단 상태바 배경',
                      '--text-primary': '주요 글씨 색상',
                      '--text-secondary': '보조 텍스트 색상',
                      '--text-muted': '안내/메모 텍스트',
                      '--statusbar-text': '상태바 텍스트 색상',
                      '--accent-color': '액센트 컬러 (주 포인트)',
                      '--accent-hover': '포인트 호버링 색상',
                      '--border-color': '경계선/나눔선',
                      '--code-bg': '코드블록 백그라운드',
                      '--code-text': '코드 글자색 (코드블록 전용)'
                    };

                    const typedVariable = variable as keyof ThemeColors;

                    return (
                      <div className="color-picker-row" key={variable}>
                        <span className="color-picker-label">{labelMap[variable] || variable}</span>
                        <div className="color-picker-input-group">
                          <input 
                            type="color" 
                            value={value} 
                            onChange={(e) => handleColorPickerChange(typedVariable, e.target.value)}
                          />
                          <input 
                            type="text" 
                            value={value}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (/^#[0-9A-Fa-f]{6}$/.test(v) || /^#[0-9A-Fa-f]{3}$/.test(v)) {
                                handleColorPickerChange(typedVariable, v);
                              } else {
                                setEditingColors({ ...editingColors, [typedVariable]: v });
                                setJsonEditText(JSON.stringify({ ...editingColors, [typedVariable]: v }, null, 2));
                              }
                            }}
                            className="color-hex-text"
                            placeholder="#RRGGBB"
                            spellCheck={false}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 테마 변경사항 최종 적용 & 저장 단추 */}
              <div className="theme-apply-action-bar">
                <button className="theme-apply-btn" onClick={handleSaveAndApplyTheme}>
                  💾 현재 테마 변경사항 앱 전체에 적용 및 저장
                </button>
              </div>

            </div>
          )}
        </div>

        <div className="settings-footer">
          <button className="settings-save-btn" onClick={onClose}>확인</button>
        </div>
      </div>
    </div>
  );
};
