// アプリケーションの状態管理
let config = null;
let currentMode = null;
let currentServices = [];
let currentQuestionIndex = 0;
let correctAnswers = 0;
let totalQuestions = 0;
let isFocusMode = false;
let focusM = 2;
let focusN = 5;
let statistics = {
    total_sessions: 0,
    services: {}
};

// DOM要素
const modeSelection = document.getElementById('mode-selection');
const quizScreen = document.getElementById('quiz-screen');
const resultScreen = document.getElementById('result-screen');
const statsScreen = document.getElementById('stats-screen');

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    loadConfig();
    setupEventListeners();
    loadStatistics();
});

// 設定ファイルを読み込む
async function loadConfig() {
    try {
        const response = await fetch('aws_quiz_config.json');
        config = await response.json();
    } catch (error) {
        console.error('設定ファイルの読み込みに失敗しました:', error);
        alert('設定ファイルの読み込みに失敗しました。');
    }
}

// イベントリスナーの設定
function setupEventListeners() {
    // モード選択
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentMode = this.dataset.mode;
        });
    });

    // 集中学習モードのトグル
    document.getElementById('focus-mode').addEventListener('change', function() {
        const focusOptions = document.getElementById('focus-options');
        isFocusMode = this.checked;
        focusOptions.style.display = isFocusMode ? 'block' : 'none';

        // 値の更新
        document.getElementById('focus-m').addEventListener('change', function() {
            focusM = parseInt(this.value) || 2;
        });
        document.getElementById('focus-n').addEventListener('change', function() {
            focusN = parseInt(this.value) || 5;
        });
    });

    // クイズ開始
    document.getElementById('start-quiz').addEventListener('click', startQuiz);

    // 統計表示
    document.getElementById('show-stats').addEventListener('click', showStats);

    // 回答送信
    document.getElementById('submit-answer').addEventListener('click', submitAnswer);
    document.getElementById('answer-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            submitAnswer();
        }
    });

    // クイズ終了
    document.getElementById('quit-quiz').addEventListener('click', endQuiz);

    // もう一度挑戦
    document.getElementById('restart-quiz').addEventListener('click', restartQuiz);

    // モード選択に戻る
    document.getElementById('back-to-mode').addEventListener('click', backToMode);

    // 統計から戻る
    document.getElementById('back-from-stats').addEventListener('click', backToMode);

    // 統計リセット
    document.getElementById('clear-stats').addEventListener('click', clearStats);
}

// 統計データをLocal Storageから読み込む
function loadStatistics() {
    const stored = localStorage.getItem('aws_quiz_statistics');
    if (stored) {
        try {
            statistics = JSON.parse(stored);
        } catch (error) {
            console.error('統計データの読み込みに失敗しました:', error);
            statistics = { total_sessions: 0, services: {} };
        }
    }
}

// 統計データをLocal Storageに保存
function saveStatistics() {
    try {
        localStorage.setItem('aws_quiz_statistics', JSON.stringify(statistics));
    } catch (error) {
        console.error('統計データの保存に失敗しました:', error);
    }
}

// 結果データをLocal Storageに保存
function saveResult(total, correct, percentage) {
    const result = {
        timestamp: new Date().toISOString(),
        total_questions: total,
        correct_answers: correct,
        percentage: percentage
    };

    const results = JSON.parse(localStorage.getItem('aws_quiz_results') || '[]');
    results.push(result);
    localStorage.setItem('aws_quiz_results', JSON.stringify(results));
}

// 画面を切り替える
function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// クイズ開始
function startQuiz() {
    if (!currentMode || !config) {
        alert('モードを選択してください。');
        return;
    }

    const modeConfig = config.modes[currentMode];

    // サービスリストを取得
    const services = modeConfig.services;
    let serviceKeys = Object.keys(services);

    // 集中学習モードの場合、サービスをフィルタリング
    if (isFocusMode) {
        const focusServices = getFocusServices(focusM, focusN);
        if (focusServices.length === 0) {
            alert(`集中学習の対象となるサービスが見つかりませんでした。（過去${focusN}回中${focusM}回以下の正解数）\n通常モードで全問題を出題します。`);
            serviceKeys = Object.keys(services);
        } else {
            serviceKeys = focusServices;
        }
    }

    // サービスをシャッフル
    currentServices = shuffleArray(serviceKeys);

    // クイズ状態をリセット
    currentQuestionIndex = 0;
    correctAnswers = 0;
    totalQuestions = currentServices.length;

    // タイトル設定
    const title = isFocusMode ? modeConfig.title_focus.replace('{focus_m}', focusM).replace('{focus_n}', focusN) : modeConfig.title;
    document.getElementById('quiz-title').textContent = title;

    // プログレス更新
    updateProgress();

    // 最初の問題を表示
    showQuestion();

    // 画面切り替え
    switchScreen('quiz-screen');
}

// 集中学習対象のサービスを取得
function getFocusServices(m, n) {
    const focusServices = [];

    for (const service in statistics.services) {
        const data = statistics.services[service];
        if (data.history) {
            // 最近N回の結果を取得（または全履歴）
            const recentHistory = data.history.length >= n ? data.history.slice(-n) : data.history;

            if (recentHistory.length > 0) {
                // 最近N回の正解数をカウント
                const recentCorrect = recentHistory.filter(result => result).length;
                if (recentCorrect <= m) {
                    focusServices.push(service);
                }
            }
        }
    }

    return focusServices;
}

// 配列をシャッフル
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// プログレス更新
function updateProgress() {
    document.getElementById('current-question').textContent = currentQuestionIndex + 1;
    document.getElementById('total-questions').textContent = totalQuestions;
}

// 問題を表示
function showQuestion() {
    const service = currentServices[currentQuestionIndex];
    const modeConfig = config.modes[currentMode];
    const description = modeConfig.services[service];

    document.getElementById('question-text').textContent = description;
    document.getElementById('answer-input').value = '';
    document.getElementById('answer-input').focus();
    document.getElementById('feedback').textContent = '';
    document.getElementById('feedback').className = 'feedback';
}

// 回答を送信
function submitAnswer() {
    const userAnswer = document.getElementById('answer-input').value.trim().toLowerCase();
    const correctAnswer = currentServices[currentQuestionIndex];
    const feedback = document.getElementById('feedback');

    if (userAnswer === '') {
        feedback.textContent = '回答を入力してください。';
        feedback.className = 'feedback incorrect';
        return;
    }

    if (userAnswer === correctAnswer) {
        feedback.textContent = `正解です！素晴らしい！（正解: ${correctAnswer.toUpperCase()}）`;
        feedback.className = 'feedback correct';
        correctAnswers++;

        // 統計更新（正解）
        updateStatistics(correctAnswer, true);
    } else {
        feedback.textContent = `不正解です。正解は '${correctAnswer.toUpperCase()}' でした。`;
        feedback.className = 'feedback incorrect';

        // 統計更新（不正解）
        updateStatistics(correctAnswer, false);
    }

    // 次の問題へ
    setTimeout(() => {
        currentQuestionIndex++;
        updateProgress();

        if (currentQuestionIndex < totalQuestions) {
            showQuestion();
        } else {
            endQuiz();
        }
    }, 2000);
}

// 統計を更新
function updateStatistics(service, isCorrect) {
    if (!statistics.services[service]) {
        statistics.services[service] = {
            correct: 0,
            incorrect: 0,
            history: []
        };
    }

    if (isCorrect) {
        statistics.services[service].correct++;
    } else {
        statistics.services[service].incorrect++;
    }

    statistics.services[service].history.push(isCorrect);

    // 履歴を最新100件に制限
    if (statistics.services[service].history.length > 100) {
        statistics.services[service].history = statistics.services[service].history.slice(-100);
    }

    saveStatistics();
}

// クイズ終了
function endQuiz() {
    if (totalQuestions > 0) {
        const percentage = Math.round((correctAnswers / totalQuestions) * 100);

        document.getElementById('result-total').textContent = totalQuestions;
        document.getElementById('result-correct').textContent = correctAnswers;
        document.getElementById('result-percentage').textContent = `${percentage}%`;

        // 結果を保存
        saveResult(totalQuestions, correctAnswers, percentage);

        // 通常モード時は総セッション数を更新
        if (!isFocusMode) {
            statistics.total_sessions++;
            saveStatistics();
        }
    }

    switchScreen('result-screen');
}

// もう一度挑戦
function restartQuiz() {
    startQuiz();
}

// モード選択に戻る
function backToMode() {
    // 入力値をリセット
    document.getElementById('focus-mode').checked = false;
    document.getElementById('focus-options').style.display = 'none';
    document.querySelectorAll('.mode-btn').forEach(btn => btn.classList.remove('active'));
    currentMode = null;

    switchScreen('mode-selection');
}

// 統計を表示
function showStats() {
    const statsContent = document.getElementById('stats-content');
    statsContent.innerHTML = '';

    // 総セッション数
    const totalSessions = document.createElement('div');
    totalSessions.innerHTML = `<h3>総学習セッション数: ${statistics.total_sessions}</h3>`;
    statsContent.appendChild(totalSessions);

    // サービス別統計
    if (Object.keys(statistics.services).length > 0) {
        const servicesTitle = document.createElement('h3');
        servicesTitle.textContent = 'サービス別成績';
        statsContent.appendChild(servicesTitle);

        const servicesList = document.createElement('div');
        servicesList.className = 'services-stats';

        const sortedServices = Object.entries(statistics.services)
            .sort(([,a], [,b]) => {
                const rateA = a.history.length > 0 ? (a.history.filter(h => h).length / a.history.length) : 0;
                const rateB = b.history.length > 0 ? (b.history.filter(h => h).length / b.history.length) : 0;
                return rateA - rateB; // 低い正答率順
            });

        sortedServices.forEach(([service, data]) => {
            const total = data.history.length;
            const correct = data.history.filter(h => h).length;
            const rate = total > 0 ? Math.round((correct / total) * 100) : 0;

            const serviceDiv = document.createElement('div');
            serviceDiv.className = 'service-stat';
            serviceDiv.innerHTML = `
                <div class="service-name">${service.toUpperCase()}</div>
                <div class="service-stats">
                    <span>正解: ${correct}/${total}</span>
                    <span>正答率: ${rate}%</span>
                </div>
            `;
            servicesList.appendChild(serviceDiv);
        });

        statsContent.appendChild(servicesList);
    } else {
        statsContent.innerHTML += '<p>まだ統計データがありません。</p>';
    }

    switchScreen('stats-screen');
}

// 統計をクリア
function clearStats() {
    if (confirm('統計データをすべて削除します。よろしいですか？')) {
        statistics = { total_sessions: 0, services: {} };
        localStorage.removeItem('aws_quiz_statistics');
        localStorage.removeItem('aws_quiz_results');
        showStats(); // 統計画面を更新
    }
}