import os
import csv
import json
import time
import datetime
import urllib.request

from fyers_apiv3 import fyersModel
from config import (
    APP_ID, TOKEN_FILE, LOG_PATH,
    SYMBOL_MASTER_URL, SYMBOL_MASTER_CACHE_FILE,
    NIFTY_INDEX_SYMBOL
)


def load_access_token():
    with open(TOKEN_FILE, "r") as f:
        return json.load(f)["access_token"]


def get_fyers():
    return fyersModel.FyersModel(
        client_id=APP_ID,
        token=load_access_token(),
        is_async=False,
        log_path=LOG_PATH
    )


def round_to_step(price, step=50):
    return int(round(price / step) * step)


def ts_to_date_str(ts):
    return datetime.datetime.fromtimestamp(ts).strftime("%Y-%m-%d")


def get_history(fyers, symbol, resolution, range_from, range_to):
    data = {
        "symbol": symbol,
        "resolution": resolution,
        "date_format": "1",
        "range_from": range_from,
        "range_to": range_to,
        "cont_flag": "1"
    }
    return fyers.history(data=data)


def get_nifty_daily_close_map(fyers, from_date, to_date):
    resp = get_history(fyers, NIFTY_INDEX_SYMBOL, "1D", from_date, to_date)
    if resp.get("s") != "ok":
        raise Exception(f"NIFTY history error: {resp}")

    close_map = {}
    for ts, o, h, l, c, v in resp["candles"]:
        close_map[ts_to_date_str(ts)] = c
    return close_map


def get_option_close_for_date(fyers, symbol, dt_str):
    resp = get_history(fyers, symbol, "1D", dt_str, dt_str)
    if resp.get("s") != "ok":
        return None
    candles = resp.get("candles", [])
    if not candles:
        return None
    return candles[0][4]


def download_symbol_master_if_needed():
    needs_download = True
    if os.path.exists(SYMBOL_MASTER_CACHE_FILE):
        age_seconds = time.time() - os.path.getmtime(SYMBOL_MASTER_CACHE_FILE)
        if age_seconds < 2 * 24 * 3600:
            needs_download = False

    if needs_download:
        print("⬇️ Downloading FYERS NSE_FO.csv symbol master...")
        urllib.request.urlretrieve(SYMBOL_MASTER_URL, SYMBOL_MASTER_CACHE_FILE)
        print("✅ Downloaded:", SYMBOL_MASTER_CACHE_FILE)
    else:
        print("✅ Using cached:", SYMBOL_MASTER_CACHE_FILE)


def parse_nse_fo_csv_for_nifty():
    valid_symbols = set()
    expiries_by_month = {}
    expiry_date_map = {}

    with open(SYMBOL_MASTER_CACHE_FILE, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 10:
                continue

            symbol = row[9].strip()
            if not symbol.startswith("NSE:NIFTY"):
                continue
            if not (symbol.endswith("CE") or symbol.endswith("PE")):
                continue

            valid_symbols.add(symbol)

            exp_epoch = row[8].strip()
            if not exp_epoch:
                continue

            try:
                exp_date = datetime.datetime.fromtimestamp(int(exp_epoch)).date()
            except:
                continue

            raw = symbol.replace("NSE:NIFTY", "")
            expiry_code = raw[:5]  # 26JAN

            ym = (exp_date.year, exp_date.month)
            expiries_by_month.setdefault(ym, set()).add(expiry_code)
            expiry_date_map[(exp_date.year, exp_date.month, expiry_code)] = exp_date

    monthly_expiry_by_month = {}
    for (y, m), codes in expiries_by_month.items():
        best_code = None
        best_date = None
        for code in codes:
            d = expiry_date_map.get((y, m, code))
            if d and (best_date is None or d > best_date):
                best_date = d
                best_code = code
        if best_code:
            monthly_expiry_by_month[(y, m)] = best_code

    return valid_symbols, monthly_expiry_by_month, expiry_date_map


def make_option_symbol(expiry_code, strike, opt_type):
    print(expiry_code, strike, opt_type)
    return f"NSE:NIFTY{expiry_code}{strike}{opt_type}"
