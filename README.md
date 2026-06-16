# BigQuery Release Notes Hub

A premium, dark-themed web application built using **Python Flask**, vanilla **HTML**, **CSS**, and **JavaScript** that parses and presents Google BigQuery release notes. It features instant filtering, full text search, data caching, and an interactive **X (formerly Twitter) Tweet Composer** to easily share updates.

## Key Features

- **Beautiful Tech-Inspired Dark UI**: Modern dark theme using curated accent colors, custom typography (Inter and Outfit), glassmorphism, responsive grids, card scaling transitions, and CSS animated status pulses.
- **Granular Update Parsing**: Automatically splits the daily BigQuery release notes feed into specific categories (Features, Issues, Deprecations, Changes) so users can browse and interact with individual updates.
- **Smart X/Twitter Composer Sidebar**:
  - Highlights the selected release note.
  - Automatically drafts a tweet text incorporating the update type, date, truncated excerpt, and official source link.
  - Keeps the tweet strictly within the 280-character limit.
  - Interactive character progress ring that warns you when approaching or exceeding the character limit.
  - Hashtag inserts for quick labeling.
- **Reliable Data Refreshing**:
  - A spin-animated refresh button with cache status.
  - A 5-minute background memory cache to prevent rate-limiting and accelerate load times.
  - Manual bypass to force a fresh fetch from the XML feed when needed.
- **Real-Time Search & Filtering**: Match updates instantly by text content, update type, or date. Filter the list with category-specific buttons.

## Project Structure

```
.
├── app.py                  # Flask application & BigQuery RSS feed parser
├── requirements.txt        # Python dependencies
├── README.md               # Documentation
├── static/
│   ├── css/
│   │   └── style.css       # Premium CSS styles (Variables, animations, responsive grid)
│   └── js/
│       └── main.js         # Frontend interactive logic (fetching, filters, X composer)
└── templates/
    └── index.html          # Main HTML structure with Lucide icons
```

## Setup & Running the Application

### 1. Prerequisites
Make sure you have **Python 3.8+** installed.

### 2. Setup Virtual Environment
Run the following commands in your terminal from the project root:

```bash
# Create a virtual environment
python3 -m venv .venv

# Activate the virtual environment
source .venv/bin/activate
```

### 3. Install Dependencies
Install the required packages using pip:

```bash
pip install -r requirements.txt
```

### 4. Start the Application
Run the Flask server:

```bash
python3 app.py
```

The application will start on [http://127.0.0.1:5000](http://127.0.0.1:5000). Open this URL in your web browser.
