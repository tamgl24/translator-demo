// =========================================================
// PHẦN 1: TỪ ĐIỂN GIAO DIỆN (UI DICTIONARY)
// =========================================================
const uiTranslations = {
    "vi-VN": { labelSource: "Bạn đã nói: ", labelTarget: "Văn bản đã dịch: ", statusReady: "Sẵn sàng. Hãy bấm nút micro để nói...", statusListening: "(Đang lắng nghe âm thanh)...", statusTranslating: "(Đang dịch...)" },
    "en-US": { labelSource: "You said: ", labelTarget: "Translated text: ", statusReady: "Ready. Click mic to speak...", statusListening: "(Listening to your voice)...", statusTranslating: "(Translating...)" },
    "zh-CN": { labelSource: "你说了： ", labelTarget: "翻译文本： ", statusReady: "准备就绪。点击麦克风...", statusListening: "(正在听)...", statusTranslating: "(翻译中...)" },
    "ja-JP": { labelSource: "あなたの発言： ", labelTarget: "翻訳テキスト： ", statusReady: "準備完了。マイクをクリック...", statusListening: "(聞いています)...", statusTranslating: "(翻訳中...)" },
    "fr-FR": { labelSource: "Vous avez dit : ", labelTarget: "Texte traduit : ", statusReady: "Prêt. Cliquez sur le micro...", statusListening: "(En train d'écouter)...", statusTranslating: "(Traduction en cours...)" },
    "es-ES": { labelSource: "Tú dijiste: ", labelTarget: "Texto traducido: ", statusReady: "Listo. Haz clic en el micro...", statusListening: "(Escuchando)...", statusTranslating: "(Traduciendo...)" }
};

// Cập nhật giao diện khi người dùng đổi ngôn ngữ
document.getElementById('source-lang').addEventListener('change', function () {
    const ui = uiTranslations[this.value];
    if (ui) {
        document.getElementById('label-source').innerText = ui.labelSource;
        document.getElementById('label-target').innerText = ui.labelTarget;
        document.getElementById('status-text').innerText = ui.statusReady;
    }
});


// =========================================================
// PHẦN 2: NHẬN DIỆN GIỌNG NÓI (WEB SPEECH API)
// =========================================================

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (!SpeechRecognition) {
    alert("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Vui lòng sử dụng Google Chrome trên máy tính.");
} else {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
}

// Các biến trạng thái
let isListening = false;
let currentBubble = null;       // Bong bóng chứa văn bản gốc
let silenceTimer;               // Đồng hồ cát
const SILENCE_DELAY = 2000;     // 2 giây im lặng sẽ tự động ngắt câu

const startBtn = document.getElementById('start-btn');
const statusText = document.getElementById('status-text');

// Xử lý nút Micro
startBtn.onclick = function () {
    if (!recognition) return;
    if (isListening) {
        recognition.stop();
    } else {
        recognition.lang = document.getElementById('source-lang').value;
        recognition.start();
    }
};

// Khi bắt đầu nghe
recognition.onstart = function () {
    isListening = true;
    startBtn.style.backgroundColor = "#ff3b30";
    startBtn.style.boxShadow = "0 0 15px rgba(255, 59, 48, 0.6)";

    const lang = document.getElementById('source-lang').value;
    statusText.innerText = uiTranslations[lang].statusListening;
};

// Khi đang nghe và nhận diện ra chữ
recognition.onresult = function (event) {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
        } else {
            interimTranscript += event.results[i][0].transcript;
        }
    }

    const box = document.getElementById('original-box');

    if (!currentBubble) {
        currentBubble = document.createElement('div');
        currentBubble.className = 'bubble original';
        box.appendChild(currentBubble);
    }

    // Cập nhật chữ real-time vào bong bóng gốc
    currentBubble.innerText = finalTranscript + interimTranscript;
    box.scrollTop = box.scrollHeight;

    // --- CƠ CHẾ ĐỒNG HỒ CÁT ---
    clearTimeout(silenceTimer);

    silenceTimer = setTimeout(function () {
        console.log("Xác nhận ngừng nói. Bắt đầu dịch...");

        recognition.stop();

        const textToTranslate = currentBubble.innerText.trim();

        if (textToTranslate !== "") {
            // Gọi bộ não dịch thuật
            translateText(textToTranslate);
        }

        currentBubble = null;

    }, SILENCE_DELAY);
};

// Khi tắt Micro
recognition.onend = function () {
    isListening = false;
    clearTimeout(silenceTimer);

    startBtn.style.backgroundColor = "#0084ff";
    startBtn.style.boxShadow = "0 2px 8px rgba(0, 132, 255, 0.4)";

    const lang = document.getElementById('source-lang').value;
    statusText.innerText = uiTranslations[lang].statusReady;
};


// =========================================================
// PHẦN 3: GỌI API DỊCH THUẬT (MYMEMORY API)
// =========================================================

async function translateText(textToTranslate) {
    const sourceLang = document.getElementById('source-lang').value;
    const targetLang = document.getElementById('target-lang').value;

    const safeText = encodeURIComponent(textToTranslate);

    // THAY EMAIL CỦA BẠN VÀO ĐÂY (Để tăng hạn mức lên 50.000 ký tự/ngày)
    const myEmail = "tampes5k@gmail.com";

    // Link API
    const apiUrl = `https://api.mymemory.translated.net/get?q=${safeText}&langpair=${sourceLang}|${targetLang}&de=${myEmail}`;

    // --- TẠO BONG BÓNG CHỜ DỊCH (BƯỚC 4) ---
    const box = document.getElementById('translated-box');
    const loadingBubble = document.createElement('div');
    loadingBubble.className = 'bubble translated';

    // Lấy trạng thái "(Đang dịch...)" theo đúng ngôn ngữ
    const ui = uiTranslations[sourceLang];
    loadingBubble.innerText = ui.statusTranslating;

    box.appendChild(loadingBubble);
    box.scrollTop = box.scrollHeight;

    try {
        // Gửi yêu cầu dịch thuật
        const response = await fetch(apiUrl);
        const data = await response.json();

        const translatedResult = data.responseData.translatedText;

        // --- CẬP NHẬT KẾT QUẢ VÀO BONG BÓNG CHỜ ---
        // Ghi đè chữ thật lên trên chữ "(Đang dịch...)"
        loadingBubble.innerText = translatedResult;
        box.scrollTop = box.scrollHeight;

    } catch (error) {
        console.error("Lỗi khi dịch thuật:", error);
        loadingBubble.innerText = "(⚠️ Lỗi kết nối mạng, không thể dịch)";
    }
}