# Straddle Nifty Project

## Overview
This project is designed to analyze and generate insights for straddle trading strategies in the Nifty market. It utilizes various scripts and configurations to facilitate data processing and visualization.

## Project Structure
- **config.py**: Configuration settings for the project.
- **fyers_token.json**: JSON file containing authentication tokens for the Fyers API.
- **fyers_utils.py**: Utility functions for interacting with the Fyers API.
- **NSE_FO.csv**: CSV file containing data for Nifty Futures and Options.
- **straddle_matrix.py**: Main script for calculating straddle matrices.
- **__pycache__/**: Directory containing cached bytecode files.
- **straddle_monthly_csv/**: Directory containing monthly CSV files for straddle data.
- **web/**: Directory containing web-related files.
  - **index.html**: Main HTML file for the web interface.
  - **index copy.html**: Backup of the main HTML file.
  - **server.py**: Python script to run the web server.
  - **styles.css**: CSS file for styling the web interface.
  - **js/**: Directory containing JavaScript files for client-side functionality.
    - **app.js**: Main application script.
    - **calc.js**: Script for calculations.
    - **config.js**: Configuration settings for the web app.
    - **csv.js**: Functions for handling CSV data.
    - **dom.js**: Functions for manipulating the DOM.
    - **export.js**: Functions for exporting data.
    - **logger.js**: Logging functions.
    - **screenshot.js**: Functions for taking screenshots.
    - **search.js**: Functions for search functionality.
    - **state.js**: State management functions.
    - **table.js**: Functions for table manipulation.
    - **utils.js**: General utility functions.

## Usage

### Setup and Running
1. Check `config.py` for `app_id` and `secret_key` - ensure they are properly configured. Get them from https://myapi.fyers.in/dashboard
2. Run `01_fyers_login.py` - this will create the `fyers_token.json` file for authentication.
3. Run `02_straddle_matrix.py` - this will create the `straddle_matrix_2026_01.csv` file to load in webpage.
4. Run `ui_server.py` - this will start the web server.
5. Open the URL displayed in the terminal output from step 3 in your web browser.

## License
This project is licensed under the MIT License. See the LICENSE file for more details.

## Acknowledgments
- Thanks to the Fyers API for providing market data.
- Special thanks to the contributors for their support and feedback.