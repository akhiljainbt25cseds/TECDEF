"""
TechDef Desktop Notification & Gaming HUD Overlay
Spawns an always-on-top gamer notification window directly on the Windows desktop
over any full-screen or browser game (such as FivePlay).
Also triggers the native Windows 10/11 WinRT Notification Toast and system sound.
"""
import sys
import os
import subprocess
import time

def fire_win_toast(title: str, message: str):
    """Fires Windows 10/11 WinRT Action Center Toast."""
    try:
        ps_script = f"""
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        $template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)
        $textNodes = $template.GetElementsByTagName('text')
        $textNodes.Item(0).AppendChild($template.CreateTextNode('{title}')) | Out-Null
        $textNodes.Item(1).AppendChild($template.CreateTextNode('{message}')) | Out-Null
        $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('TechDef Hardware Defense')
        $notification = [Windows.UI.Notifications.ToastNotification]::new($template)
        $notifier.Show($notification)
        """
        subprocess.Popen(
            ["powershell", "-ExecutionPolicy", "Bypass", "-NoProfile", "-Command", ps_script],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    except Exception:
        pass

def play_alert_sound():
    try:
        import winsound
        winsound.MessageBeep(winsound.MB_ICONEXCLAMATION)
    except Exception:
        pass

def show_topmost_overlay(title: str, message: str, temp_c: str, game_name: str):
    """Displays a sleek, always-on-top gaming HUD overlay banner over the game."""
    try:
        import tkinter as tk

        root = tk.Tk()
        root.title("TechDef Gaming Thermal Alert")
        root.overrideredirect(True)          # Borderless window
        root.attributes("-topmost", True)     # ALWAYS ON TOP over browser / game
        root.attributes("-alpha", 0.94)       # Sleek translucent HUD look

        width, height = 440, 160
        screen_w = root.winfo_screenwidth()
        x = screen_w - width - 24
        y = 28
        root.geometry(f"{width}x{height}+{x}+{y}")
        root.configure(bg="#0A0C0E")

        # Outer glowing border
        outer = tk.Frame(root, bg="#FF3B30", padx=2, pady=2)
        outer.pack(fill="both", expand=True)

        inner = tk.Frame(outer, bg="#101317", padx=16, pady=12)
        inner.pack(fill="both", expand=True)

        # Header Row
        header_frame = tk.Frame(inner, bg="#101317")
        header_frame.pack(fill="x")

        icon_lbl = tk.Label(header_frame, text="🚨", font=("Segoe UI Emoji", 14), bg="#101317")
        icon_lbl.pack(side="left")

        title_lbl = tk.Label(
            header_frame,
            text=f" {title.upper()}",
            font=("Segoe UI", 10, "bold"),
            fg="#FF453A",
            bg="#101317"
        )
        title_lbl.pack(side="left")

        temp_badge = tk.Label(
            header_frame,
            text=f" {temp_c}°C ",
            font=("Consolas", 10, "bold"),
            fg="#FFFFFF",
            bg="#B81D13",
            padx=6,
            pady=1
        )
        temp_badge.pack(side="right")

        # Game Target Subhead
        game_lbl = tk.Label(
            inner,
            text=f"🎮 Active Target: {game_name}",
            font=("Segoe UI", 9, "bold"),
            fg="#E8913C",
            bg="#101317"
        )
        game_lbl.pack(anchor="w", pady=(6, 4))

        # Main Explanation Message
        msg_lbl = tk.Label(
            inner,
            text=message,
            font=("Segoe UI", 8),
            fg="#EDE7DC",
            bg="#101317",
            wraplength=400,
            justify="left"
        )
        msg_lbl.pack(anchor="w", pady=(0, 8))

        # Footer Action Row
        footer = tk.Frame(inner, bg="#101317")
        footer.pack(fill="x")

        status_lbl = tk.Label(
            footer,
            text="⚡ Autonomous Action: Fan 100% Turbo Active",
            font=("Segoe UI", 8, "italic"),
            fg="#34C759",
            bg="#101317"
        )
        status_lbl.pack(side="left")

        dismiss_btn = tk.Button(
            footer,
            text="ACKNOWLEDGE",
            font=("Segoe UI", 8, "bold"),
            fg="#0A0C0E",
            bg="#E8913C",
            activebackground="#D07A28",
            activeforeground="#0A0C0E",
            bd=0,
            padx=10,
            pady=3,
            cursor="hand2",
            command=root.destroy
        )
        dismiss_btn.pack(side="right")

        # Click anywhere on the overlay to dismiss
        root.bind("<Button-1>", lambda e: root.destroy())

        # Auto-dismiss smoothly after 8 seconds
        root.after(8000, root.destroy)

        root.mainloop()
    except Exception as e:
        pass

def main():
    title = sys.argv[1] if len(sys.argv) > 1 else "CRITICAL OVERHEAT ALERT"
    message = sys.argv[2] if len(sys.argv) > 2 else "Hardware thermals exceeded safety ceiling. Emergency cooling ramp engaged."
    temp_c = sys.argv[3] if len(sys.argv) > 3 else "94.8"
    game_name = sys.argv[4] if len(sys.argv) > 4 else "FivePlay Online Launcher"

    # 1. Audible system sound
    play_alert_sound()

    # 2. Windows 10/11 Toast Notification
    fire_win_toast(f"🚨 {title} ({temp_c}°C)", f"{game_name}: {message}")

    # 3. Always-on-top Gaming HUD Banner
    show_topmost_overlay(title, message, temp_c, game_name)

if __name__ == "__main__":
    main()

