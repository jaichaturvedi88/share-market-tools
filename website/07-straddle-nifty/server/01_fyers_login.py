import os
import json
import time
import subprocess
from urllib.parse import urlparse, parse_qs

from fyers_apiv3 import fyersModel
from config import APP_ID, SECRET_KEY, REDIRECT_URL, TOKEN_FILE, BRAVE_PATHS


def open_in_brave(url):
    """Force open URL in Brave browser (Windows)."""
    for path in BRAVE_PATHS:
        if os.path.exists(path):
            subprocess.Popen([path, url])
            return True

    print("❌ Brave browser not found.")
    print("➡️ Update BRAVE_PATHS in config.py")
    return False


def extract_auth_code(redirect_url):
    parsed = urlparse(redirect_url)
    qs = parse_qs(parsed.query)
    return qs.get("auth_code", [None])[0]


def save_token(data):
    with open(TOKEN_FILE, "w") as f:
        json.dump(data, f, indent=2)


def load_token():
    if not os.path.exists(TOKEN_FILE):
        return None
    with open(TOKEN_FILE, "r") as f:
        return json.load(f)


def get_login_url():
    session = fyersModel.SessionModel(
        client_id=APP_ID,
        redirect_uri=REDIRECT_URL,
        response_type="code",
        grant_type="authorization_code",
        state="state",
        scope="",
        nonce="",
    )
    return session.generate_authcode()


def generate_access_token(auth_code):
    session = fyersModel.SessionModel(
        client_id=APP_ID,
        secret_key=SECRET_KEY,
        grant_type="authorization_code",
    )
    session.set_token(auth_code)
    return session.generate_token()


def main():
    saved = load_token()
    if saved and "access_token" in saved:
        print("✅ Access token already saved.")
        print("Access Token:", saved["access_token"])
        return

    login_url = get_login_url()
    print("\n✅ Open this URL to login:\n", login_url)

    open_in_brave(login_url)

    redirect_full = input("\n✅ Paste full redirected URL here: ").strip()

    auth_code = extract_auth_code(redirect_full)
    if not auth_code:
        print("\n❌ auth_code not found in the URL you pasted.")
        return

    token_response = generate_access_token(auth_code)

    if token_response.get("s") != "ok":
        print("\n❌ Token generation failed:", token_response)
        return

    access_token = token_response["access_token"]

    save_token({
        "access_token": access_token,
        "created_at": int(time.time())
    })

    print("\n✅ SUCCESS! Access token generated & saved.")
    print("Access Token:", access_token)


if __name__ == "__main__":
    main()
