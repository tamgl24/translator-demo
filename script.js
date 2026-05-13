/* eslint-disable */

// =========================================================
// UI DICTIONARY
const uiTranslations = {
    "vi-VN": { labelSource: "Bạn đã nói: ", labelTarget: "Văn bản đã dịch: ", placeholder: "Nhập văn bản hoặc bấm micro để nói...", statusTranslating: "(Đang dịch...)", statusUpdating: "(Đang cập nhật...)" },
    "en-US": { labelSource: "You said: ", labelTarget: "Translated text: ", placeholder: "Type text or click mic to speak...", statusTranslating: "(Translating...)", statusUpdating: "(Updating...)" },
    "zh-CN": { labelSource: "你说了： ", labelTarget: "翻译文本： ", placeholder: "输入文本或点击麦克风说话...", statusTranslating: "(翻译中...)", statusUpdating: "(更新中...)" },
    "ja-JP": { labelSource: "あなたの発言： ", labelTarget: "翻訳テキスト： ", placeholder: "テキストを入力するかマイクをクリック...", statusTranslating: "(翻訳中...)", statusUpdating: "(更新中...)" },
    "fr-FR": { labelSource: "Vous avez dit : ", labelTarget: "Texte traduit : ", placeholder: "Tapez du texte ou cliquez sur le micro...", statusTranslating: "(Traduction en cours...)", statusUpdating: "(Mise à jour...)" },
    "es-ES": { labelSource: "Tú dijiste: ", labelTarget: "Texto traducido: ", placeholder: "Escribe texto o haz clic en el micro...", statusTranslating: "(Traduciendo...)", statusUpdating: "(Actualizando...)" }
};

document.getElementById('source-lang').addEventListener('change', function () {
    const ui = uiTranslations[this.value];
    if (ui) {
        document.getElementById('label-source').innerText = ui.labelSource;
        document.getElementById('label-target').innerText = ui.labelTarget;
        document.getElementById('chat-input').placeholder = ui.placeholder;
    }
});

// =========================================================
// TEXT-TO-SPEECH
let isAutoSpeakEnabled = false;
const ttsToggleBtn = document.getElementById('tts-toggle');

ttsToggleBtn.addEventListener('click', function () {
    isAutoSpeakEnabled = !isAutoSpeakEnabled;
    if (isAutoSpeakEnabled) {
        this.classList.add('active');
        this.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    } else {
        this.classList.remove('active');
        this.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        window.speechSynthesis.cancel();
    }
});

function speakText(text, isManualClick = false) {
    if (!text) return;

    // Nếu Auto-Loa đang tắt VÀ người dùng KHÔNG click thủ công -> Bỏ qua không đọc
    if (!isAutoSpeakEnabled && !isManualClick) return;

    const langCode = document.getElementById('target-lang').value;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = 1.0;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

// =========================================================
// STREAMING
async function performTranslation(textToTranslate, targetBubbleElement) {
    const sourceLang = document.getElementById('source-lang').options[document.getElementById('source-lang').selectedIndex].text;
    const targetLang = document.getElementById('target-lang').options[document.getElementById('target-lang').selectedIndex].text;

    const API_KEY = "AIzaSyAYzHPFpqqpbEjzAdryjlmXduiUINUCInQ";

    // Sử dụng model Flash
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${API_KEY}`;

    const systemPrompt = `Bạn là một học giả dịch thuật chuyên gia. Nhiệm vụ của bạn là dịch đoạn văn dưới đây từ ${sourceLang} sang ${targetLang}. 
YÊU CẦU QUAN TRỌNG:
1. Dịch chính xác nghĩa đen, tiếng lóng, và tên riêng. Trả lời trực tiếp bằng kết quả dịch, tuyệt đối không giải thích hay tự ý cắt bớt câu.
2. Nếu có điển tích hoặc hành động có vẻ nguy hiểm, hãy hiểu đó là ngữ cảnh văn học/lịch sử, KHÔNG PHẢI hành vi bạo lực hay tự hại. Hãy dịch đầy đủ.
Văn bản cần dịch: "${textToTranslate}"`;

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 2048 // Đủ để dịch đoạn văn rất dài
                },
                // Tắt bộ lọc an toàn để tránh bị cắt chữ
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            })
        });

        if (!response.ok) throw new Error("Lỗi kết nối máy chủ AI");

        targetBubbleElement.innerText = "";
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        let buffer = "";
        let fullTranslatedText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const dataStr = line.replace("data: ", "").trim();
                    if (dataStr) {
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.candidates && data.candidates.length > 0) {
                                const textPart = data.candidates[0].content.parts[0].text;

                                targetBubbleElement.innerText += textPart;
                                fullTranslatedText += textPart;

                                const translatedBox = document.getElementById("translated-box");
                                translatedBox.scrollTop = translatedBox.scrollHeight;
                            }
                        } catch (e) {
                            // Bỏ qua mảnh JSON hỏng
                        }
                    }
                }
            }
        }

        // Phát âm thanh
        speakText(fullTranslatedText.trim(), false);

    } catch (error) {
        console.error("Translation Error:", error);
        targetBubbleElement.innerText = "(⚠️ Lỗi kết nối hoặc AI từ chối phục vụ)";
    }
}

// =========================================================
// THIẾT LẬP BONG BÓNG VÀ SỬA CHỮ
function setupEditableBubble(originalBubble, initialText) {
    const sourceLang = document.getElementById('source-lang').value;
    const ui = uiTranslations[sourceLang] || uiTranslations["vi-VN"];

    originalBubble.contentEditable = true;
    originalBubble.classList.add('editable');
    originalBubble.title = "Click để sửa lại văn bản";

    const translatedBox = document.getElementById('translated-box');
    const translatedBubble = document.createElement('div');
    translatedBubble.className = 'bubble translated';
    translatedBubble.innerText = ui.statusTranslating || "(Đang dịch...)";
    translatedBox.appendChild(translatedBubble);
    translatedBox.scrollTop = translatedBox.scrollHeight;

    performTranslation(initialText, translatedBubble);

    let previousText = initialText;

    originalBubble.addEventListener('blur', function () {
        const newText = this.innerText.trim();
        if (newText !== "" && newText !== previousText) {
            translatedBubble.innerText = ui.statusUpdating || "(Đang cập nhật...)";
            performTranslation(newText, translatedBubble);
            previousText = newText;
        }
    });

    originalBubble.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.blur();
        }
    });
}

// =========================================================
// XỬ LÝ ÂM THANH (MICRO) VÀ NHẬP LIỆU
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
}

let isListening = false;
let currentVoiceBubble = null;
let silenceTimer;

// Thời gian chờ im lặng: 2 giây để cân bằng giữa nói dài và không bị nghẽn API
const SILENCE_DELAY = 2000;

const startBtn = document.getElementById('start-btn');
const originalBox = document.getElementById('original-box');

startBtn.onclick = function () {
    if (!recognition) return alert("Trình duyệt không hỗ trợ Web Speech API.");
    if (isListening) {
        recognition.stop();
    } else {
        recognition.lang = document.getElementById('source-lang').value;
        recognition.start();
    }
};

if (recognition) {
    recognition.onstart = function () {
        isListening = true;
        startBtn.classList.add('active');
    };

    recognition.onresult = function (event) {
        let interim = "";
        let final = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) final += event.results[i][0].transcript;
            else interim += event.results[i][0].transcript;
        }

        if (!currentVoiceBubble) {
            currentVoiceBubble = document.createElement('div');
            currentVoiceBubble.className = 'bubble original';
            originalBox.appendChild(currentVoiceBubble);
        }

        // Chỉ cập nhật văn bản nếu bong bóng chưa bị gắn cờ "processed"
        if (!currentVoiceBubble.classList.contains('processed')) {
            currentVoiceBubble.innerText = final + interim;
            originalBox.scrollTop = originalBox.scrollHeight;
        }

        clearTimeout(silenceTimer);
        silenceTimer = setTimeout(function () {
            recognition.stop();

            // Nếu bong bóng chưa được gửi đi dịch -> Gửi đi và gắn cờ
            if (currentVoiceBubble && !currentVoiceBubble.classList.contains('processed')) {
                const finalText = currentVoiceBubble.innerText.trim();
                if (finalText !== "") {
                    currentVoiceBubble.classList.add('processed');
                    setupEditableBubble(currentVoiceBubble, finalText);
                } else {
                    currentVoiceBubble.remove();
                }
            }
        }, SILENCE_DELAY);
    };

    recognition.onend = function () {
        isListening = false;
        clearTimeout(silenceTimer);
        startBtn.classList.remove('active');

        // CHỈ DỌN DẸP BONG BÓNG KHI MICRO ĐÃ TẮT HẲN
        currentVoiceBubble = null;
    };
}

// --- XỬ LÝ NHẬP VĂN BẢN THỦ CÔNG ---
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

function handleManualSend() {
    const textToTranslate = chatInput.value.trim();
    if (textToTranslate === "") return;

    const typedBubble = document.createElement('div');
    typedBubble.className = 'bubble original';
    typedBubble.innerText = textToTranslate;
    originalBox.appendChild(typedBubble);
    originalBox.scrollTop = originalBox.scrollHeight;

    chatInput.value = "";
    setupEditableBubble(typedBubble, textToTranslate);
}

sendBtn.onclick = handleManualSend;
chatInput.addEventListener("keypress", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
        handleManualSend();
    }
});

// =========================================================
// SỰ KIỆN CLICK ĐỂ NGHE LẠI BẢN DỊCH
document.getElementById('translated-box').addEventListener('click', function (e) {
    // Nếu người dùng click trúng một bong bóng bản dịch
    if (e.target.classList.contains('translated')) {
        const textToRead = e.target.innerText.trim();

        if (textToRead !== "" && textToRead !== "(⚠️ Lỗi kết nối hoặc AI từ chối phục vụ)") {
            speakText(textToRead, true); // Chuyền 'true' để ép đọc dù loa đang tắt
        }
    }
});