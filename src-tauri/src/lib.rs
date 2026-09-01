// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use serde::Serialize;
use tauri::{Emitter, Manager, RunEvent};

#[derive(Serialize)]
pub struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
}

// Initial files passed via CLI or macOS open event before frontend is ready
#[derive(Default)]
pub struct PendingFiles(pub Mutex<Vec<String>>);

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Get initial file paths queued on application launch and drain the queue
#[tauri::command]
fn get_initial_files(state: tauri::State<PendingFiles>) -> Vec<String> {
    if let Ok(mut files) = state.0.lock() {
        let result = files.clone();
        files.clear();
        result
    } else {
        Vec::new()
    }
}

/// Read a text file and return its contents
#[tauri::command]
fn read_file_content(path: &str) -> Result<String, String> {
    fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))
}

/// Write content to a text file
#[tauri::command]
fn write_file_content(path: &str, content: &str) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = Path::new(path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    fs::write(path, content).map_err(|e| format!("Failed to write file: {}", e))
}

/// Read directory entries
#[tauri::command]
fn read_dir_entries(path: &str) -> Result<Vec<FileEntry>, String> {
    let entries = fs::read_dir(path).map_err(|e| format!("Failed to read directory: {}", e))?;

    let mut result: Vec<FileEntry> = entries
        .filter_map(|entry| {
            let entry = entry.ok()?;
            let metadata = entry.metadata().ok()?;
            Some(FileEntry {
                name: entry.file_name().to_string_lossy().to_string(),
                path: entry.path().to_string_lossy().to_string(),
                is_dir: metadata.is_dir(),
            })
        })
        .collect();

    // Sort: directories first, then files, alphabetically
    result.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(result)
}

#[cfg(target_os = "macos")]
fn setup_macos_menu(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder, PredefinedMenuItem};
    use tauri::Emitter;

    let app_handle = app.handle();

    // 1. App Menu (EveryMD)
    let app_menu = SubmenuBuilder::new(app_handle, "EveryMD")
        .about(Some(tauri::menu::AboutMetadata {
            name: Some("EveryMD".into()),
            version: Some(env!("CARGO_PKG_VERSION").into()),
            authors: Some(vec!["EveryMD Team".into()]),
            comments: Some("Modern Minimal Markdown Editor".into()),
            ..Default::default()
        }))
        .separator()
        .item(&MenuItemBuilder::with_id("settings", "설정...")
            .accelerator("CmdOrCtrl+,")
            .build(app_handle)?)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    // 2. File Menu
    let file_menu = SubmenuBuilder::new(app_handle, "파일")
        .item(&MenuItemBuilder::with_id("new_file", "새 파일")
            .accelerator("CmdOrCtrl+N")
            .build(app_handle)?)
        .item(&MenuItemBuilder::with_id("open_file", "열기...")
            .accelerator("CmdOrCtrl+O")
            .build(app_handle)?)
        .separator()
        .item(&MenuItemBuilder::with_id("save_file", "저장")
            .accelerator("CmdOrCtrl+S")
            .build(app_handle)?)
        .item(&MenuItemBuilder::with_id("save_as_file", "다른 이름으로 저장...")
            .accelerator("CmdOrCtrl+Shift+S")
            .build(app_handle)?)
        .separator()
        .item(&MenuItemBuilder::with_id("close_tab", "탭 닫기")
            .accelerator("CmdOrCtrl+W")
            .build(app_handle)?)
        .build()?;

    // 3. Edit Menu
    let edit_menu = SubmenuBuilder::new(app_handle, "편집")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    // 4. View Menu
    let view_menu = SubmenuBuilder::new(app_handle, "보기")
        .item(&MenuItemBuilder::with_id("toggle_sidebar", "사이드바 토글")
            .accelerator("CmdOrCtrl+\\")
            .build(app_handle)?)
        .item(&MenuItemBuilder::with_id("toggle_theme", "테마 전환")
            .accelerator("CmdOrCtrl+Shift+L")
            .build(app_handle)?)
        .separator()
        .item(&MenuItemBuilder::with_id("zoom_in", "확대")
            .accelerator("CmdOrCtrl+=")
            .build(app_handle)?)
        .item(&MenuItemBuilder::with_id("zoom_out", "축소")
            .accelerator("CmdOrCtrl+-")
            .build(app_handle)?)
        .item(&MenuItemBuilder::with_id("zoom_reset", "원래 크기")
            .accelerator("CmdOrCtrl+0")
            .build(app_handle)?)
        .build()?;

    // 5. Window Menu
    let window_menu = SubmenuBuilder::new(app_handle, "창")
        .minimize()
        .item(&PredefinedMenuItem::fullscreen(app_handle, None)?)
        .separator()
        .close_window()
        .build()?;

    // 6. Help Menu
    let help_menu = SubmenuBuilder::new(app_handle, "도움말")
        .item(&MenuItemBuilder::with_id("open_github", "GitHub 저장소...")
            .build(app_handle)?)
        .item(&MenuItemBuilder::with_id("open_release_notes", "릴리즈 노트 보기...")
            .build(app_handle)?)
        .build()?;

    let menu = MenuBuilder::new(app_handle)
        .items(&[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu, &help_menu])
        .build()?;

    app.set_menu(menu)?;

    app.on_menu_event(move |app_handle, event| {
        let id_str = event.id().as_ref();
        let _ = app_handle.emit("menu-event", id_str);
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let initial_files: Vec<String> = std::env::args()
        .skip(1)
        .filter(|arg| !arg.starts_with('-'))
        .collect();

    tauri::Builder::default()
        .manage(PendingFiles(Mutex::new(initial_files)))
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            for arg in argv.into_iter().skip(1) {
                if !arg.starts_with('-') {
                    let _ = app.emit("open-file-requested", &arg);
                }
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            setup_macos_menu(app)?;

            #[cfg(target_os = "windows")]
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_decorations(false);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            read_file_content,
            write_file_content,
            read_dir_entries,
            get_initial_files
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            if let RunEvent::Opened { urls } = event {
                for url in urls {
                    if let Ok(file_path) = url.to_file_path() {
                        let path_str = file_path.to_string_lossy().to_string();
                        let _ = app_handle.emit("open-file-requested", &path_str);
                        if let Some(state) = app_handle.try_state::<PendingFiles>() {
                            if let Ok(mut pending) = state.0.lock() {
                                if !pending.contains(&path_str) {
                                    pending.push(path_str);
                                }
                            }
                        }
                    }
                }
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            #[cfg(not(any(target_os = "macos", target_os = "ios")))]
            let _ = (app_handle, event);
        });
}

