const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log("=== BẮT ĐẦU KIỂM TRA DỰ ÁN TOÀN DIỆN ===");
let hasError = false;

// 1. Kiểm tra cú pháp JavaScript
try {
    const jsCode = fs.readFileSync('app.js', 'utf8');
    new vm.Script(jsCode);
    console.log("✅ Cú pháp JS (app.js): HỢP LỆ");
} catch (err) {
    console.error("❌ LỖI CÚ PHÁP JS (app.js):");
    console.error(err.message);
    console.error("Vị trí ước tính:", err.stack.split('\n')[0]);
    hasError = true;
}

// 2. Kiểm tra tính hợp lệ của tất cả các file JSON
const jsonFiles = [
    'data/topics.json',
    'data/fallback_words.json'
];

// Quét thêm thư mục vocabulary nếu tồn tại
const vocabDir = 'data/vocabulary';
if (fs.existsSync(vocabDir)) {
    const files = fs.readdirSync(vocabDir);
    files.forEach(file => {
        if (file.endsWith('.json')) {
            jsonFiles.push(path.join(vocabDir, file));
        }
    });
}

jsonFiles.forEach(file => {
    if (fs.existsSync(file)) {
        try {
            const content = fs.readFileSync(file, 'utf8');
            JSON.parse(content);
            console.log(`✅ File JSON (${file}): HỢP LỆ`);
        } catch (err) {
            console.error(`❌ LỖI FILE JSON (${file}):`);
            console.error(err.message);
            hasError = true;
        }
    } else {
        console.warn(`⚠️ Cảnh báo: File ${file} không tìm thấy.`);
    }
});

// 3. Kiểm tra đồng bộ DOM IDs giữa app.js và index.html
try {
    const jsCode = fs.readFileSync('app.js', 'utf8');
    const htmlCode = fs.readFileSync('index.html', 'utf8');
    
    // Tìm tất cả getElementById trong app.js
    const idRegex = /document\.getElementById\(['"]([^'"]+)['"]\)/g;
    const jsIds = new Set();
    let match;
    while ((match = idRegex.exec(jsCode)) !== null) {
        jsIds.add(match[1]);
    }
    
    console.log(`Kiểm tra liên kết DOM: Tìm thấy ${jsIds.size} ID được tham chiếu trong app.js.`);
    
    // Tìm tất cả id trong index.html
    const htmlIdRegex = /id=['"]([^'"]+)['"]/g;
    const htmlIds = new Set();
    const duplicateHtmlIds = [];
    while ((match = htmlIdRegex.exec(htmlCode)) !== null) {
        const id = match[1];
        if (htmlIds.has(id)) {
            duplicateHtmlIds.push(id);
        }
        htmlIds.add(id);
    }
    
    // Kiểm tra trùng lặp ID trong HTML
    if (duplicateHtmlIds.length > 0) {
        console.error("❌ LỖI TRÙNG LẶP ID TRONG index.html:");
        duplicateHtmlIds.forEach(id => console.error(`  - ID "${id}" bị khai báo trùng lặp nhiều lần!`));
        hasError = true;
    } else {
        console.log("✅ Không có ID trùng lặp trong index.html");
    }
    
    // Kiểm tra ID bị thiếu trong HTML
    const missingIds = [];
    jsIds.forEach(id => {
        if (!htmlIds.has(id)) {
            missingIds.push(id);
        }
    });
    
    if (missingIds.length > 0) {
        console.error("❌ LỖI LIÊN KẾT DOM (Thiếu ID trong index.html):");
        missingIds.forEach(id => {
            console.error(`  - ID "${id}" được gọi trong app.js nhưng KHÔNG TỒN TẠI trong index.html!`);
        });
        hasError = true;
    } else {
        console.log("✅ Tất cả ID trong app.js đều tồn tại đầy đủ trong index.html!");
    }
} catch (err) {
    console.error("❌ Lỗi khi phân tích liên kết DOM:", err.message);
    hasError = true;
}

// 4. Kiểm tra các lỗi HTML cơ bản (như mở/đóng thẻ)
try {
    const htmlCode = fs.readFileSync('index.html', 'utf8');
    // Kiểm tra số lượng thẻ mở và đóng của một số thẻ quan trọng
    const tagsToCheck = ['div', 'button', 'section', 'span'];
    tagsToCheck.forEach(tag => {
        const openCount = (htmlCode.match(new RegExp(`<${tag}\\b`, 'g')) || []).length;
        const closeCount = (htmlCode.match(new RegExp(`</${tag}>`, 'g')) || []).length;
        
        if (openCount !== closeCount) {
            console.warn(`⚠️ Cảnh báo cấu trúc HTML: Thẻ <${tag}> có số lượng mở (${openCount}) và đóng (${closeCount}) không khớp nhau!`);
        }
    });
} catch (err) {
    console.error("❌ Lỗi khi phân tích cấu trúc HTML:", err.message);
}

console.log("\n=== KẾT QUẢ KIỂM TRA ===");
if (hasError) {
    console.error("❌ DỰ ÁN CÓ LỖI! Vui lòng sửa các mục màu đỏ phía trên.");
    process.exit(1);
} else {
    console.log("🎉 TUYỆT VỜI! Dự án hoàn hảo, không phát hiện lỗi nào.");
    process.exit(0);
}
