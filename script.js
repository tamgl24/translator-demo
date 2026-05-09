// =========================================================
// PHẦN 1: TỪ ĐIỂN GIAO DIỆN (UI DICTIONARY)
// =========================================================
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
// PHẦN 2: LOGIC CHÍNH - XỬ LÝ BONG BÓNG & AI GEMINI
// =========================================================

function setupEditableBubble(originalBubble, initialText) {
    const sourceLang = document.getElementById('source-lang').value;
    const ui = uiTranslations[sourceLang];

    // 1. Cho phép bong bóng gốc được sửa chữ
    originalBubble.contentEditable = true;
    originalBubble.classList.add('editable');
    originalBubble.title = "Click để sửa lại văn bản";

    // 2. Tạo bong bóng Dịch tương ứng
    const translatedBox = document.getElementById('translated-box');
    const translatedBubble = document.createElement('div');
    translatedBubble.className = 'bubble translated';
    translatedBubble.innerText = ui.statusTranslating;
    translatedBox.appendChild(translatedBubble);
    translatedBox.scrollTop = translatedBox.scrollHeight;

    // 3. Gọi hàm dịch thuật lần đầu
    performTranslation(initialText, translatedBubble);



    // 4. LẮNG NGHE SỰ KIỆN KHI NGƯỜI DÙNG SỬA CHỮ
    let previousText = initialText;

    originalBubble.addEventListener('blur', function () {
        const newText = this.innerText.trim();

        if (newText !== "" && newText !== previousText) {
            console.log("Phát hiện văn bản bị thay đổi. Đang dịch lại...");
            translatedBubble.innerText = ui.statusUpdating;
            performTranslation(newText, translatedBubble);
            previousText = newText;
        }
    });

    originalBubble.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.blur(); // Tự động thoát chế độ gõ khi nhấn Enter
        }
    });
}

// =========================================================
// PHẦN 2: LOGIC CHÍNH - GỌI API GEMINI (BẢN VÁ LỖI CẮT CHỮ)
// =========================================================
async function performTranslation(textToTranslate, targetBubbleElement) {
    const sourceSelect = document.getElementById("source-lang");
    const targetSelect = document.getElementById("target-lang");
    const sourceLang = sourceSelect.options[sourceSelect.selectedIndex].text;
    const targetLang = targetSelect.options[targetSelect.selectedIndex].text;

    // --- ĐIỀN API KEY CỦA BẠN VÀO ĐÂY ---
    const API_KEY = "AIzaSyAJiI65LmCJEjf_Br1s_xPLG2LIWsJ6UG8";

    // Sử dụng model Flash 1.5 kết hợp Streaming
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${API_KEY}`;

    const systemPrompt = `Dịch từ ${sourceLang} sang ${targetLang}. Dịch chính xác nghĩa đen, tiếng lóng và tên riêng. Trả lời trực tiếp bằng kết quả dịch, tuyệt đối không giải thích hay tự ý cắt bớt câu.
Văn bản: "${textToTranslate}"`;

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }],
                // TÌM ĐOẠN NÀY BÊN TRONG HÀM performTranslation:
                generationConfig: {
                    temperature: 0.1,
                    // Thay số 512 cũ thành 2048 (Hoặc 4096 nếu bạn muốn dịch siêu dài)
                    maxOutputTokens: 4096
                },
                // BƯỚC ĐỘT PHÁ 1: TẮT HOÀN TOÀN BỘ LỌC AN TOÀN ĐỂ KHÔNG BỊ CHẶN
                safetySettings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
                ]
            })
        });

        if (!response.ok) throw new Error("Lỗi API");

        targetBubbleElement.innerText = "";
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");

        // BƯỚC ĐỘT PHÁ 2: SỬ DỤNG BỘ ĐÊM (BUFFER) ĐỂ HỨNG TRỌN VẸN CHỮ
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");

            // Giữ lại dòng cuối cùng (chưa hoàn chỉnh) trong buffer để nối vào lần đọc sau
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    const dataStr = line.replace("data: ", "").trim();
                    if (dataStr) {
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.candidates && data.candidates.length > 0) {
                                // Bơm text thẳng vào giao diện siêu mượt
                                targetBubbleElement.innerText += data.candidates[0].content.parts[0].text;

                                // Cuộn khung chat xuống đáy
                                const translatedBox = document.getElementById("translated-box");
                                translatedBox.scrollTop = translatedBox.scrollHeight;
                            }
                        } catch (e) {
                            // Im lặng bỏ qua lỗi parse nhỏ (nếu có)
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error("Translation Error:", error);
        targetBubbleElement.innerText = "(⚠️ Lỗi kết nối hoặc AI từ chối phục vụ)";
    }
}


// =========================================================
// PHẦN 4: XỬ LÝ ÂM THANH VÀ GÕ VĂN BẢN
// =========================================================

// --- A. XỬ LÝ NÓI ---
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
const SILENCE_DELAY = 2000; // Ngắt câu sau 2 giây im lặng

const startBtn = document.getElementById('start-btn');
const originalBox = document.getElementById('original-box');

startBtn.onclick = function () {
    if (!recognition) return alert("Trình duyệt không hỗ trợ Web Speech API.");
    if (isListening) recognition.stop();
    else {
        recognition.lang = document.getElementById('source-lang').value;
        recognition.start();
    }
};

recognition.onstart = function () {
    isListening = true;
    startBtn.classList.add('active');
};

recognition.onresult = function (event) {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
        else interimTranscript += event.results[i][0].transcript;
    }

    if (!currentVoiceBubble) {
        currentVoiceBubble = document.createElement('div');
        currentVoiceBubble.className = 'bubble original';
        originalBox.appendChild(currentVoiceBubble);
    }

    currentVoiceBubble.innerText = finalTranscript + interimTranscript;
    originalBox.scrollTop = originalBox.scrollHeight;

    // Reset đồng hồ cát mỗi khi có âm thanh mới
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(function () {
        recognition.stop();

        const finalText = currentVoiceBubble.innerText.trim();
        if (finalText !== "") {
            setupEditableBubble(currentVoiceBubble, finalText);
        } else {
            currentVoiceBubble.remove();
        }
        currentVoiceBubble = null;

    }, SILENCE_DELAY);
};

recognition.onend = function () {
    isListening = false;
    clearTimeout(silenceTimer);
    startBtn.classList.remove('active');
};


// --- B. XỬ LÝ GÕ (Bằng thanh nhập liệu) ---
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