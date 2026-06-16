// Main JavaScript for BigQuery Release Notes Hub

document.addEventListener('DOMContentLoaded', () => {
    // State Management
    let allNotes = [];
    let filteredNotes = [];
    let currentFilter = 'all';
    let searchQuery = '';
    let selectedNote = null;

    // DOM Elements
    const loader = document.getElementById('loader');
    const emptyState = document.getElementById('empty-state');
    const notesGrid = document.getElementById('notes-grid');
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshIcon = document.getElementById('refresh-icon');
    const exportCsvBtn = document.getElementById('export-csv-btn');
    const cacheTimeDisplay = document.getElementById('cache-time');
    const searchInput = document.getElementById('search-input');
    const selectedBadge = document.getElementById('selected-badge');
    
    // Stats Elements
    const statTotal = document.getElementById('stat-total');
    const statFeatures = document.getElementById('stat-features');

    // Composer Elements
    const composerPanel = document.getElementById('composer-panel');
    const closeComposerBtn = document.getElementById('close-composer');
    const previewTypeBadge = document.getElementById('preview-type-badge');
    const previewDateLbl = document.getElementById('preview-date-lbl');
    const previewContentText = document.getElementById('preview-content-text');
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCountDisplay = document.getElementById('char-count');
    const charProgress = document.getElementById('char-progress');
    const tweetBtn = document.getElementById('tweet-btn');
    const tagButtons = document.querySelectorAll('.tag-btn');

    // Circle Progress Calculation (r = 10, circumference = 2 * PI * 10 = 62.83)
    const ringCircumference = 2 * Math.PI * 10;
    charProgress.style.strokeDasharray = `${ringCircumference} ${ringCircumference}`;
    charProgress.style.strokeDashoffset = ringCircumference;

    // Initialize UI
    fetchNotes(false);

    // Event Listeners
    refreshBtn.addEventListener('click', () => fetchNotes(true));
    exportCsvBtn.addEventListener('click', exportToCSV);
    searchInput.addEventListener('input', handleSearch);
    closeComposerBtn.addEventListener('click', deselectNote);
    tweetTextarea.addEventListener('input', updateCharCount);
    tweetBtn.addEventListener('click', publishTweet);

    // Category filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            currentFilter = target.dataset.type;
            applyFilters();
        });
    });

    // Quick tag buttons in composer
    tagButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.dataset.tag;
            const text = tweetTextarea.value;
            // Add hashtag if not already present in the textarea
            if (!text.includes(tag)) {
                const space = text.endsWith(' ') || text === '' ? '' : ' ';
                tweetTextarea.value = text + space + tag;
                updateCharCount();
            }
        });
    });

    // API Fetch function
    async function fetchNotes(forceRefresh = false) {
        setLoadingState(true);
        try {
            const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.success) {
                allNotes = data.notes;
                cacheTimeDisplay.textContent = formatCacheTime(data.cached_at);
                updateStats();
                applyFilters();
            } else {
                showError("API Error: " + (data.error || "Failed to fetch data"));
            }
        } catch (error) {
            console.error(error);
            showError("Network Error: Could not load release notes.");
        } finally {
            setLoadingState(false);
            // Ensure icons are re-rendered after dynamic updates if needed
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
    }

    // Set UI Loader state
    function setLoadingState(isLoading) {
        if (isLoading) {
            loader.style.display = 'flex';
            refreshIcon.classList.add('spinning');
            refreshBtn.disabled = true;
        } else {
            loader.style.display = 'none';
            refreshIcon.classList.remove('spinning');
            refreshBtn.disabled = false;
        }
    }

    // Show error message
    function showError(msg) {
        notesGrid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <i data-lucide="alert-triangle" style="color: var(--color-issue); width: 48px; height: 48px;"></i>
                <h3>An error occurred</h3>
                <p>${msg}</p>
                <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 10px;">Retry</button>
            </div>
        `;
        if (window.lucide) window.lucide.createIcons();
    }

    // Format cache datetime string
    function formatCacheTime(timeStr) {
        if (!timeStr) return "Never";
        // Convert "YYYY-MM-DD HH:MM:SS" into friendlier time
        try {
            const parts = timeStr.split(' ');
            const timeParts = parts[1].split(':');
            return `${timeParts[0]}:${timeParts[1]}`;
        } catch (e) {
            return timeStr;
        }
    }

    // Update statistics
    function updateStats() {
        statTotal.textContent = allNotes.length;
        const features = allNotes.filter(n => n.type.toLowerCase() === 'feature').length;
        statFeatures.textContent = features;
    }

    // Search input handler
    function handleSearch(e) {
        searchQuery = e.target.value.toLowerCase().trim();
        applyFilters();
    }

    // Combine category filters and text search
    function applyFilters() {
        filteredNotes = allNotes.filter(note => {
            // Category check
            let matchesCategory = true;
            if (currentFilter !== 'all') {
                if (currentFilter === 'other') {
                    const knownTypes = ['feature', 'issue', 'deprecation', 'change'];
                    matchesCategory = !knownTypes.includes(note.type.toLowerCase());
                } else {
                    matchesCategory = note.type.toLowerCase() === currentFilter.toLowerCase();
                }
            }

            // Text search check
            let matchesSearch = true;
            if (searchQuery) {
                matchesSearch = note.text.toLowerCase().includes(searchQuery) ||
                                note.type.toLowerCase().includes(searchQuery) ||
                                note.date.toLowerCase().includes(searchQuery);
            }

            return matchesCategory && matchesSearch;
        });

        renderNotes();
    }

    // Render list of note cards
    function renderNotes() {
        if (filteredNotes.length === 0) {
            emptyState.style.display = 'flex';
            notesGrid.style.display = 'none';
        } else {
            emptyState.style.display = 'none';
            notesGrid.style.display = 'grid';
            
            notesGrid.innerHTML = filteredNotes.map(note => {
                const isSelected = selectedNote && selectedNote.id === note.id;
                const typeClass = note.type.toLowerCase();
                
                // Truncate text for the card display
                const maxLen = 300;
                let displayHtml = note.html;
                
                return `
                    <div class="note-card ${isSelected ? 'selected' : ''}" data-id="${note.id}">
                        <div class="card-header">
                            <span class="type-tag ${typeClass}">${note.type}</span>
                            <span class="card-date">${note.date}</span>
                        </div>
                        <div class="card-body">
                            ${displayHtml}
                        </div>
                        <div class="card-footer">
                            <button class="btn-card-action tweet-action" data-action="tweet">
                                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                                <span>Tweet</span>
                            </button>
                            <button class="btn-card-action copy-action" data-action="copy">
                                <i data-lucide="copy"></i>
                                <span>Copy</span>
                            </button>
                            <a href="${note.link}" target="_blank" class="btn-card-action link-action" style="text-decoration: none;">
                                <i data-lucide="external-link"></i>
                                <span>Details</span>
                            </a>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Attach click listener for cards
        document.querySelectorAll('.note-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // If they clicked the details link (external link icon), let standard link navigation happen
                if (e.target.closest('.link-action')) {
                    return;
                }
                
                // If they clicked the copy button, copy the content and prevent selection!
                const copyBtn = e.target.closest('.copy-action');
                if (copyBtn) {
                    const noteId = card.dataset.id;
                    const noteObj = allNotes.find(n => n.id === noteId);
                    if (noteObj) {
                        copyNoteToClipboard(noteObj, copyBtn);
                    }
                    return;
                }
                
                const noteId = card.dataset.id;
                const noteObj = allNotes.find(n => n.id === noteId);
                
                if (noteObj) {
                    selectNote(noteObj);
                }
            });
        });

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    // Handle note selection
    function selectNote(note) {
        selectedNote = note;
        
        // Visual class updates on cards
        document.querySelectorAll('.note-card').forEach(card => {
            if (card.dataset.id === note.id) {
                card.classList.add('selected');
            } else {
                card.classList.remove('selected');
            }
        });

        // Update selected header badge
        selectedBadge.style.display = 'flex';

        // Prepare X/Twitter compose draft
        previewTypeBadge.textContent = note.type;
        previewTypeBadge.className = `preview-type type-tag ${note.type.toLowerCase()}`;
        previewDateLbl.textContent = note.date;
        previewContentText.textContent = note.text;

        // Auto-generate tweet content (ensure fits in 280)
        generateTweetDraft(note);

        // Slide composer in
        composerPanel.classList.add('open');
    }

    // Deselect note
    function deselectNote() {
        selectedNote = null;
        selectedBadge.style.display = 'none';
        composerPanel.classList.remove('open');
        document.querySelectorAll('.note-card').forEach(card => {
            card.classList.remove('selected');
        });
    }

    // Generate Twitter text draft under 280 chars
    function generateTweetDraft(note) {
        const url = note.link || "https://cloud.google.com/bigquery/docs/release-notes";
        
        // Define default tags
        const tags = " #BigQuery #GoogleCloud";
        
        // Header pattern
        const header = `BigQuery ${note.type} (${note.date}):\n"`;
        
        // Link + tags section
        const footer = `"\n\nRelease notes: ${url}${tags}`;
        
        // Calculate remaining characters for the description
        const currentUsed = header.length + footer.length;
        const maxDescriptionLen = 280 - currentUsed;
        
        let description = note.text;
        
        // Clean description from extra whitespaces
        description = description.replace(/\s+/g, ' ').trim();
        
        if (description.length > maxDescriptionLen) {
            // Leave room for '...'
            description = description.substring(0, maxDescriptionLen - 3) + "...";
        }
        
        const fullTweetText = `${header}${description}${footer}`;
        
        tweetTextarea.value = fullTweetText;
        updateCharCount();
    }

    // Update characters count indicator
    function updateCharCount() {
        const currentLength = tweetTextarea.value.length;
        const remaining = 280 - currentLength;
        
        charCountDisplay.textContent = remaining;
        
        // Handle visual warning states
        if (remaining < 0) {
            charCountDisplay.style.color = 'var(--color-issue)';
            charProgress.style.stroke = 'var(--color-issue)';
            tweetBtn.disabled = true;
            tweetBtn.style.opacity = 0.5;
        } else {
            charCountDisplay.style.color = remaining <= 20 ? 'var(--color-change)' : 'var(--text-secondary)';
            charProgress.style.stroke = remaining <= 20 ? 'var(--color-change)' : 'var(--primary)';
            tweetBtn.disabled = false;
            tweetBtn.style.opacity = 1;
        }

        // Calculate stroke offset
        const percentage = Math.min(currentLength / 280, 1);
        const offset = ringCircumference - (percentage * ringCircumference);
        charProgress.style.strokeDashoffset = offset;
    }

    // Publish to Twitter
    function publishTweet() {
        const text = tweetTextarea.value;
        if (text.length > 280) {
            alert("Your tweet exceeds the 280 character limit.");
            return;
        }
        
        const twitterIntentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(twitterIntentUrl, '_blank');
    }

    // Copy single note text content to clipboard with visual feedback
    function copyNoteToClipboard(note, buttonElement) {
        const textToCopy = `BigQuery ${note.type} Update (${note.date}):\n${note.text}\n\nRead more: ${note.link}`;
        navigator.clipboard.writeText(textToCopy).then(() => {
            const span = buttonElement.querySelector('span');
            const icon = buttonElement.querySelector('i');
            
            const originalText = span.textContent;
            span.textContent = "Copied!";
            buttonElement.style.color = "#10b981"; // green accent
            
            if (icon) {
                icon.setAttribute('data-lucide', 'check');
                if (window.lucide) window.lucide.createIcons();
            }
            
            setTimeout(() => {
                span.textContent = originalText;
                buttonElement.style.color = "";
                if (icon) {
                    icon.setAttribute('data-lucide', 'copy');
                    if (window.lucide) window.lucide.createIcons();
                }
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            alert('Could not copy to clipboard.');
        });
    }

    // Export currently filtered list of notes to a standard CSV file
    function exportToCSV() {
        if (filteredNotes.length === 0) {
            alert("No notes available to export.");
            return;
        }
        
        const headers = ['Date', 'Type', 'Content', 'Source Link'];
        const rows = filteredNotes.map(note => [
            note.date,
            note.type,
            note.text,
            note.link
        ]);
        
        // Wrap cells in double quotes and escape double quotes
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
        ].join('\r\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `bigquery_release_notes_${currentFilter}_export.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});
