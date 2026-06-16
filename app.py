import logging
import hashlib
import time
import requests
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Simple in-memory cache for the parsed release notes
FEED_CACHE = {
    'data': None,
    'timestamp': 0
}
CACHE_DURATION = 300  # 5 minutes in seconds

def fetch_and_parse_feed(bypass_cache=False):
    global FEED_CACHE
    now = time.time()
    
    # Return cached data if valid and cache bypass not requested
    if not bypass_cache and FEED_CACHE['data'] and (now - FEED_CACHE['timestamp'] < CACHE_DURATION):
        logger.info("Serving feed data from cache")
        return FEED_CACHE['data']
        
    logger.info("Fetching fresh feed data from Google Cloud")
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
    except Exception as e:
        logger.error(f"Error fetching BigQuery release notes: {e}")
        # If fetch fails but we have cached data, return the cached data (even if expired)
        if FEED_CACHE['data']:
            logger.warning("Fetch failed. Serving expired cache data as backup.")
            return FEED_CACHE['data']
        raise e
        
    try:
        root = ET.fromstring(response.content)
    except ET.ParseError as e:
        logger.error(f"Error parsing feed XML: {e}")
        if FEED_CACHE['data']:
            return FEED_CACHE['data']
        raise ValueError("Invalid XML feed content")

    namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
    updates = []
    
    # Loop over Atom entry tags
    for entry in root.findall('atom:entry', namespaces):
        # Extract title (which represents the update date)
        title_el = entry.find('atom:title', namespaces)
        date_str = title_el.text if title_el is not None else "Unknown Date"
        
        # Extract base release note page link
        link_el = entry.find('atom:link[@rel="alternate"]', namespaces)
        base_link = link_el.attrib.get('href') if link_el is not None else 'https://cloud.google.com/bigquery/docs/release-notes'
        
        # Extract content HTML
        content_el = entry.find('atom:content', namespaces)
        if content_el is None or not content_el.text:
            continue
            
        content_html = content_el.text
        
        # Parse CDATA HTML with BeautifulSoup
        soup = BeautifulSoup(content_html, 'html.parser')
        
        current_type = "Update"
        current_elements = []
        
        def add_sub_update(utype, elements):
            if not elements:
                return
                
            # Compile HTML representation and text representation
            html_parts = []
            text_parts = []
            for el in elements:
                html_parts.append(str(el))
                if hasattr(el, 'get_text'):
                    text_parts.append(el.get_text())
                else:
                    text_parts.append(str(el))
                    
            html_str = "".join(html_parts).strip()
            text_str = " ".join(text_parts).strip()
            
            # Skip empty entries
            if not html_str or not text_str:
                return
                
            # Normalize update type label
            type_clean = utype.strip()
            
            # Generate deterministic unique ID based on date, type, and content hash
            hasher = hashlib.md5()
            hasher.update(f"{date_str}-{type_clean}-{text_str[:120]}".encode('utf-8'))
            uid = hasher.hexdigest()
            
            # Create sub-link target if possible.
            # Usually links are like #Month_Day_Year, let's map "June 15, 2026" to "June_15_2026"
            link_anchor = date_str.replace(' ', '_').replace(',', '')
            specific_link = f"{base_link.split('#')[0]}#{link_anchor}"
            
            updates.append({
                'id': uid,
                'date': date_str,
                'type': type_clean,
                'html': html_str,
                'text': text_str,
                'link': specific_link
            })

        # Iterate through HTML child elements to group content under their respective H3 headers
        for child in soup.contents:
            if getattr(child, 'name', None) == 'h3':
                # Save previous update block
                add_sub_update(current_type, current_elements)
                # Reset tracking
                current_elements = []
                current_type = child.get_text().strip()
            else:
                # Add text/nodes to current block
                current_elements.append(child)
                
        # Add the last block remaining
        add_sub_update(current_type, current_elements)
        
    FEED_CACHE['data'] = updates
    FEED_CACHE['timestamp'] = now
    return updates

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    # Allow URL param force_refresh=true to bypass cache (e.g., user clicked refresh)
    bypass_cache = request.args.get('refresh', 'false').lower() == 'true'
    try:
        notes = fetch_and_parse_feed(bypass_cache=bypass_cache)
        return jsonify({
            'success': True,
            'count': len(notes),
            'notes': notes,
            'cached_at': time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(FEED_CACHE['timestamp']))
        })
    except Exception as e:
        logger.exception("Failed to serve release notes")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
