import datetime
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOG_PATH = os.path.join(BASE_DIR, "logs") + os.sep

 # put your Fyers app id and secret key here, these are dummy values
APP_ID = "OIBWTGAWNQ-100"
SECRET_KEY = "3A5KIKSR9P"
REDIRECT_URL = "https://www.google.com/"

TOKEN_FILE = "fyers_token.json"

BRAVE_PATHS = [
    r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
    r"C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe",
]

# LOG_PATH = os.path.join(BASE_DIR, "logs") + os.sep
LOG_PATH = "" ## Empty log path to disable logging

FROM_DATE = "2026-01-01"
# TO_DATE = "2026-01-05" # for testing
TO_DATE = datetime.date.today().strftime("%Y-%m-%d")

NIFTY_INDEX_SYMBOL = "NSE:NIFTY50-INDEX"
STRIKE_STEP = 50

OUTPUT_DIR = "..\\files\\straddle_monthly_csv"

SYMBOL_MASTER_URL = "https://public.fyers.in/sym_details/NSE_FO.csv"
SYMBOL_MASTER_CACHE_FILE = "NSE_FO.csv"

