const fs = require('fs');
const path = require('path');

console.log("=== BẮT ĐẦU KIỂM TRA TÍNH NHẤT QUÁN TỪ VỰNG ===");

const vocabDir = path.join(__dirname, 'data', 'vocabulary');
if (!fs.existsSync(vocabDir)) {
    console.error("❌ Thư mục vocabulary không tồn tại!");
    process.exit(1);
}

const files = fs.readdirSync(vocabDir).filter(f => f.endsWith('.json'));
const filterFile = process.argv[2];
const filesToCheck = filterFile ? files.filter(f => f.toLowerCase() === filterFile.toLowerCase()) : files;

let totalErrors = 0;
let totalFilesChecked = 0;

filesToCheck.forEach(file => {
    const filePath = path.join(vocabDir, file);
    let words = [];
    try {
        words = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error(`❌ Không thể parse file JSON: ${file}`);
        totalErrors++;
        return;
    }

    totalFilesChecked++;
    let fileErrors = 0;

    words.forEach(wordObj => {
        const errors = [];
        const { id, word, pronunciation, partOfSpeech, definition, example, exampleVi, collocations, wordFamily } = wordObj;

        // 1. Kiểm tra partOfSpeech ↔ definition
        if (partOfSpeech === 'verb') {
            if (definition && !definition.trim().startsWith('To ')) {
                errors.push(`Định nghĩa động từ không bắt đầu bằng "To" (definition: "${definition}")`);
            }
        } else if (partOfSpeech === 'noun' || partOfSpeech === 'adjective' || partOfSpeech === 'adverb') {
            if (definition && definition.trim().startsWith('To ')) {
                errors.push(`Định nghĩa ${partOfSpeech} lại bắt đầu bằng "To" (definition: "${definition}")`);
            }
        }

        // 2. Kiểm tra IPA / pronunciation
        if (pronunciation) {
            // Kiểm tra xem có chứa chữ thường thường không có ký tự IPA nào, hoặc chỉ là từ gốc nằm trong slashes
            const cleanPron = pronunciation.replace(/[\/\[\]]/g, '').trim();
            if (cleanPron === word.trim()) {
                errors.push(`Phiên âm IPA bị lỗi rập khuôn (literal word: "${pronunciation}")`);
            } else if (!pronunciation.startsWith('/') && !pronunciation.startsWith('[')) {
                errors.push(`Phiên âm IPA không bắt đầu bằng / hoặc [ (pronunciation: "${pronunciation}")`);
            }
        } else {
            errors.push("Thiếu phiên âm IPA");
        }

        // 3. Kiểm tra ví dụ (example) chứa từ
        if (example) {
            // Rút gọn từ để so khớp tương đối (ví dụ: invest -> check invest, corpor -> check corpor)
            const baseWord = word.toLowerCase().substring(0, Math.max(3, word.length - 2));
            if (!example.toLowerCase().includes(baseWord)) {
                errors.push(`Ví dụ không chứa từ gốc (word: "${word}", example: "${example}")`);
            }
        } else {
            errors.push("Thiếu câu ví dụ");
        }

        // 4. Kiểm tra Collocation trùng lặp hoặc chứa placeholder
        if (collocations) {
            if (collocations.includes('process, key')) {
                errors.push(`Collocation chứa mẫu placeholder cũ: "${collocations}"`);
            }
            const colList = collocations.split(',').map(c => c.trim().toLowerCase());
            const duplicates = colList.filter((item, index) => colList.indexOf(item) !== index);
            if (duplicates.length > 0) {
                errors.push(`Collocation bị trùng lặp: "${duplicates.join(', ')}"`);
            }
        } else {
            errors.push("Thiếu collocation");
        }

        // 5. Kiểm tra Word Family chứa placeholder
        if (wordFamily) {
            if (wordFamily.trim() === `${word} (${partOfSpeech})`) {
                errors.push(`Word Family bị rập khuôn placeholder: "${wordFamily}"`);
            }
        } else {
            errors.push("Thiếu word family");
        }

        if (errors.length > 0) {
            if (fileErrors === 0) {
                console.log(`\n--- File: ${file} ---`);
            }
            console.log(`❌ Từ [${word}] (ID: ${id}):`);
            errors.forEach(err => console.log(`   - ${err}`));
            fileErrors += errors.length;
            totalErrors += errors.length;
        }
    });
});

console.log(`\n=== KẾT QUẢ KIỂM TRA ===`);
console.log(`Đã quét: ${totalFilesChecked} tệp JSON từ vựng.`);
if (totalErrors > 0) {
    console.log(`Phát hiện tổng cộng: ${totalErrors} lỗi nhất quán.`);
    process.exit(1);
} else {
    console.log(`🎉 Tuyệt vời! Không phát hiện lỗi nhất quán nào.`);
    process.exit(0);
}
