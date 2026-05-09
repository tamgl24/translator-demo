// =========================================================
// PHẦN 1: TỪ ĐIỂN GIAO DIỆN (UI DICTIONARY)
// =========================================================
const uiTranslations = {
    "vi-VN": { labelSource: "Bạn đã nói: ", labelTarget: "Văn bản đã dịch: ", statusReady: "Sẵn sàng. Hãy bấm nút micro để nói...", statusListening: "(Đang lắng nghe âm thanh)..." },
    "en-US": { labelSource: "You said: ", labelTarget: "Translated text: ", statusReady: "Ready. Click mic to speak...", statusListening: "(Listening to your voice)..." },
    "zh-CN": { labelSource: "你说了： ", labelTarget: "翻译文本： ", statusReady: "准备就绪。点击麦克风...", statusListening: "(正在听)..." },
    "ja-JP": { labelSource: "あなたの発言： ", labelTarget: "翻訳テキスト： ", statusReady: "準備完了。マイクをクリック...", statusListening: "(聞いています)..." },
    "fr-FR": { labelSource: "Vous avez dit : ", labelTarget: "Texte traduit : ", statusReady: "Prêt. Cliquez sur le micro...", statusListening: "(En train d'écouter)..." },
    "es-ES": { labelSource: "Tú dijiste: ", labelTarget: "Texto traducido: ", statusReady: "Listo. Haz clic en el micro...", statusListening: "(Escuchando)..." }
};

// Lắng nghe sự kiện đổi ngôn ngữ để cập nhật các dòng chữ trên giao diện
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

// 1. Kiểm tra xem trình duyệt có hỗ trợ API này không
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (!SpeechRecognition) {
    alert("Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Vui lòng sử dụng Google Chrome trên máy tính.");
} else {
    // Khởi tạo đối tượng nhận diện giọng nói
    recognition = new SpeechRecognition();
    recognition.continuous = true;      // Nghe liên tục nhiều câu
    recognition.interimResults = true;  // Trả về kết quả ngay lập tức khi đang nói
}

// 2. Khởi tạo các biến trạng thái
let isListening = false;
let currentBubble = null;       // Lưu trữ bong bóng chat đang được viết dở
let silenceTimer;               // Biến lưu trữ "Đồng hồ cát"
const SILENCE_DELAY = 2000;     // 2000ms (2 giây) - Thời gian xác định người dùng đã ngừng nói

const startBtn = document.getElementById('start-btn');
const statusText = document.getElementById('status-text');

// 3. Xử lý khi bấm nút Micro
startBtn.onclick = function () {
    if (!recognition) return;

    if (isListening) {
        recognition.stop(); // Nếu đang nghe thì tắt đi
    } else {
        // Lấy mã ngôn ngữ mà người dùng chọn (VD: vi-VN) để báo cho AI biết
        recognition.lang = document.getElementById('source-lang').value;
        recognition.start(); // Bắt đầu nghe
    }
};

// 4. Sự kiện khi Micro BẮT ĐẦU nghe
recognition.onstart = function () {
    isListening = true;

    // Đổi màu nút Mic sang Đỏ để người dùng biết đang thu âm
    startBtn.style.backgroundColor = "#ff3b30";
    startBtn.style.boxShadow = "0 0 15px rgba(255, 59, 48, 0.6)";

    const lang = document.getElementById('source-lang').value;
    statusText.innerText = uiTranslations[lang].statusListening;
};

// 5. Sự kiện khi AI nhận diện được tiếng (Chạy liên tục khi miệng bạn đang phát âm)
recognition.onresult = function (event) {
    let interimTranscript = ''; // Chữ nháp (chưa chắc chắn)
    let finalTranscript = '';   // Chữ chốt (đã chắc chắn)

    // Duyệt qua dữ liệu âm thanh trả về
    for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
        } else {
            interimTranscript += event.results[i][0].transcript;
        }
    }

    const box = document.getElementById('original-box');

    // Nếu chưa có bong bóng nào, tạo một cái mới
    if (!currentBubble) {
        currentBubble = document.createElement('div');
        currentBubble.className = 'bubble original';
        box.appendChild(currentBubble);
    }

    // In chữ vào bong bóng (gồm cả chữ nháp và chữ chốt)
    currentBubble.innerText = finalTranscript + interimTranscript;
    box.scrollTop = box.scrollHeight; // Tự động cuộn xuống đáy

    // --- CƠ CHẾ ĐỒNG HỒ CÁT (DEBOUNCE) ---

    // Xóa đồng hồ cũ mỗi khi bạn phát ra một từ mới
    clearTimeout(silenceTimer);

    // Đặt một đồng hồ mới đếm ngược 2 giây
    silenceTimer = setTimeout(function () {
        console.log("Phát hiện im lặng 2 giây! Xác nhận ngừng nói.");

        // Dừng micro lại để chuẩn bị dịch (tránh thu âm tạp âm lúc đang dịch)
        recognition.stop();

        // Lấy đoạn văn bản hoàn chỉnh trong bong bóng
        const textToTranslate = currentBubble.innerText.trim();

        if (textToTranslate !== "") {
            console.log("Sẵn sàng mang câu này đi dịch: ", textToTranslate);

            // Gọi hàm dịch thuật
            translateText(textToTranslate);
        }

        // Cất "bút chì" đi, để lần bật mic tiếp theo sẽ tạo bong bóng mới
        currentBubble = null;

    }, SILENCE_DELAY);
};

// 6. Sự kiện khi Micro TẮT
recognition.onend = function () {
    isListening = false;
    clearTimeout(silenceTimer); // Xóa đồng hồ cát để tránh lỗi

    // Trả lại màu Xanh mặc định cho nút Mic
    startBtn.style.backgroundColor = "#0084ff";
    startBtn.style.boxShadow = "0 2px 8px rgba(0, 132, 255, 0.4)";

    const lang = document.getElementById('source-lang').value;
    statusText.innerText = uiTranslations[lang].statusReady;
};


// =========================================================
// PHẦN 3: GỌI API DỊCH THUẬT (MYMEMORY API)
// =========================================================

async function translateText(textToTranslate) {
    // 1. Lấy mã ngôn ngữ nguồn và đích từ giao diện
    const sourceLang = document.getElementById('source-lang').value;
    const targetLang = document.getElementById('target-lang').value;

    // 2. Chuyển đổi văn bản để an toàn khi đưa lên link URL
    const safeText = encodeURIComponent(textToTranslate);

    // THAY EMAIL CỦA BẠN VÀO ĐÂY ĐỂ ĐƯỢC TĂNG DUNG LƯỢNG DỊCH (50.000 ký tự/ngày)
    const myEmail = "tampes5k@gmail.com";

    // 3. Tạo đường link kết nối đến máy chủ MyMemory API
    const apiUrl = `https://api.mymemory.translated.net/get?q=${safeText}&langpair=${sourceLang}|${targetLang}&de=${myEmail}`;

    try {
        // Trạng thái chờ dịch (Tùy chọn hiển thị loading - ở đây tôi in ra console cho gọn)
        console.log("Đang gửi yêu cầu dịch thuật...");

        // Gửi yêu cầu và đợi kết quả
        const response = await fetch(apiUrl);
        const data = await response.json();

        // Lấy câu đã dịch từ dữ liệu trả về
        const translatedResult = data.responseData.translatedText;

        console.log("Dịch thành công:", translatedResult);

        // 4. Hiển thị kết quả lên cột bên phải (Văn bản đã dịch)
        const box = document.getElementById('translated-box');
        const bubble = document.createElement('div');
        bubble.className = 'bubble translated';
        bubble.innerText = translatedResult;
        box.appendChild(bubble);

        // Tự động cuộn xuống đáy
        box.scrollTop = box.scrollHeight;

    } catch (error) {
        console.error("Lỗi khi dịch thuật:", error);
        alert("Có lỗi xảy ra khi kết nối với máy chủ dịch thuật! Vui lòng kiểm tra kết nối mạng.");
    }
}