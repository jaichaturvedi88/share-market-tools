import os
import csv
import datetime

from config import (
    FROM_DATE, TO_DATE,
    STRIKE_STEP,
    OUTPUT_DIR
)

from fyers_utils import (
    get_fyers,
    round_to_step,
    download_symbol_master_if_needed,
    parse_nse_fo_csv_for_nifty,
    get_nifty_daily_close_map,
    get_option_close_for_date,
    make_option_symbol
)


def trading_days_in_month(nifty_close_map, year, month):
    days = []
    for dstr in nifty_close_map.keys():
        dt = datetime.datetime.strptime(dstr, "%Y-%m-%d").date()
        if dt.year == year and dt.month == month:
            days.append(dstr)
    return sorted(days)


def generate_month_matrix(fyers, nifty_close_map, valid_symbols, monthly_expiry_by_month, expiry_date_map, year, month):
    trading_days = trading_days_in_month(nifty_close_map, year, month)
    if not trading_days:
        return

    expiry_code = monthly_expiry_by_month.get((year, month))
    if not expiry_code:
        print(f"❌ Monthly expiry not found for {year}-{month:02d}")
        return

    expiry_dt = expiry_date_map.get((year, month, expiry_code))
    if not expiry_dt:
        print(f"❌ Expiry date missing for {expiry_code} {year}-{month:02d}")
        return

    # ✅ track only till expiry date (trading days)
    col_dates = [d for d in trading_days if datetime.datetime.strptime(d, "%Y-%m-%d").date() <= expiry_dt]

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    out_file = os.path.join(OUTPUT_DIR, f"straddle_matrix_{year}_{month:02d}.csv")

    header = ["BuyDate", "NiftyClose", "Strike", "ExpiryCode", "ExpiryDate"] + col_dates
    rows = []

    for buy_date in col_dates:
        nifty_close = nifty_close_map[buy_date]
        strike = round_to_step(nifty_close, STRIKE_STEP)

        ce_symbol = make_option_symbol(expiry_code, strike, "CE")
        pe_symbol = make_option_symbol(expiry_code, strike, "PE")

        if ce_symbol not in valid_symbols or pe_symbol not in valid_symbols:
            print(f"⚠️ Missing symbol in master: {ce_symbol} / {pe_symbol}")
            values = [""] * len(col_dates)
            rows.append([buy_date, nifty_close, strike, expiry_code, str(expiry_dt)] + values)
            continue

        values = []
        for dt_col in col_dates:
            if dt_col < buy_date:
                values.append("")
                continue

            ce_close = get_option_close_for_date(fyers, ce_symbol, dt_col)
            pe_close = get_option_close_for_date(fyers, pe_symbol, dt_col)

            if ce_close is None or pe_close is None:
                values.append("")
            else:
                values.append(round(ce_close + pe_close, 2))

        rows.append([buy_date, nifty_close, strike, expiry_code, str(expiry_dt)] + values)
        print(f"✅ Buy={buy_date} Exp={expiry_code} Strike={strike}")

    with open(out_file, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)

    print(f"\n✅ Saved: {out_file}\n")


def main():
    fyers = get_fyers()

    download_symbol_master_if_needed()
    valid_symbols, monthly_expiry_by_month, expiry_date_map = parse_nse_fo_csv_for_nifty()

    nifty_close_map = get_nifty_daily_close_map(fyers, FROM_DATE, TO_DATE)

    start_dt = datetime.datetime.strptime(FROM_DATE, "%Y-%m-%d").date()
    end_dt = datetime.datetime.strptime(TO_DATE, "%Y-%m-%d").date()

    y, m = start_dt.year, start_dt.month
    while True:
        if (y > end_dt.year) or (y == end_dt.year and m > end_dt.month):
            break

        print(f"\n============================")
        print(f"📌 Month: {y}-{m:02d}")
        print(f"============================")

        generate_month_matrix(
            fyers=fyers,
            nifty_close_map=nifty_close_map,
            valid_symbols=valid_symbols,
            monthly_expiry_by_month=monthly_expiry_by_month,
            expiry_date_map=expiry_date_map,
            year=y,
            month=m
        )

        m += 1
        if m == 13:
            m = 1
            y += 1


if __name__ == "__main__":
    main()
