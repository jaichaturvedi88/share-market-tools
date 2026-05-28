# Fyers Auto Symbol Sync (Brave Extension)

## What it does
- Mark one FYERS tab as **Leader**.
- Mark another FYERS tab as **Follower**.
- When symbol changes in Leader, Follower receives and applies it.

## Load extension in Brave
1. Open `brave://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `zPOC/fyers-auto-symbol-sync`.

## How to use
1. Open FYERS in both windows (same Brave profile).
2. In window 1 tab, open extension popup → **Set Leader**.
3. In window 2 tab, open extension popup → **Set Follower**.
4. Change symbol in leader tab; follower should update.

## Notes
- Works only when both windows are in the same Brave profile.
- This is an MVP; exact symbol apply behavior depends on FYERS page DOM/URL format.
- Use **Send Test** in popup if you want to force-push a symbol manually.
