/**
 * TOEIC Vocab Spark - Main Logic & State Engine
 */

// --- Global Error Capturing & Recovery (Try-Catch Toàn cục) ---
window.addEventListener('error', (event) => {
    console.error('Phát hiện lỗi runtime:', event.error || event.message);
    const container = document.getElementById('toast-container');
    if (container && typeof showToast === 'function') {
        showToast(`Lỗi hệ thống: ${event.message || 'Đã xảy ra sự cố'}`, 'error');
    } else {
        alert(`Phát hiện lỗi hệ thống: ${event.message}\nVui lòng tải lại trang.`);
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Phát hiện lỗi Promise bất đồng bộ:', event.reason);
    const container = document.getElementById('toast-container');
    if (container && typeof showToast === 'function') {
        showToast(`Lỗi xử lý bất đồng bộ: ${event.reason?.message || 'Yêu cầu thất bại'}`, 'error');
    }
});

// --- Global State ---
let topics = [];
let fallbackWords = {};
let currentTopicId = null;
let currentWords = [];
let currentWordIndex = 0;
let studyProgress = {}; // Stores FSRS and Stats progress by word ID: { [wordId]: { fsrs, statistics } }
let activeTab = 'home';
let currentMode = 'flashcard'; // 'flashcard' or 'quiz'

// Quiz Session State
let quizWords = [];
let quizIndex = 0;
let quizScore = { correct: 0, wrong: 0 };
let quizAnswersChecked = false;

// Review Session State
let dueReviewWords = [];
let reviewIndex = 0;
let isReviewSessionActive = false;

// App Settings
let appSettings = {
    theme: 'dark',
    speechRate: 1.0,
    newWordsPerDay: 10,
    quizRepsPerSession: 10,
    autoSpeak: true,
    showIPA: true,
    showExample: true,
    autoFlip: false,
    reviewLimit: 100,
    prioritizeWeak: true,
    goalNewWords: 10,
    goalReviews: 50,
    goalStreak: 7,
    speechVoice: 'us'
};

// --- DOM Elements Cache ---
const elements = {
    // Navigation
    navButtons: document.querySelectorAll('.nav-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    reviewBadge: document.getElementById('review-badge'),
    
    // Welcome Banner & Stats
    statsTotalLearned: document.getElementById('stats-total-learned'),
    statsTotalMastered: document.getElementById('stats-total-mastered'),
    btnHomeLearn: document.getElementById('btn-home-learn'),
    btnHomeReview: document.getElementById('btn-home-review'),
    homeReviewDueStatus: document.getElementById('home-review-due-status'),
    
    // Home View
    searchTopics: document.getElementById('search-topics'),
    topicsGrid: document.getElementById('topics-grid-container'),
    topicDetailView: document.getElementById('topic-detail-view'),
    detailTopicTitle: document.getElementById('detail-topic-title'),
    btnBackToTopics: document.getElementById('btn-back-to-topics'),
    btnModeFlashcard: document.getElementById('btn-mode-flashcard'),
    btnModeQuiz: document.getElementById('btn-mode-quiz'),
    
    // Flashcards Mode
    flashcardModeContainer: document.getElementById('flashcard-mode-container'),
    flashcardProgressText: document.getElementById('flashcard-progress-text'),
    flashcardProgressPercent: document.getElementById('flashcard-progress-percent'),
    flashcardProgressFill: document.getElementById('flashcard-progress-fill'),
    studyFlashcard: document.getElementById('study-flashcard'),
    cardFrontPos: document.getElementById('card-front-pos'),
    cardFrontWord: document.getElementById('card-front-word'),
    cardFrontPronunciation: document.getElementById('card-front-pronunciation'),
    btnPlayAudio: document.getElementById('btn-play-audio'),
    cardBackPos: document.getElementById('card-back-pos'),
    btnPlayAudioBack: document.getElementById('btn-play-audio-back'),
    cardBackTranslation: document.getElementById('card-back-translation'),
    cardBackDefinition: document.getElementById('card-back-definition'),
    cardBackExample: document.getElementById('card-back-example'),
    cardBackExampleVi: document.getElementById('card-back-example-vi'),
    cardBackCollocationsContainer: document.getElementById('card-back-collocations-container'),
    cardBackCollocations: document.getElementById('card-back-collocations'),
    fsrsButtonsPanel: document.getElementById('fsrs-buttons-panel'),
    
    // Quiz Mode
    quizModeContainer: document.getElementById('quiz-mode-container'),
    quizProgressText: document.getElementById('quiz-progress-text'),
    quizScoreText: document.getElementById('quiz-score-text'),
    quizProgressFill: document.getElementById('quiz-progress-fill'),
    quizQuestionWord: document.getElementById('quiz-question-word'),
    quizQuestionPronunciation: document.getElementById('quiz-question-pronunciation'),
    btnPlayQuizAudio: document.getElementById('btn-play-quiz-audio'),
    quizOptionsContainer: document.getElementById('quiz-options-container'),
    quizFeedbackBox: document.getElementById('quiz-feedback-box'),
    quizFeedbackIcon: document.getElementById('quiz-feedback-icon'),
    quizFeedbackText: document.getElementById('quiz-feedback-text'),
    btnNextQuiz: document.getElementById('btn-next-quiz'),
    
    // Review Tab
    reviewDueCount: document.getElementById('review-due-count'),
    reviewTotalLearned: document.getElementById('review-total-learned'),
    reviewEmptyState: document.getElementById('review-empty-state'),
    reviewActiveState: document.getElementById('review-active-state'),
    btnStartReviewSession: document.getElementById('btn-start-review-session'),
    
    // Review Session Overlay
    reviewSessionOverlay: document.getElementById('review-session-overlay'),
    btnCloseReviewSession: document.getElementById('btn-close-review-session'),
    reviewProgressText: document.getElementById('review-progress-text'),
    reviewProgressPercent: document.getElementById('review-progress-percent'),
    reviewProgressFill: document.getElementById('review-progress-fill'),
    reviewFlashcard: document.getElementById('review-flashcard'),
    reviewCardFrontPos: document.getElementById('review-card-front-pos'),
    reviewCardFrontWord: document.getElementById('review-card-front-word'),
    reviewCardFrontPronunciation: document.getElementById('review-card-front-pronunciation'),
    btnPlayReviewAudio: document.getElementById('btn-play-review-audio'),
    reviewCardBackPos: document.getElementById('review-card-back-pos'),
    btnPlayReviewAudioBack: document.getElementById('btn-play-review-audio-back'),
    reviewCardBackTranslation: document.getElementById('review-card-back-translation'),
    reviewCardBackDefinition: document.getElementById('review-card-back-definition'),
    reviewCardBackExample: document.getElementById('review-card-back-example'),
    reviewCardBackExampleVi: document.getElementById('review-card-back-example-vi'),
    reviewFsrsButtonsPanel: document.getElementById('review-fsrs-buttons-panel'),
    
    // Settings Tab
    btnThemeDark: document.getElementById('btn-theme-dark'),
    btnThemeLight: document.getElementById('btn-theme-light'),
    settingsSpeechRate: document.getElementById('settings-speech-rate'),
    speechRateVal: document.getElementById('speech-rate-val'),
    btnExportData: document.getElementById('btn-export-data'),
    btnImportTrigger: document.getElementById('btn-import-trigger'),
    importFileInput: document.getElementById('import-file-input'),
    btnResetData: document.getElementById('btn-reset-data'),
    settingsNewWordsDay: document.getElementById('settings-new-words-day'),
    settingsQuizReps: document.getElementById('settings-quiz-reps'),
    settingsAutoSpeak: document.getElementById('settings-auto-speak'),
    settingsShowIpa: document.getElementById('settings-show-ipa'),
    settingsShowExample: document.getElementById('settings-show-example'),
    settingsAutoFlip: document.getElementById('settings-auto-flip'),
    settingsReviewLimit: document.getElementById('settings-review-limit'),
    settingsPrioritizeWeak: document.getElementById('settings-prioritize-weak'),
    settingsGoalNewWords: document.getElementById('settings-goal-new-words'),
    settingsGoalReviews: document.getElementById('settings-goal-reviews'),
    settingsGoalStreak: document.getElementById('settings-goal-streak'),
    settingsSpeechVoice: document.getElementById('settings-speech-voice'),
    infoDataSize: document.getElementById('info-data-size'),
    infoTotalWords: document.getElementById('info-total-words'),
    
    // Notebook View
    btnToggleNotebook: document.getElementById('btn-toggle-notebook'),
    notebookView: document.getElementById('notebook-view'),
    btnNotebookBack: document.getElementById('btn-notebook-back'),
    notebookTopicSearchList: document.getElementById('notebook-topic-search-list'),
    notebookTopicsGrid: document.getElementById('notebook-topics-grid-container'),
    notebookTopicDetailScreen: document.getElementById('notebook-topic-detail-screen'),
    notebookTopicListScreen: document.getElementById('notebook-topic-list-screen'),
    btnNotebookTopicDetailBack: document.getElementById('btn-notebook-topic-detail-back'),
    notebookActiveTopicIcon: document.getElementById('notebook-active-topic-icon'),
    notebookActiveTopicName: document.getElementById('notebook-active-topic-name'),
    notebookActiveTopicDesc: document.getElementById('notebook-active-topic-desc'),
    notebookWordSearch: document.getElementById('notebook-word-search'),
    notebookWordStatusFilter: document.getElementById('notebook-word-status-filter'),
    notebookTopicWordsList: document.getElementById('notebook-topic-words-list-container'),
    notebookSchedSearch: document.getElementById('notebook-sched-search'),
    notebookSchedTimeFilter: document.getElementById('notebook-sched-time-filter'),
    notebookSchedTimeline: document.getElementById('notebook-sched-timeline-container'),
    
    // Notification Container
    toastContainer: document.getElementById('toast-container')
};

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        loadSettings();
        loadProgress();
        setupEventListeners();
        await loadInitialData();
        updateGlobalStats();
        updateReviewDashboard();
        
        // Init Lucide Icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    } catch (error) {
        console.error("Lỗi nghiêm trọng khi khởi tạo ứng dụng:", error);
        const container = document.getElementById('toast-container');
        if (container && typeof showToast === 'function') {
            showToast("Lỗi khởi tạo ứng dụng! Vui lòng làm mới trang.", "error");
        } else {
            alert("Lỗi khởi tạo ứng dụng! Vui lòng tải lại trang.");
        }
    }
});

// --- Settings & LocalStorage Core ---
function loadSettings() {
    const savedSettings = localStorage.getItem('toeic_vocab_settings');
    if (savedSettings) {
        try {
            appSettings = { ...appSettings, ...JSON.parse(savedSettings) };
        } catch (e) {
            console.error('Lỗi phân tích cài đặt:', e);
        }
    }
    
    // Apply Settings
    applyTheme(appSettings.theme);
    if (elements.settingsSpeechRate) {
        elements.settingsSpeechRate.value = appSettings.speechRate;
    }
    if (elements.speechRateVal) {
        elements.speechRateVal.innerText = `${appSettings.speechRate.toFixed(1)}x`;
    }
    
    // Apply settings to elements
    if (elements.settingsNewWordsDay) elements.settingsNewWordsDay.value = appSettings.newWordsPerDay;
    if (elements.settingsQuizReps) elements.settingsQuizReps.value = appSettings.quizRepsPerSession;
    if (elements.settingsAutoSpeak) elements.settingsAutoSpeak.checked = appSettings.autoSpeak;
    if (elements.settingsShowIpa) elements.settingsShowIpa.checked = appSettings.showIPA;
    if (elements.settingsShowExample) elements.settingsShowExample.checked = appSettings.showExample;
    if (elements.settingsAutoFlip) elements.settingsAutoFlip.checked = appSettings.autoFlip;
    if (elements.settingsReviewLimit) elements.settingsReviewLimit.value = appSettings.reviewLimit;
    if (elements.settingsPrioritizeWeak) elements.settingsPrioritizeWeak.checked = appSettings.prioritizeWeak;
    if (elements.settingsGoalNewWords) elements.settingsGoalNewWords.value = appSettings.goalNewWords;
    if (elements.settingsGoalReviews) elements.settingsGoalReviews.value = appSettings.goalReviews;
    if (elements.settingsGoalStreak) elements.settingsGoalStreak.value = appSettings.goalStreak;
    if (elements.settingsSpeechVoice) elements.settingsSpeechVoice.value = appSettings.speechVoice;
    
    updateSettingsInfoCard();
}

function saveSettings() {
    localStorage.setItem('toeic_vocab_settings', JSON.stringify(appSettings));
    updateSettingsInfoCard();
}

function updateSettingsInfoCard() {
    // 1. Data size
    const progressStr = localStorage.getItem('toeic_vocab_progress') || '';
    const settingsStr = localStorage.getItem('toeic_vocab_settings') || '';
    const totalBytes = progressStr.length + settingsStr.length;
    if (elements.infoDataSize) {
        if (totalBytes === 0) {
            elements.infoDataSize.innerText = '0 bytes';
        } else if (totalBytes < 1024) {
            elements.infoDataSize.innerText = `${totalBytes} bytes`;
        } else {
            elements.infoDataSize.innerText = `${(totalBytes / 1024).toFixed(1)} KB`;
        }
    }
    
    // 2. Total words
    if (elements.infoTotalWords) {
        const total = topics.reduce((acc, t) => acc + (t.totalWords || 0), 0);
        if (total > 0) {
            elements.infoTotalWords.innerText = `${total} từ`;
        } else {
            elements.infoTotalWords.innerText = '1,500 từ';
        }
    }
}

function applyTheme(theme) {
    appSettings.theme = theme;
    if (theme === 'light') {
        document.body.classList.remove('dark-theme');
        document.body.classList.add('light-theme');
        elements.btnThemeDark.classList.remove('active');
        elements.btnThemeLight.classList.add('active');
    } else {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
        elements.btnThemeLight.classList.remove('active');
        elements.btnThemeDark.classList.add('active');
    }
    saveSettings();
}

function loadProgress() {
    const savedProgress = localStorage.getItem('toeic_vocab_progress');
    if (savedProgress) {
        try {
            studyProgress = JSON.parse(savedProgress);
        } catch (e) {
            console.error('Lỗi phân tích tiến độ học tập:', e);
            studyProgress = {};
        }
    } else {
        studyProgress = {};
    }
}

function saveProgress() {
    localStorage.setItem('toeic_vocab_progress', JSON.stringify(studyProgress));
    updateGlobalStats();
    updateReviewDashboard();
}

// --- FSRS Algorithm Implementation ---
/**
 * Simple FSRS scheduler
 * rating: 1 = Again, 2 = Hard, 3 = Good, 4 = Easy
 */
function calculateFSRS(wordId, rating) {
    const now = new Date();
    
    // Get existing FSRS or initialize empty FSRS object
    const wordProgress = studyProgress[wordId] || {
        fsrs: { due: null, stability: 0.0, difficultyFSRS: 3.0, reps: 0, lapses: 0, lastReview: null, state: 'New' },
        statistics: { correct: 0, wrong: 0, accuracy: 0.0, studyTime: 0, lastSeen: null, mastered: false }
    };
    
    let { due, stability, difficultyFSRS, reps, lapses, lastReview, state } = wordProgress.fsrs;
    let { correct, wrong, accuracy, studyTime, lastSeen, mastered } = wordProgress.statistics;
    
    // Update basic stats
    lastSeen = now.toISOString();
    
    if (rating === 1) {
        // Again
        lapses += 1;
        reps = 0;
        wrong += 1;
        
        // Reset or collapse stability
        stability = 10 / 1440; // 10 minutes (expressed in days)
        difficultyFSRS = Math.min(10.0, difficultyFSRS + 1.0);
        state = 'Learning';
        due = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10 minutes from now
    } else {
        // Correct responses
        correct += 1;
        reps += 1;
        
        if (state === 'New' || state === 'Learning') {
            state = 'Review';
        }
        
        // Update Difficulty (lower value means easier word)
        let diffDelta = 0;
        if (rating === 2) diffDelta = 0.5; // Hard
        if (rating === 3) diffDelta = 0;   // Good
        if (rating === 4) diffDelta = -0.5; // Easy
        
        difficultyFSRS = Math.max(1.0, Math.min(10.0, difficultyFSRS + diffDelta));
        
        // Update Stability (retention interval in days)
        if (reps === 1) {
            // Initial stability based on rating
            if (rating === 2) stability = 1.0; // 1 day
            if (rating === 3) stability = 3.0; // 3 days
            if (rating === 4) stability = 7.0; // 7 days
        } else {
            // Multiplier depends on rating and difficulty
            let factor = 1.0;
            const diffFactor = (11.0 - difficultyFSRS) / 10.0; // easier words scale faster
            
            if (rating === 2) factor = 1.2 * diffFactor; // Hard
            if (rating === 3) factor = 2.4 * diffFactor; // Good
            if (rating === 4) factor = 4.5 * diffFactor; // Easy
            
            stability = Math.max(1.0, stability * factor);
        }
        
        // Set new due date (stability is in days)
        const dueTime = now.getTime() + stability * 24 * 60 * 60 * 1000;
        due = new Date(dueTime).toISOString();
    }
    
    // Calculate total accuracy
    const totalSeen = correct + wrong;
    accuracy = totalSeen > 0 ? (correct / totalSeen) * 100 : 0.0;
    
    // Mastered conditions: stability >= 14 days or reps >= 3 with good accuracy
    mastered = (stability >= 14.0) || (reps >= 3 && accuracy >= 80.0);
    
    // Update word progress structure
    wordProgress.fsrs = { due, stability, difficultyFSRS, reps, lapses, lastReview: now.toISOString(), state };
    wordProgress.statistics = { correct, wrong, accuracy, studyTime, lastSeen, mastered };
    
    // Save back to progress database
    studyProgress[wordId] = wordProgress;
    saveProgress();
}

// --- Data Fetching Operations ---
async function loadInitialData() {
    try {
        // Load fallback words first so they are available immediately in case of topic file errors
        const fallbackRes = await fetch('./data/fallback_words.json');
        if (fallbackRes.ok) {
            fallbackWords = await fallbackRes.json();
        }
    } catch (e) {
        console.warn('Không thể tải fallback_words.json:', e);
    }
    
    try {
        const topicsRes = await fetch('./data/topics.json');
        if (topicsRes.ok) {
            topics = await topicsRes.json();
            renderTopicsList();
            updateSettingsInfoCard();
        } else {
            showToast('Không thể tải cấu hình chủ đề', 'error');
        }
    } catch (e) {
        console.error('Lỗi tải topics.json:', e);
        showToast('Lỗi mạng khi tải chủ đề', 'error');
        elements.topicsGrid.innerHTML = `
            <div class="loading-state">
                <i data-lucide="alert-triangle" style="width: 48px; height: 48px; color: var(--danger);"></i>
                <p style="margin-top: 10px;">Lỗi tải dữ liệu. Vui lòng làm mới trang.</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

async function loadVocabularyForTopic(topicId) {
    elements.topicsGrid.classList.add('hidden');
    elements.topicDetailView.classList.remove('hidden');
    
    // Hide search bar
    const searchBar = document.querySelector('.search-filter-bar');
    if (searchBar) searchBar.classList.add('hidden');
    
    // Enable Fullscreen Focused Study Mode
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.classList.add('fullscreen-study-mode');
    
    elements.detailTopicTitle.innerText = 'Đang tải...';
    
    // Find topic info
    const topicObj = topics.find(t => t.id === topicId);
    if (topicObj) {
        elements.detailTopicTitle.innerText = topicObj.name;
    }
    
    let wordsData = [];
    try {
        const vocabRes = await fetch(`./data/vocabulary/${topicId}.json`);
        if (vocabRes.ok) {
            wordsData = await vocabRes.json();
        } else {
            throw new Error(`Failed to load ${topicId}.json`);
        }
    } catch (e) {
        console.warn(`Lỗi fetch data cho chủ đề ${topicId}, sử dụng fallback.`, e);
        if (fallbackWords[topicId]) {
            wordsData = fallbackWords[topicId];
        } else {
            showToast('Không thể tải từ vựng cho chủ đề này', 'error');
            goBackToTopics();
            return;
        }
    }
    
    currentTopicId = topicId;
    // Map words, injecting progress stats from localStorage
    // Map words, injecting progress stats, split into studied vs new, and cap new words by settingsNewWordsDay
    const learnedWords = [];
    const newWords = [];
    
    wordsData.forEach(word => {
        const progress = studyProgress[word.id];
        const mappedWord = {
            ...word,
            fsrs: progress ? progress.fsrs : { ...word.fsrs },
            statistics: progress ? progress.statistics : { ...word.statistics }
        };
        
        if (progress && progress.statistics.lastSeen) {
            learnedWords.push(mappedWord);
        } else {
            newWords.push(mappedWord);
        }
    });
    
    // Cap new words based on settings
    const cappedNewWords = newWords.slice(0, appSettings.newWordsPerDay);

    // Priority queue: words due for review today come first (earliest due first),
    // then brand-new/unrated words, then already-learned words not yet due.
    const now = new Date();
    const isDue = (w) => w.fsrs && w.fsrs.due && new Date(w.fsrs.due) <= now;

    const dueWords = learnedWords.filter(isDue).sort((a, b) => new Date(a.fsrs.due) - new Date(b.fsrs.due));
    const notDueWords = learnedWords.filter(w => !isDue(w));

    currentWords = [...dueWords, ...cappedNewWords, ...notDueWords];

    currentWordIndex = 0;
    currentMode = 'flashcard';
    
    // Reset buttons
    elements.btnModeFlashcard.classList.add('active');
    elements.btnModeQuiz.classList.remove('active');
    elements.flashcardModeContainer.classList.remove('hidden');
    elements.quizModeContainer.classList.add('hidden');
    
    // Render
    showWordFlashcard();
}

// --- Render Topic Grid & Search ---
function renderTopicsList() {
    if (!elements.topicsGrid) return;
    
    const searchQuery = elements.searchTopics ? elements.searchTopics.value.toLowerCase().trim() : '';
    elements.topicsGrid.innerHTML = '';
    
    const filteredTopics = topics.filter(topic => 
        topic.name.toLowerCase().includes(searchQuery) || 
        topic.desc.toLowerCase().includes(searchQuery)
    );
    
    if (filteredTopics.length === 0) {
        elements.topicsGrid.innerHTML = `
            <div class="loading-state">
                <i data-lucide="frown" style="width: 40px; height: 40px;"></i>
                <p style="margin-top: 10px;">Không tìm thấy chủ đề phù hợp.</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    filteredTopics.forEach(topic => {
        // Calculate progress in studyProgress
        let totalTopicWords = topic.totalWords || 10;
        let learnedCount = 0;
        let masteredCount = 0;
        
        // Find how many words of this topic are in local progress storage
        // Each vocab item has a topic field
        Object.keys(studyProgress).forEach(wordId => {
            const wordData = studyProgress[wordId];
            // Match topic. Needs to check either topic name or tags
            const wordTopic = wordData.statistics.lastSeen ? true : false;
            // Since we don't have all words pre-loaded in memory, we can check if the progress record belongs to this topic
            // When we fetch the topic we'll load word ids. For now, since topic name is saved inside vocab items, we check topic
            if (wordData.statistics.lastSeen) {
                // If it is in studyProgress, it is "learned".
                // Let's verify topic matching. We can estimate this or map by topic code.
                // We'll verify when saving that we tags or topic ids.
                // In accounting.json, topic is "Accounting" which matches topics.name ("Accounting" or similar).
                // Let's check topic name similarity
                const savedTopic = wordData.fsrs.due ? true : false;
                // Wait! A robust way is that topic.json has id (e.g. "accounting").
                // If we match ID or lower cased name:
                const idMatch = topic.id;
                // Let's assume matching logic by tag or topic metadata if present
            }
        });
        
        // Let's do a more precise progress calculation:
        // We will query our local storage. To map a word to a topic, let's look at the word's prefix id
        // Example: word.id in accounting is 10001 (Accounting ID starts with 1), common_verbs starts with 1001.
        // Let's count them dynamically based on loaded data. But since we don't have all files pre-loaded, we can save which topic a word belongs to in localStorage progress
        // Yes! When we update a word's FSRS, we can save its topicId into progress too, e.g. progress[wordId].topicId = currentTopicId.
        // That is a brilliant design! Let's do that in calculateFSRS: we can save topicId.
        // Let's count words belonging to this topic:
        Object.keys(studyProgress).forEach(wId => {
            const wProg = studyProgress[wId];
            if (wProg.topicId === topic.id) {
                learnedCount++;
                if (wProg.statistics.mastered) {
                    masteredCount++;
                }
            }
        });
        
        const percent = totalTopicWords > 0 ? Math.round((learnedCount / totalTopicWords) * 100) : 0;
        
        const card = document.createElement('div');
        card.className = 'topic-card';
        card.setAttribute('data-id', topic.id);
        card.innerHTML = `
            <div class="topic-card-header">
                <div class="topic-icon">${topic.icon || '📚'}</div>
                <div class="topic-card-title-group">
                    <h3>${topic.name}</h3>
                    <span class="topic-meta">${totalTopicWords} từ</span>
                </div>
            </div>
            <p>${topic.desc}</p>
            <div class="topic-progress-wrapper">
                <div class="progress-track">
                    <div class="progress-fill" style="width: ${percent}%;"></div>
                </div>
                <div class="topic-progress-info">
                    <span>Đã học: <strong class="completed">${learnedCount}</strong></span>
                    <span>${percent}%</span>
                </div>
            </div>
        `;
        
        card.addEventListener('click', () => loadVocabularyForTopic(topic.id));
        elements.topicsGrid.appendChild(card);
    });
}

function goBackToTopics() {
    elements.topicDetailView.classList.add('hidden');
    elements.topicsGrid.classList.remove('hidden');
    
    // Show search bar
    const searchBar = document.querySelector('.search-filter-bar');
    if (searchBar) searchBar.classList.remove('hidden');
    
    // Disable Fullscreen Focused Study Mode
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.classList.remove('fullscreen-study-mode');
    
    currentTopicId = null;
    currentWords = [];
    renderTopicsList();
}

// --- Flashcards Study Engine ---
function showWordFlashcard() {
    if (currentWords.length === 0) return;
    
    // Reset flip status
    elements.studyFlashcard.classList.remove('flipped');
    if (elements.fsrsButtonsPanel) elements.fsrsButtonsPanel.classList.add('hidden');
    
    const word = currentWords[currentWordIndex];
    
    // Set values front
    elements.cardFrontPos.innerText = word.partOfSpeech || 'n/a';
    elements.cardFrontWord.innerText = word.word;
    
    // Check IPA setting
    elements.cardFrontPronunciation.innerText = word.pronunciation || '';
    elements.cardFrontPronunciation.style.display = appSettings.showIPA ? 'block' : 'none';
    
    // Set values back
    elements.cardBackPos.innerText = word.partOfSpeech || 'n/a';
    elements.cardBackTranslation.innerText = word.vietnamese || '';
    elements.cardBackDefinition.innerText = word.definition || 'Không có định nghĩa.';
    
    // Check Show Example setting
    if (word.example && appSettings.showExample) {
        elements.cardBackExample.innerText = word.example;
        elements.cardBackExample.style.display = 'block';
    } else {
        elements.cardBackExample.style.display = 'none';
    }
    
    if (word.exampleVi && appSettings.showExample) {
        elements.cardBackExampleVi.innerText = word.exampleVi;
        elements.cardBackExampleVi.style.display = 'block';
    } else {
        elements.cardBackExampleVi.style.display = 'none';
    }
    
    if (word.collocations) {
        elements.cardBackCollocations.innerText = word.collocations;
        elements.cardBackCollocationsContainer.style.display = 'block';
    } else {
        elements.cardBackCollocationsContainer.style.display = 'none';
    }
    
    // Update progress numbers
    const total = currentWords.length;
    const currentNum = currentWordIndex + 1;
    const progressPercent = Math.round((currentNum / total) * 100);
    
    elements.flashcardProgressText.innerText = `${currentNum} / ${total} từ`;
    elements.flashcardProgressPercent.innerText = `${progressPercent}%`;
    elements.flashcardProgressFill.style.width = `${progressPercent}%`;
    
    // Auto speak when card changes (optional, but premium feature!)
    if (appSettings.autoSpeak) {
        speakWord(word.word);
    }
}

function handleFlashcardRating(rating) {
    if (currentWords.length === 0) return;
    const word = currentWords[currentWordIndex];
    
    // Update progress using FSRS (saving topicId in progress)
    if (!studyProgress[word.id]) {
        studyProgress[word.id] = {
            fsrs: { due: null, stability: 0.0, difficultyFSRS: 3.0, reps: 0, lapses: 0, lastReview: null, state: 'New' },
            statistics: { correct: 0, wrong: 0, accuracy: 0.0, studyTime: 0, lastSeen: null, mastered: false }
        };
    }
    studyProgress[word.id].topicId = currentTopicId;
    calculateFSRS(word.id, rating);
    
    // Update current word's FSRS status so UI updates if flipped back
    const wordProgress = studyProgress[word.id];
    word.fsrs = wordProgress.fsrs;
    word.statistics = wordProgress.statistics;
    
    showToast(`Đã ghi nhận mức độ: ${getRatingLabel(rating)}`, 'success');
    
    // Auto flip card to front for the next word
    elements.studyFlashcard.classList.remove('flipped');
    
    // Delay slightly to allow transition before showing next word
    setTimeout(() => {
        nextCard();
    }, 200);
}

function nextCard() {
    if (currentWords.length === 0) return;
    if (currentWordIndex < currentWords.length - 1) {
        currentWordIndex++;
        showWordFlashcard();
    } else {
        showToast('Chúc mừng! Bạn đã hoàn thành tất cả từ vựng trong chủ đề này.', 'success');
        currentWordIndex = 0; // wrap around
        showWordFlashcard();
    }
}

function getRatingLabel(rating) {
    switch (rating) {
        case 1: return 'Học lại';
        case 2: return 'Khó';
        case 3: return 'Tốt';
        case 4: return 'Dễ';
        default: return '';
    }
}

// --- Quiz Engine ---
function startQuizMode() {
    if (currentWords.length < 4) {
        showToast('Chủ đề phải có ít nhất 4 từ để bắt đầu làm trắc nghiệm.', 'info');
        // Fallback to flashcard mode
        elements.btnModeFlashcard.click();
        return;
    }
    
    currentMode = 'quiz';
    quizWords = [...currentWords].sort(() => 0.5 - Math.random()).slice(0, appSettings.quizRepsPerSession); // Shuffle and limit words
    quizIndex = 0;
    quizScore = { correct: 0, wrong: 0 };
    
    showQuizQuestion();
}

function showQuizQuestion() {
    if (quizWords.length === 0) return;
    
    quizAnswersChecked = false;
    elements.btnNextQuiz.classList.add('hidden');
    elements.quizFeedbackBox.classList.add('hidden');
    
    const word = quizWords[quizIndex];
    
    // Set Question word info
    elements.quizQuestionWord.innerText = word.word;
    elements.quizQuestionPronunciation.innerText = word.pronunciation || '';
    
    // Render Progress Info
    const total = quizWords.length;
    const currentNum = quizIndex + 1;
    const percent = Math.round((currentNum / total) * 100);
    
    elements.quizProgressText.innerText = `Câu hỏi ${currentNum} / ${total}`;
    elements.quizScoreText.innerText = `Đúng: ${quizScore.correct} - Sai: ${quizScore.wrong}`;
    elements.quizProgressFill.style.width = `${percent}%`;
    
    // Generate options: 1 correct + 3 incorrect (randomly selected from the remaining currentWords)
    const options = [word.vietnamese];
    const otherMeanings = currentWords
        .filter(w => w.id !== word.id)
        .map(w => w.vietnamese);
    
    // Shuffle other meanings and pick 3
    const shuffledOthers = otherMeanings.sort(() => 0.5 - Math.random()).slice(0, 3);
    options.push(...shuffledOthers);
    
    // Shuffle the final list of 4 options
    const shuffledOptions = options.sort(() => 0.5 - Math.random());
    
    // Render options
    elements.quizOptionsContainer.innerHTML = '';
    shuffledOptions.forEach(optText => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = optText;
        btn.addEventListener('click', () => handleQuizAnswer(btn, optText, word));
        elements.quizOptionsContainer.appendChild(btn);
    });
    
    speakWord(word.word);
}

function handleQuizAnswer(selectedBtn, selectedText, correctWord) {
    if (quizAnswersChecked) return;
    quizAnswersChecked = true;
    
    const isCorrect = selectedText === correctWord.vietnamese;
    const optionBtns = elements.quizOptionsContainer.querySelectorAll('.option-btn');
    
    // Disable all options, add styles
    optionBtns.forEach(btn => {
        btn.classList.add('disabled');
        if (btn.innerText === correctWord.vietnamese) {
            btn.classList.add('correct');
        }
    });
    
    // Update FSRS stats dynamically behind the scenes!
    // Since Quiz measures retention, correct quiz counts as "Good" (rating = 3), incorrect counts as "Again" (rating = 1)
    if (!studyProgress[correctWord.id]) {
        studyProgress[correctWord.id] = {
            fsrs: { due: null, stability: 0.0, difficultyFSRS: 3.0, reps: 0, lapses: 0, lastReview: null, state: 'New' },
            statistics: { correct: 0, wrong: 0, accuracy: 0.0, studyTime: 0, lastSeen: null, mastered: false }
        };
    }
    studyProgress[correctWord.id].topicId = currentTopicId;
    
    if (isCorrect) {
        quizScore.correct++;
        selectedBtn.classList.add('correct');
        calculateFSRS(correctWord.id, 3); // Good
        
        // Show correct feedback
        elements.quizFeedbackBox.className = 'quiz-feedback correct-feedback';
        elements.quizFeedbackIcon.innerHTML = '<i data-lucide="check-circle-2"></i>';
        elements.quizFeedbackText.innerText = 'Chính xác! Bạn nhớ từ rất tốt.';
    } else {
        quizScore.wrong++;
        selectedBtn.classList.add('incorrect');
        selectedBtn.classList.add('shake');
        calculateFSRS(correctWord.id, 1); // Again
        
        // Show incorrect feedback
        elements.quizFeedbackBox.className = 'quiz-feedback incorrect-feedback';
        elements.quizFeedbackIcon.innerHTML = '<i data-lucide="alert-circle"></i>';
        elements.quizFeedbackText.innerText = `Sai rồi. Nghĩa đúng là: ${correctWord.vietnamese}`;
    }
    
    elements.quizFeedbackBox.classList.remove('hidden');
    elements.btnNextQuiz.classList.remove('hidden');
    elements.quizScoreText.innerText = `Đúng: ${quizScore.correct} - Sai: ${quizScore.wrong}`;
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function nextQuizQuestion() {
    if (quizIndex < quizWords.length - 1) {
        quizIndex++;
        showQuizQuestion();
    } else {
        showToast(`Trắc nghiệm hoàn thành! Kết quả: Đúng ${quizScore.correct}/${quizWords.length}`, 'info');
        // Switch back to flashcard mode on finish
        elements.btnModeFlashcard.click();
    }
}

// --- Text To Speech Engine ---
function speakWord(text) {
    if (!window.speechSynthesis) return;
    
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Accent selection US/UK
    const isUK = appSettings.speechVoice === 'uk';
    utterance.lang = isUK ? 'en-GB' : 'en-US';
    utterance.rate = appSettings.speechRate || 1.0;
    
    // Find matching voice
    const voices = window.speechSynthesis.getVoices();
    let targetVoice = voices.find(voice => voice.lang.toLowerCase() === utterance.lang.toLowerCase());
    if (!targetVoice) {
        targetVoice = voices.find(voice => voice.lang.toLowerCase().startsWith(isUK ? 'en-gb' : 'en-us'));
    }
    if (!targetVoice) {
        targetVoice = voices.find(voice => voice.lang.toLowerCase().startsWith('en'));
    }
    if (targetVoice) {
        utterance.voice = targetVoice;
    }
    
    // Auto flip card when speaking ends
    utterance.onend = () => {
        if (appSettings.autoFlip) {
            // Flip main flashcard
            if (elements.studyFlashcard && !elements.studyFlashcard.classList.contains('flipped')) {
                elements.studyFlashcard.classList.add('flipped');
                if (elements.fsrsButtonsPanel) elements.fsrsButtonsPanel.classList.remove('hidden');
            }
            // Flip review flashcard
            if (isReviewSessionActive && elements.reviewFlashcard && !elements.reviewFlashcard.classList.contains('flipped')) {
                elements.reviewFlashcard.classList.add('flipped');
                if (elements.reviewFsrsButtonsPanel) elements.reviewFsrsButtonsPanel.classList.remove('hidden');
            }
        }
    };
    
    window.speechSynthesis.speak(utterance);
}

// --- Review Tab Logic ---
function updateReviewDashboard() {
    const now = new Date();
    dueReviewWords = [];
    let learnedWordsCount = 0;
    
    Object.keys(studyProgress).forEach(wordId => {
        const wordProg = studyProgress[wordId];
        // Ensure the word belongs to studied history
        if (wordProg.statistics.lastSeen) {
            learnedWordsCount++;
            
            // Check if FSRS due date is passed
            if (wordProg.fsrs.due) {
                const dueTime = new Date(wordProg.fsrs.due);
                if (dueTime <= now) {
                    // We must fetch full word details from topics to show it.
                    // We'll find it dynamically.
                    dueReviewWords.push({
                        id: wordId,
                        fsrs: wordProg.fsrs,
                        statistics: wordProg.statistics,
                        topicId: wordProg.topicId
                    });
                }
            }
        }
    });
    
    // Sort review words based on settings
    if (appSettings.prioritizeWeak) {
        dueReviewWords.sort((a, b) => {
            if (a.fsrs.stability !== b.fsrs.stability) {
                return a.fsrs.stability - b.fsrs.stability;
            }
            return a.statistics.accuracy - b.statistics.accuracy;
        });
    } else {
        dueReviewWords.sort((a, b) => new Date(a.fsrs.due) - new Date(b.fsrs.due));
    }
    
    // Cap review words by review limit
    dueReviewWords = dueReviewWords.slice(0, appSettings.reviewLimit);
    
    // Update Badge & Counts
    if (elements.reviewBadge) {
        if (dueReviewWords.length > 0) {
            elements.reviewBadge.innerText = dueReviewWords.length;
            elements.reviewBadge.style.display = 'inline-block';
        } else {
            elements.reviewBadge.style.display = 'none';
        }
    }
    
    if (elements.reviewDueCount) {
        elements.reviewDueCount.innerText = dueReviewWords.length;
    }
    
    if (elements.reviewTotalLearned) {
        elements.reviewTotalLearned.innerText = learnedWordsCount;
    }
    
    // Update home dashboard status
    if (elements.homeReviewDueStatus) {
        if (dueReviewWords.length > 0) {
            elements.homeReviewDueStatus.innerText = `${dueReviewWords.length} từ đến hạn ôn tập`;
            elements.homeReviewDueStatus.className = 'status-indicator-badge due';
        } else {
            elements.homeReviewDueStatus.innerText = 'Đã hoàn thành ôn tập hôm nay';
            elements.homeReviewDueStatus.className = 'status-indicator-badge';
        }
    }
    
    // Show appropriate container state
    if (dueReviewWords.length > 0) {
        elements.reviewEmptyState.classList.add('hidden');
        elements.reviewActiveState.classList.remove('hidden');
    } else {
        elements.reviewEmptyState.classList.remove('hidden');
        elements.reviewActiveState.classList.add('hidden');
    }
}

// --- Active Review Session overlay Engine ---
async function startReviewSession() {
    if (dueReviewWords.length === 0) return;
    
    // Enable Fullscreen Focused Study Mode
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.classList.add('fullscreen-study-mode');
    
    // We must load full word details for all due items
    // Build unique topic id list
    const uniqueTopicIds = [...new Set(dueReviewWords.map(w => w.topicId).filter(Boolean))];
    
    // Show spinner in overlay first
    elements.reviewSessionOverlay.classList.remove('hidden');
    isReviewSessionActive = true;
    
    // Load words database
    const wordDetailsCache = {};
    await Promise.all(uniqueTopicIds.map(async (tId) => {
        try {
            const res = await fetch(`./data/vocabulary/${tId}.json`);
            if (res.ok) {
                const words = await res.json();
                words.forEach(w => {
                    wordDetailsCache[w.id] = w;
                });
            } else if (fallbackWords[tId]) {
                fallbackWords[tId].forEach(w => {
                    wordDetailsCache[w.id] = w;
                });
            }
        } catch (e) {
            if (fallbackWords[tId]) {
                fallbackWords[tId].forEach(w => {
                    wordDetailsCache[w.id] = w;
                });
            }
        }
    }));
    
    // Map due review list to hold detailed properties
    dueReviewWords = dueReviewWords.map(dueItem => {
        const details = wordDetailsCache[dueItem.id];
        return {
            ...dueItem,
            word: details ? details.word : 'n/a',
            partOfSpeech: details ? details.partOfSpeech : 'n/a',
            pronunciation: details ? details.pronunciation : '',
            vietnamese: details ? details.vietnamese : '',
            definition: details ? details.definition : '',
            example: details ? details.example : '',
            exampleVi: details ? details.exampleVi : ''
        };
    }).filter(w => w.word !== 'n/a'); // remove invalid entries
    
    if (dueReviewWords.length === 0) {
        showToast('Có lỗi xảy ra khi chuẩn bị dữ liệu ôn tập.', 'error');
        closeReviewSession();
        return;
    }
    
    reviewIndex = 0;
    showReviewWord();
}

function showReviewWord() {
    elements.reviewFlashcard.classList.remove('flipped');
    if (elements.reviewFsrsButtonsPanel) elements.reviewFsrsButtonsPanel.classList.add('hidden');
    
    const word = dueReviewWords[reviewIndex];
    
    // Render Front
    elements.reviewCardFrontPos.innerText = word.partOfSpeech;
    elements.reviewCardFrontWord.innerText = word.word;
    
    // Check IPA setting
    elements.reviewCardFrontPronunciation.innerText = word.pronunciation;
    elements.reviewCardFrontPronunciation.style.display = appSettings.showIPA ? 'block' : 'none';
    
    // Render Back
    elements.reviewCardBackPos.innerText = word.partOfSpeech;
    elements.reviewCardBackTranslation.innerText = word.vietnamese;
    elements.reviewCardBackDefinition.innerText = word.definition;
    
    // Check Show Example setting
    if (word.example && appSettings.showExample) {
        elements.reviewCardBackExample.innerText = word.example;
        elements.reviewCardBackExample.style.display = 'block';
    } else {
        elements.reviewCardBackExample.style.display = 'none';
    }
    
    if (word.exampleVi && appSettings.showExample) {
        elements.reviewCardBackExampleVi.innerText = word.exampleVi;
        elements.reviewCardBackExampleVi.style.display = 'block';
    } else {
        elements.reviewCardBackExampleVi.style.display = 'none';
    }
    
    // Progress Overlay
    const total = dueReviewWords.length;
    const currentNum = reviewIndex + 1;
    const percent = Math.round((currentNum / total) * 100);
    
    elements.reviewProgressText.innerText = `${currentNum} / ${total} từ`;
    elements.reviewProgressPercent.innerText = `${percent}%`;
    elements.reviewProgressFill.style.width = `${percent}%`;
    
    if (appSettings.autoSpeak) {
        speakWord(word.word);
    }
}

function handleReviewRating(rating) {
    if (dueReviewWords.length === 0) return;
    
    const word = dueReviewWords[reviewIndex];
    calculateFSRS(word.id, rating);
    
    showToast(`Đã lưu tiến độ: ${getRatingLabel(rating)}`, 'success');
    
    elements.reviewFlashcard.classList.remove('flipped');
    
    setTimeout(() => {
        if (reviewIndex < dueReviewWords.length - 1) {
            reviewIndex++;
            showReviewWord();
        } else {
            showToast('Chúc mừng! Bạn đã hoàn thành tất cả từ vựng cần ôn tập hôm nay.', 'success');
            closeReviewSession();
        }
    }, 200);
}

function closeReviewSession() {
    elements.reviewSessionOverlay.classList.add('hidden');
    isReviewSessionActive = false;
    
    // Disable Fullscreen Focused Study Mode
    const appContainer = document.querySelector('.app-container');
    if (appContainer) appContainer.classList.remove('fullscreen-study-mode');
    
    dueReviewWords = [];
    updateReviewDashboard();
}

// --- Import/Export settings Utilities ---
function exportStudyData() {
    if (Object.keys(studyProgress).length === 0) {
        showToast('Bạn chưa có dữ liệu học tập nào để xuất.', 'info');
        return;
    }
    
    const dataStr = JSON.stringify(studyProgress, null, 4);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `toeic_spark_progress_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Xuất dữ liệu học tập thành công!', 'success');
}

function triggerImport() {
    elements.importFileInput.click();
}

function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // Validate basic structure
            if (typeof importedData !== 'object' || importedData === null) {
                throw new Error('Định dạng tệp không hợp lệ');
            }
            
            // Merge with local storage
            studyProgress = { ...studyProgress, ...importedData };
            saveProgress();
            showToast('Nhập dữ liệu học tập thành công!', 'success');
            
            // Reload views
            renderTopicsList();
            updateReviewDashboard();
        } catch (err) {
            console.error('Lỗi nhập dữ liệu:', err);
            showToast('Tệp JSON không đúng định dạng tiến độ học.', 'error');
        }
    };
    reader.readAsText(file);
    // Reset file input value
    event.target.value = '';
}

function resetAllData() {
    const confirmReset = confirm('CẢNH BÁO: Bạn có chắc chắn muốn đặt lại toàn bộ tiến độ học tập? Lịch sử FSRS và điểm trắc nghiệm sẽ bị XÓA VĨNH VIỄN.');
    if (confirmReset) {
        studyProgress = {};
        saveProgress();
        showToast('Đã xóa toàn bộ lịch sử học tập.', 'info');
        
        // Reload views
        renderTopicsList();
        updateReviewDashboard();
        
        if (currentTopicId) {
            goBackToTopics();
        }
    }
}

// --- Stats Helpers ---
function updateGlobalStats() {
    let learned = 0;
    let mastered = 0;
    
    Object.keys(studyProgress).forEach(id => {
        const prog = studyProgress[id];
        if (prog.statistics.lastSeen) {
            learned++;
            if (prog.statistics.mastered) {
                mastered++;
            }
        }
    });
    
    if (elements.statsTotalLearned) elements.statsTotalLearned.innerText = learned;
    if (elements.statsTotalMastered) elements.statsTotalMastered.innerText = mastered;
}

// --- Toast notification util ---
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i data-lucide="${iconName}"></i>
        </div>
        <span>${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons({
            attrs: {
                class: 'toast-lucide-icon'
            },
            nameAttr: 'data-lucide',
            node: toast
        });
    }
    
    // Auto destroy
    setTimeout(() => {
        toast.style.animation = 'fadeIn 0.3s reverse forwards';
        setTimeout(() => {
            if (elements.toastContainer.contains(toast)) {
                elements.toastContainer.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// --- Event Listeners Mapping ---
function setupEventListeners() {
    // Detail Pages Settings Switcher logic
    const settingsMainView = document.getElementById('settings-main-view');
    const settingsDetailsView = document.getElementById('settings-details-view');
    const detailPanels = document.querySelectorAll('.settings-detail-panel');
    
    // Clicking a category menu item
    document.querySelectorAll('.settings-menu-card').forEach(item => {
        item.addEventListener('click', () => {
            const target = item.getAttribute('data-settings-target');
            if (settingsMainView && settingsDetailsView) {
                settingsMainView.classList.remove('settings-view-active');
                settingsMainView.classList.add('hidden');
                
                settingsDetailsView.classList.remove('hidden');
                
                detailPanels.forEach(panel => {
                    panel.classList.add('hidden');
                });
                
                const targetPanel = document.getElementById(`settings-panel-${target}`);
                if (targetPanel) {
                    targetPanel.classList.remove('hidden');
                }
            }
        });
    });
    
    // Clicking the back button inside a panel
    document.querySelectorAll('.btn-settings-back').forEach(btn => {
        btn.addEventListener('click', () => {
            if (settingsMainView && settingsDetailsView) {
                settingsDetailsView.classList.add('hidden');
                
                settingsMainView.classList.remove('hidden');
                settingsMainView.classList.add('settings-view-active');
                
                detailPanels.forEach(panel => {
                    panel.classList.add('hidden');
                });
            }
        });
    });

    // Navigation Tabs Switcher
    elements.navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Set active navigation button state
            elements.navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Toggle view visibility
            elements.tabContents.forEach(tab => {
                if (tab.id === `tab-${tabId}`) {
                    tab.classList.add('active');
                } else {
                    tab.classList.remove('active');
                }
            });
            
            activeTab = tabId;
            
            // Reload specific stats if going to review
            if (tabId === 'review') {
                updateReviewDashboard();
            } else if (tabId === 'topics') {
                if (!currentTopicId) {
                    renderTopicsList();
                }
            } else if (tabId === 'home') {
                updateGlobalStats();
                updateReviewDashboard();
            } else if (tabId === 'settings') {
                const mainView = document.getElementById('settings-main-view');
                const detailsView = document.getElementById('settings-details-view');
                if (mainView && detailsView) {
                    detailsView.classList.add('hidden');
                    mainView.classList.remove('hidden');
                    mainView.classList.add('settings-view-active');
                }
            }
        });
    });
    
    // Search Topic listener
    if (elements.searchTopics) {
        elements.searchTopics.addEventListener('input', () => {
            renderTopicsList();
        });
    }
    
    // Back button in topic view
    if (elements.btnBackToTopics) {
        elements.btnBackToTopics.addEventListener('click', goBackToTopics);
    }
    
    // Flashcard Flip Interaction
    if (elements.studyFlashcard) {
        elements.studyFlashcard.addEventListener('click', (e) => {
            // Avoid flipping when clicking the audio button
            if (e.target.closest('.audio-btn')) return;
            const isFlipped = elements.studyFlashcard.classList.toggle('flipped');
            if (isFlipped) {
                if (elements.fsrsButtonsPanel) elements.fsrsButtonsPanel.classList.remove('hidden');
            } else {
                if (elements.fsrsButtonsPanel) elements.fsrsButtonsPanel.classList.add('hidden');
            }
        });
    }
    
    // Study Mode switch buttons
    if (elements.btnModeFlashcard) {
        elements.btnModeFlashcard.addEventListener('click', () => {
            elements.btnModeFlashcard.classList.add('active');
            elements.btnModeQuiz.classList.remove('active');
            elements.flashcardModeContainer.classList.remove('hidden');
            elements.quizModeContainer.classList.add('hidden');
            currentMode = 'flashcard';
            showWordFlashcard();
        });
    }
    
    if (elements.btnModeQuiz) {
        elements.btnModeQuiz.addEventListener('click', () => {
            elements.btnModeQuiz.classList.add('active');
            elements.btnModeFlashcard.classList.remove('active');
            elements.quizModeContainer.classList.remove('hidden');
            elements.flashcardModeContainer.classList.add('hidden');
            startQuizMode();
        });
    }
    
    // Audio speaking keys
    if (elements.btnPlayAudio) {
        elements.btnPlayAudio.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentWords.length > 0) {
                speakWord(currentWords[currentWordIndex].word);
            }
        });
    }
    
    if (elements.btnPlayAudioBack) {
        elements.btnPlayAudioBack.addEventListener('click', (e) => {
            e.stopPropagation();
            if (currentWords.length > 0) {
                speakWord(currentWords[currentWordIndex].word);
            }
        });
    }
    
    if (elements.btnPlayQuizAudio) {
        elements.btnPlayQuizAudio.addEventListener('click', () => {
            if (quizWords.length > 0) {
                speakWord(quizWords[quizIndex].word);
            }
        });
    }
    
    // FSRS rating button clicks (Home/Flashcard screen)
    if (elements.fsrsButtonsPanel) {
        const ratingButtons = elements.fsrsButtonsPanel.querySelectorAll('.fsrs-btn');
        ratingButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const rating = parseInt(btn.getAttribute('data-rating'), 10);
                handleFlashcardRating(rating);
            });
        });
    }
    
    // Next quiz button
    if (elements.btnNextQuiz) {
        elements.btnNextQuiz.addEventListener('click', nextQuizQuestion);
    }
    
    // Review Tab Dashboard Events
    if (elements.btnStartReviewSession) {
        elements.btnStartReviewSession.addEventListener('click', startReviewSession);
    }
    
    // Review Overlay Events
    if (elements.btnCloseReviewSession) {
        elements.btnCloseReviewSession.addEventListener('click', closeReviewSession);
    }
    
    if (elements.reviewFlashcard) {
        elements.reviewFlashcard.addEventListener('click', (e) => {
            if (e.target.closest('.audio-btn')) return;
            const isFlipped = elements.reviewFlashcard.classList.toggle('flipped');
            if (isFlipped) {
                if (elements.reviewFsrsButtonsPanel) elements.reviewFsrsButtonsPanel.classList.remove('hidden');
            } else {
                if (elements.reviewFsrsButtonsPanel) elements.reviewFsrsButtonsPanel.classList.add('hidden');
            }
        });
    }
    
    if (elements.btnPlayReviewAudio) {
        elements.btnPlayReviewAudio.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dueReviewWords.length > 0) {
                speakWord(dueReviewWords[reviewIndex].word);
            }
        });
    }
    
    if (elements.btnPlayReviewAudioBack) {
        elements.btnPlayReviewAudioBack.addEventListener('click', (e) => {
            e.stopPropagation();
            if (dueReviewWords.length > 0) {
                speakWord(dueReviewWords[reviewIndex].word);
            }
        });
    }
    
    // Review FSRS button clicks (Review screen overlay)
    if (elements.reviewFsrsButtonsPanel) {
        const reviewRatingButtons = elements.reviewFsrsButtonsPanel.querySelectorAll('.fsrs-btn');
        reviewRatingButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const rating = parseInt(btn.getAttribute('data-review-rating'), 10);
                handleReviewRating(rating);
            });
        });
    }
    
    // Settings Settings Events
    if (elements.btnThemeDark) {
        elements.btnThemeDark.addEventListener('click', () => applyTheme('dark'));
    }
    
    if (elements.btnThemeLight) {
        elements.btnThemeLight.addEventListener('click', () => applyTheme('light'));
    }
    
    if (elements.settingsSpeechRate) {
        elements.settingsSpeechRate.addEventListener('input', () => {
            const val = parseFloat(elements.settingsSpeechRate.value);
            appSettings.speechRate = val;
            elements.speechRateVal.innerText = `${val.toFixed(1)}x`;
        });
    }
    
    // Listeners for new settings
    if (elements.settingsNewWordsDay) {
        elements.settingsNewWordsDay.addEventListener('change', (e) => {
            appSettings.newWordsPerDay = Math.max(5, parseInt(e.target.value, 10) || 10);
            saveSettings();
        });
    }
    if (elements.settingsQuizReps) {
        elements.settingsQuizReps.addEventListener('change', (e) => {
            appSettings.quizRepsPerSession = Math.max(5, parseInt(e.target.value, 10) || 10);
            saveSettings();
        });
    }
    if (elements.settingsAutoSpeak) {
        elements.settingsAutoSpeak.addEventListener('change', (e) => {
            appSettings.autoSpeak = e.target.checked;
            saveSettings();
        });
    }
    if (elements.settingsShowIpa) {
        elements.settingsShowIpa.addEventListener('change', (e) => {
            appSettings.showIPA = e.target.checked;
            saveSettings();
        });
    }
    if (elements.settingsShowExample) {
        elements.settingsShowExample.addEventListener('change', (e) => {
            appSettings.showExample = e.target.checked;
            saveSettings();
        });
    }
    if (elements.settingsAutoFlip) {
        elements.settingsAutoFlip.addEventListener('change', (e) => {
            appSettings.autoFlip = e.target.checked;
            saveSettings();
        });
    }
    if (elements.settingsReviewLimit) {
        elements.settingsReviewLimit.addEventListener('change', (e) => {
            appSettings.reviewLimit = Math.max(10, parseInt(e.target.value, 10) || 100);
            saveSettings();
            updateReviewDashboard();
        });
    }
    if (elements.settingsPrioritizeWeak) {
        elements.settingsPrioritizeWeak.addEventListener('change', (e) => {
            appSettings.prioritizeWeak = e.target.checked;
            saveSettings();
            updateReviewDashboard();
        });
    }
    if (elements.settingsGoalNewWords) {
        elements.settingsGoalNewWords.addEventListener('change', (e) => {
            appSettings.goalNewWords = Math.max(1, parseInt(e.target.value, 10) || 10);
            saveSettings();
        });
    }
    if (elements.settingsGoalReviews) {
        elements.settingsGoalReviews.addEventListener('change', (e) => {
            appSettings.goalReviews = Math.max(1, parseInt(e.target.value, 10) || 50);
            saveSettings();
        });
    }
    if (elements.settingsGoalStreak) {
        elements.settingsGoalStreak.addEventListener('change', (e) => {
            appSettings.goalStreak = Math.max(3, parseInt(e.target.value, 10) || 7);
            saveSettings();
        });
    }
    if (elements.settingsSpeechVoice) {
        elements.settingsSpeechVoice.addEventListener('change', (e) => {
            appSettings.speechVoice = e.target.value;
            saveSettings();
        });
    }
    
    if (elements.btnExportData) {
        elements.btnExportData.addEventListener('click', exportStudyData);
    }
    
    if (elements.btnImportTrigger) {
        elements.btnImportTrigger.addEventListener('click', triggerImport);
    }
    
    if (elements.importFileInput) {
        elements.importFileInput.addEventListener('change', handleImportFile);
    }
    
    if (elements.btnResetData) {
        elements.btnResetData.addEventListener('click', resetAllData);
    }
    
    // Quick Actions on Home Tab
    if (elements.btnHomeLearn) {
        elements.btnHomeLearn.addEventListener('click', () => {
            goToTab('topics');
        });
    }
    
    if (elements.btnHomeReview) {
        elements.btnHomeReview.addEventListener('click', () => {
            goToTab('review');
            if (dueReviewWords.length > 0) {
                startReviewSession();
            }
        });
    }

    // Notebook actions
    if (elements.btnToggleNotebook) {
        elements.btnToggleNotebook.addEventListener('click', openNotebookView);
    }
    
    if (elements.btnNotebookBack) {
        elements.btnNotebookBack.addEventListener('click', closeNotebookView);
    }
    
    if (elements.btnNotebookTopicDetailBack) {
        elements.btnNotebookTopicDetailBack.addEventListener('click', goBackToNotebookTopicList);
    }
    
    // Sub-tab selectors inside notebook
    document.querySelectorAll('.notebook-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetTab = e.currentTarget.getAttribute('data-notebook-tab');
            activeNotebookTab = targetTab;
            
            document.querySelectorAll('.notebook-tab-btn').forEach(b => {
                b.classList.toggle('active', b === e.currentTarget);
            });
            
            if (targetTab === 'by-topic') {
                document.getElementById('notebook-content-by-topic').classList.remove('hidden');
                document.getElementById('notebook-content-by-schedule').classList.add('hidden');
                goBackToNotebookTopicList();
                renderNotebookByTopic();
            } else {
                document.getElementById('notebook-content-by-topic').classList.add('hidden');
                document.getElementById('notebook-content-by-schedule').classList.remove('hidden');
                renderNotebookBySchedule();
            }
        });
    });
    
    if (elements.notebookTopicSearchList) {
        elements.notebookTopicSearchList.addEventListener('input', renderNotebookByTopic);
    }
    
    if (elements.notebookWordSearch) {
        elements.notebookWordSearch.addEventListener('input', renderActiveTopicWords);
    }
    
    if (elements.notebookWordStatusFilter) {
        elements.notebookWordStatusFilter.addEventListener('change', renderActiveTopicWords);
    }
    
    if (elements.notebookSchedSearch) {
        elements.notebookSchedSearch.addEventListener('input', renderNotebookBySchedule);
    }
    
    if (elements.notebookSchedTimeFilter) {
        elements.notebookSchedTimeFilter.addEventListener('change', renderNotebookBySchedule);
    }
}

function goToTab(tabId) {
    const navBtn = Array.from(elements.navButtons).find(btn => btn.getAttribute('data-tab') === tabId);
    if (navBtn) {
        navBtn.click();
    }
}

// --- Notebook Vocabulary View Fullscreen Engine ---
let activeNotebookTab = 'by-topic';
let activeNotebookTopicId = null;
const topicWordsCache = {};

function openNotebookView() {
    // Enable full screen study mode to hide sidebar and footer nav
    document.querySelector('.app-container').classList.add('fullscreen-study-mode');
    
    // Hide all normal tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show notebook view
    elements.notebookView.classList.remove('hidden');
    
    // Render first tab
    activeNotebookTab = 'by-topic';
    document.querySelectorAll('.notebook-tab-btn').forEach(btn => {
        if (btn.getAttribute('data-notebook-tab') === 'by-topic') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    document.getElementById('notebook-content-by-topic').classList.remove('hidden');
    document.getElementById('notebook-content-by-schedule').classList.add('hidden');
    
    // Reset filters
    if (elements.notebookTopicSearchList) elements.notebookTopicSearchList.value = '';
    if (elements.notebookWordSearch) elements.notebookWordSearch.value = '';
    if (elements.notebookWordStatusFilter) elements.notebookWordStatusFilter.value = 'all';
    if (elements.notebookSchedSearch) elements.notebookSchedSearch.value = '';
    if (elements.notebookSchedTimeFilter) elements.notebookSchedTimeFilter.value = 'all';
    
    goBackToNotebookTopicList();
}

function closeNotebookView() {
    // Remove fullscreen study mode
    document.querySelector('.app-container').classList.remove('fullscreen-study-mode');
    
    // Hide notebook view
    elements.notebookView.classList.add('hidden');
    
    // Re-active Review Tab
    const reviewTab = document.getElementById('tab-review');
    if (reviewTab) {
        reviewTab.classList.add('active');
    }
    
    updateReviewDashboard();
}

async function renderNotebookByTopic() {
    if (!elements.notebookTopicsGrid) return;
    
    const searchQuery = elements.notebookTopicSearchList ? elements.notebookTopicSearchList.value.toLowerCase().trim() : '';
    elements.notebookTopicsGrid.innerHTML = '';
    
    const filteredTopics = topics.filter(t => {
        if (searchQuery) {
            const name = t.name.toLowerCase();
            const desc = (t.desc || '').toLowerCase();
            return name.includes(searchQuery) || desc.includes(searchQuery);
        }
        return true;
    });
    
    if (filteredTopics.length === 0) {
        elements.notebookTopicsGrid.innerHTML = `
            <div class="notebook-empty-state" style="grid-column: 1 / -1; padding: 40px; text-align: center;">
                <i data-lucide="frown"></i>
                <p>Không tìm thấy chủ đề phù hợp bộ lọc.</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    filteredTopics.forEach(topic => {
        const studiedWordsInTopic = Object.keys(studyProgress).filter(id => {
            const p = studyProgress[id];
            return p.topicId === topic.id && p.statistics.lastSeen;
        });
        
        const studiedCount = studiedWordsInTopic.length;
        
        const card = document.createElement('div');
        card.className = 'notebook-topic-card';
        card.setAttribute('data-topic-id', topic.id);
        card.innerHTML = `
            <div class="notebook-topic-card-header">
                <span class="notebook-topic-card-icon">${topic.icon || '📚'}</span>
                <h4 class="notebook-topic-card-title">${topic.name}</h4>
            </div>
            <p class="notebook-topic-card-desc">${topic.desc || ''}</p>
            <div class="notebook-topic-card-progress">
                <span>Đã học: <strong>${studiedCount}/${topic.totalWords || '?'}</strong></span>
                <span>${Math.round((studiedCount / (topic.totalWords || 1)) * 100)}%</span>
            </div>
        `;
        
        card.addEventListener('click', () => {
            openNotebookTopicDetails(topic.id);
        });
        
        elements.notebookTopicsGrid.appendChild(card);
    });
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function openNotebookTopicDetails(topicId) {
    activeNotebookTopicId = topicId;
    
    // Switch screens
    if (elements.notebookTopicListScreen) elements.notebookTopicListScreen.classList.add('hidden');
    if (elements.notebookTopicDetailScreen) elements.notebookTopicDetailScreen.classList.remove('hidden');
    
    // Set headers
    const topic = topics.find(t => t.id === topicId) || { name: 'Unknown Topic', icon: '📚', desc: '' };
    if (elements.notebookActiveTopicIcon) elements.notebookActiveTopicIcon.innerText = topic.icon || '📚';
    if (elements.notebookActiveTopicName) elements.notebookActiveTopicName.innerText = topic.name;
    if (elements.notebookActiveTopicDesc) elements.notebookActiveTopicDesc.innerText = topic.desc || '';
    
    // Reset filters inside screen
    if (elements.notebookWordSearch) elements.notebookWordSearch.value = '';
    if (elements.notebookWordStatusFilter) elements.notebookWordStatusFilter.value = 'all';
    
    renderActiveTopicWords();
}

function goBackToNotebookTopicList() {
    activeNotebookTopicId = null;
    
    // Switch screens
    if (elements.notebookTopicListScreen) elements.notebookTopicListScreen.classList.remove('hidden');
    if (elements.notebookTopicDetailScreen) elements.notebookTopicDetailScreen.classList.add('hidden');
    
    renderNotebookByTopic();
}

async function renderActiveTopicWords() {
    if (!elements.notebookTopicWordsList || !activeNotebookTopicId) return;
    
    elements.notebookTopicWordsList.innerHTML = `
        <div class="notebook-empty-state" style="padding: 40px; text-align: center;">
            <div class="spinner" style="margin: 0 auto;"></div>
            <p style="margin-top: 8px;">Đang nạp từ vựng...</p>
        </div>
    `;
    
    const wordStatus = elements.notebookWordStatusFilter ? elements.notebookWordStatusFilter.value : 'all';
    const searchQuery = elements.notebookWordSearch ? elements.notebookWordSearch.value.toLowerCase().trim() : '';
    
    let words = topicWordsCache[activeNotebookTopicId];
    if (!words) {
        try {
            const res = await fetch(`./data/vocabulary/${activeNotebookTopicId}.json`);
            if (res.ok) {
                words = await res.json();
                topicWordsCache[activeNotebookTopicId] = words;
            } else if (fallbackWords[activeNotebookTopicId]) {
                words = fallbackWords[activeNotebookTopicId];
                topicWordsCache[activeNotebookTopicId] = words;
            }
        } catch (e) {
            if (fallbackWords[activeNotebookTopicId]) {
                words = fallbackWords[activeNotebookTopicId];
                topicWordsCache[activeNotebookTopicId] = words;
            }
        }
    }
    
    if (!words) {
        elements.notebookTopicWordsList.innerHTML = '<p style="padding: 10px; color: var(--text-secondary); text-align: center;">Không thể nạp từ vựng.</p>';
        return;
    }
    
    const filteredWords = words.filter(w => {
        const hasStudied = studyProgress[w.id] && studyProgress[w.id].statistics.lastSeen;
        
        if (wordStatus === 'learned' && !hasStudied) return false;
        if (wordStatus === 'unlearned' && hasStudied) return false;
        
        if (searchQuery) {
            const wordText = w.word.toLowerCase();
            const meaningText = w.vietnamese.toLowerCase();
            if (!wordText.includes(searchQuery) && !meaningText.includes(searchQuery)) return false;
        }
        
        return true;
    });
    
    if (filteredWords.length === 0) {
        elements.notebookTopicWordsList.innerHTML = '<p style="padding: 16px; text-align: center; color: var(--text-secondary);">Không có từ vựng nào khớp bộ lọc.</p>';
        return;
    }
    
    elements.notebookTopicWordsList.innerHTML = '';
    
    filteredWords.forEach(w => {
        const hasStudied = studyProgress[w.id] && studyProgress[w.id].statistics.lastSeen;
        const p = studyProgress[w.id];
        
        const wordCard = document.createElement('div');
        wordCard.className = `notebook-word-card ${hasStudied ? 'studied-card' : 'unstudied-card'}`;
        
        const statusLabel = hasStudied ? 'Đã học' : 'Chưa học';
        const statusClass = hasStudied ? 'status-learned' : 'status-unlearned';
        
        wordCard.innerHTML = `
            <div class="notebook-word-header">
                <div class="notebook-word-primary">
                    <span class="notebook-word-text">${w.word}</span>
                    <span class="notebook-word-pos">${w.partOfSpeech || 'n/a'}</span>
                    <span class="notebook-word-meaning">${w.vietnamese}</span>
                </div>
                <div class="notebook-word-actions">
                    <span class="word-status-label ${statusClass}">${statusLabel}</span>
                    <button class="audio-btn btn-speak-word" title="Phát âm" style="margin-left: 8px;">
                        <i data-lucide="volume-2"></i>
                    </button>
                    <i class="notebook-word-chevron" data-lucide="chevron-right" style="margin-left: 8px; transition: transform var(--transition-fast);"></i>
                </div>
            </div>
            <div class="notebook-word-details" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color); animation: fadeIn 0.2s;">
                <div class="notebook-word-details-item" style="margin-bottom: 8px;">
                    <strong>Phiên âm:</strong>
                    <p><em>${w.pronunciation || ''}</em></p>
                </div>
                <div class="notebook-word-details-item" style="margin-bottom: 8px;">
                    <strong>Định nghĩa:</strong>
                    <p>${w.definition || 'Không có định nghĩa.'}</p>
                </div>
                ${w.example ? `
                <div class="notebook-word-details-item" style="margin-bottom: 8px;">
                    <strong>Ví dụ:</strong>
                    <p class="eng-ex">${w.example}</p>
                    ${w.exampleVi ? `<p class="vi-ex">${w.exampleVi}</p>` : ''}
                </div>
                ` : ''}
                
                ${hasStudied ? `
                <div class="notebook-word-meta" style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-secondary); background-color: var(--bg-card); padding: 6px 10px; border-radius: var(--radius-sm); margin-top: 8px;">
                    <span>FSRS Stability: <strong>${Math.round(p.fsrs.stability)} ngày</strong></span>
                    <span>FSRS Difficulty: <strong>${Math.round(p.fsrs.difficulty * 10) / 10}</strong></span>
                    <span>Lịch ôn tập: <strong>${new Date(p.fsrs.due).toLocaleDateString('vi-VN')}</strong></span>
                </div>
                ` : ''}
            </div>
        `;
        
        wordCard.querySelector('.btn-speak-word').addEventListener('click', (e) => {
            e.stopPropagation();
            speakWord(w.word);
        });
        
        wordCard.addEventListener('click', (e) => {
            if (e.target.closest('.audio-btn')) return;
            const cardExpanded = wordCard.classList.toggle('expanded');
            wordCard.querySelector('.notebook-word-details').style.display = cardExpanded ? 'block' : 'none';
            const chevron = wordCard.querySelector('.notebook-word-chevron');
            if (chevron) chevron.style.transform = cardExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
        });
        
        elements.notebookTopicWordsList.appendChild(wordCard);
    });
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function renderNotebookBySchedule() {
    if (!elements.notebookSchedTimeline) return;
    
    const timeFilter = elements.notebookSchedTimeFilter ? elements.notebookSchedTimeFilter.value : 'all';
    const searchQuery = elements.notebookSchedSearch ? elements.notebookSchedSearch.value.toLowerCase().trim() : '';
    
    elements.notebookSchedTimeline.innerHTML = `
        <div class="notebook-empty-state" style="padding: 40px; text-align: center;">
            <div class="spinner" style="margin: 0 auto;"></div>
            <p style="margin-top: 8px;">Đang lập lịch trình ôn luyện...</p>
        </div>
    `;
    
    const progressWords = Object.keys(studyProgress).map(id => {
        return { id, prog: studyProgress[id] };
    }).filter(item => item.prog.statistics.lastSeen);
    
    if (progressWords.length === 0) {
        elements.notebookSchedTimeline.innerHTML = `
            <div class="notebook-empty-state" style="padding: 40px; text-align: center;">
                <i data-lucide="frown"></i>
                <p>Bạn chưa học từ vựng nào để xếp lịch ôn tập.</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    const uniqueTopicIds = [...new Set(progressWords.map(item => item.prog.topicId).filter(Boolean))];
    const wordsCache = {};
    
    await Promise.all(uniqueTopicIds.map(async (tId) => {
        try {
            const res = await fetch(`./data/vocabulary/${tId}.json`);
            if (res.ok) {
                const words = await res.json();
                words.forEach(w => {
                    wordsCache[w.id] = w;
                });
            } else if (fallbackWords[tId]) {
                fallbackWords[tId].forEach(w => {
                    wordsCache[w.id] = w;
                });
            }
        } catch (e) {
            if (fallbackWords[tId]) {
                fallbackWords[tId].forEach(w => {
                    wordsCache[w.id] = w;
                });
            }
        }
    }));
    
    const detailedWords = progressWords.map(item => {
        return {
            id: item.id,
            prog: item.prog,
            detail: wordsCache[item.id]
        };
    }).filter(item => item.detail !== undefined);
    
    const filteredDetailedWords = detailedWords.filter(item => {
        if (searchQuery) {
            const wordText = item.detail.word.toLowerCase();
            const meaningText = item.detail.vietnamese.toLowerCase();
            return wordText.includes(searchQuery) || meaningText.includes(searchQuery);
        }
        return true;
    });
    
    if (filteredDetailedWords.length === 0) {
        elements.notebookSchedTimeline.innerHTML = `
            <div class="notebook-empty-state" style="padding: 40px; text-align: center;">
                <i data-lucide="search"></i>
                <p>Không tìm thấy từ vựng ôn tập phù hợp với tìm kiếm.</p>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }
    
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const tomorrowEnd = new Date(todayEnd.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(todayEnd.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const buckets = {
        due: { title: 'Cần ôn ngay / Quá hạn', class: 'title-due', icon: 'alert-circle', words: [] },
        tomorrow: { title: 'Ngày mai', class: 'title-tomorrow', icon: 'clock', words: [] },
        week: { title: 'Trong 7 ngày tới', class: 'title-week', icon: 'calendar', words: [] },
        later: { title: 'Dài hạn (Trên 7 ngày)', class: 'title-later', icon: 'check-circle', words: [] }
    };
    
    filteredDetailedWords.forEach(item => {
        const dueTime = new Date(item.prog.fsrs.due).getTime();
        if (dueTime <= todayEnd.getTime()) {
            buckets.due.words.push(item);
        } else if (dueTime <= tomorrowEnd.getTime()) {
            buckets.tomorrow.words.push(item);
        } else if (dueTime <= weekEnd.getTime()) {
            buckets.week.words.push(item);
        } else {
            buckets.later.words.push(item);
        }
    });
    
    Object.keys(buckets).forEach(key => {
        buckets[key].words.sort((a, b) => new Date(a.prog.fsrs.due) - new Date(b.prog.fsrs.due));
    });
    
    elements.notebookSchedTimeline.innerHTML = '';
    
    const keysToDisplay = Object.keys(buckets).filter(key => {
        if (timeFilter !== 'all' && key !== timeFilter) return false;
        return true;
    });
    
    let hasAnyWord = false;
    keysToDisplay.forEach(key => {
        const b = buckets[key];
        if (b.words.length === 0 && timeFilter !== 'all') {
            elements.notebookSchedTimeline.innerHTML = `
                <div class="notebook-empty-state" style="padding: 40px; text-align: center;">
                    <i data-lucide="check-circle-2"></i>
                    <p>Không có từ vựng nào nằm trong mốc thời gian này.</p>
                </div>
            `;
            return;
        }
        
        if (b.words.length === 0) return;
        hasAnyWord = true;
        
        const groupCard = document.createElement('div');
        groupCard.className = 'sched-group-card';
        groupCard.innerHTML = `
            <div class="sched-group-header">
                <div class="sched-group-title ${b.class}">
                    <i data-lucide="${b.icon}"></i>
                    <span>${b.title}</span>
                </div>
                <span class="sched-group-badge">${b.words.length} từ</span>
            </div>
            <div class="sched-words-grid" style="display: flex; flex-direction: column; gap: 10px;">
            </div>
        `;
        
        const grid = groupCard.querySelector('.sched-words-grid');
        
        b.words.forEach(item => {
            const w = item.detail;
            const p = item.prog;
            const topicObj = topics.find(t => t.id === p.topicId) || { name: 'Chủ đề khác', icon: '📚' };
            
            const wordCard = document.createElement('div');
            wordCard.className = 'notebook-word-card studied-card';
            
            wordCard.innerHTML = `
                <div class="notebook-word-header">
                    <div class="notebook-word-primary">
                        <span class="notebook-word-text">${w.word}</span>
                        <span class="notebook-word-pos">${w.partOfSpeech || 'n/a'}</span>
                        <span class="notebook-word-meaning">${w.vietnamese}</span>
                    </div>
                    <div class="notebook-word-actions">
                        <span style="font-size: 11px; color: var(--text-secondary); background-color: var(--bg-card); padding: 2px 6px; border-radius: var(--radius-sm); font-weight: 600;">
                            ${topicObj.icon || '📚'} ${topicObj.name}
                        </span>
                        <button class="audio-btn btn-speak-word" title="Phát âm" style="margin-left: 8px;">
                            <i data-lucide="volume-2"></i>
                        </button>
                        <i class="notebook-word-chevron" data-lucide="chevron-right" style="margin-left: 8px; transition: transform var(--transition-fast);"></i>
                    </div>
                </div>
                <div class="notebook-word-details" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border-color); animation: fadeIn 0.2s;">
                    <div class="notebook-word-details-item" style="margin-bottom: 8px;">
                        <strong>Phiên âm:</strong>
                        <p><em>${w.pronunciation || ''}</em></p>
                    </div>
                    <div class="notebook-word-details-item" style="margin-bottom: 8px;">
                        <strong>Định nghĩa:</strong>
                        <p>${w.definition || 'Không có định nghĩa.'}</p>
                    </div>
                    ${w.example ? `
                    <div class="notebook-word-details-item" style="margin-bottom: 8px;">
                        <strong>Ví dụ:</strong>
                        <p class="eng-ex">${w.example}</p>
                        ${w.exampleVi ? `<p class="vi-ex">${w.exampleVi}</p>` : ''}
                    </div>
                    ` : ''}
                    <div class="notebook-word-meta" style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-secondary); background-color: var(--bg-card); padding: 6px 10px; border-radius: var(--radius-sm); margin-top: 8px;">
                        <span>Độ ổn định FSRS: <strong>${Math.round(p.fsrs.stability)} ngày</strong></span>
                        <span>Độ khó FSRS: <strong>${Math.round(p.fsrs.difficulty * 10) / 10}</strong></span>
                        <span>Lịch ôn tiếp theo: <strong>${new Date(p.fsrs.due).toLocaleDateString('vi-VN')}</strong></span>
                    </div>
                </div>
            `;
            
            wordCard.querySelector('.btn-speak-word').addEventListener('click', (e) => {
                e.stopPropagation();
                speakWord(w.word);
            });
            
            wordCard.addEventListener('click', (e) => {
                if (e.target.closest('.audio-btn')) return;
                const cardExpanded = wordCard.classList.toggle('expanded');
                wordCard.querySelector('.notebook-word-details').style.display = cardExpanded ? 'block' : 'none';
                const chevron = wordCard.querySelector('.notebook-word-chevron');
                if (chevron) chevron.style.transform = cardExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
            });
            
            grid.appendChild(wordCard);
        });
        
        elements.notebookSchedTimeline.appendChild(groupCard);
    });
    
    if (!hasAnyWord && timeFilter === 'all') {
        elements.notebookSchedTimeline.innerHTML = `
            <div class="notebook-empty-state" style="padding: 40px; text-align: center;">
                <i data-lucide="info"></i>
                <p>Không tìm thấy từ vựng đã học nào.</p>
            </div>
        `;
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
