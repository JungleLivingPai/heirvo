// Prevents additional console window on Windows in release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::Write;

fn main() {
    // Bulletproof crash logging: catches panics that occur BEFORE the
    // tracing subscriber is initialized (early plugin init, DLL load, etc.).
    // Writes to a fixed path so we can always diagnose "won't open" reports
    // from end users.
    install_early_panic_hook();

    heirvo_lib::run();
}

fn install_early_panic_hook() {
    let crash_log = match dirs::data_dir() {
        Some(p) => p.join("com.heirvo.app").join("crash.log"),
        None => return,
    };
    let _ = std::fs::create_dir_all(crash_log.parent().unwrap_or(std::path::Path::new(".")));

    std::panic::set_hook(Box::new(move |info| {
        let location = info
            .location()
            .map(|l| format!("{}:{}", l.file(), l.line()))
            .unwrap_or_else(|| "<unknown>".to_string());
        let payload = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "<no message>".to_string());
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        let line = format!(
            "[{}] PANIC at {}: {}\n",
            timestamp, location, payload
        );
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&crash_log)
        {
            let _ = f.write_all(line.as_bytes());
            let _ = f.flush();
        }
        // Also print to stderr if available (cmd-launched runs).
        eprintln!("{}", line);
    }));
}
