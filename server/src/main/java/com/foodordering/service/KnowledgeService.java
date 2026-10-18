package com.foodordering.service;

import com.foodordering.entity.KnowledgeDocument;
import com.foodordering.repository.KnowledgeDocumentRepository;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class KnowledgeService {
    private final KnowledgeDocumentRepository repo;

    public KnowledgeService(KnowledgeDocumentRepository repo) {
        this.repo = repo;
    }

    /** Định dạng tài liệu tham khảo mà chatbot đọc được; tài liệu ngoài danh sách này sẽ bị từ chối. */
    private static final Set<String> ALLOWED = Set.of(".pdf", ".docx", ".txt", ".md");

    // PDF/DOCX được trích xuất thành text; các định dạng khác được đọc như text thuần.
    public KnowledgeDocument upload(MultipartFile file) throws Exception {
        String name = Objects.requireNonNullElse(file.getOriginalFilename(), "document").toLowerCase();
        String ext = name.substring(name.lastIndexOf('.'));
        if (!ALLOWED.contains(ext)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Chỉ chấp nhận tài liệu PDF, DOCX, TXT hoặc MD");
        }
        String text;
        try (InputStream in = file.getInputStream()) {
            if (ext.equals(".pdf")) {
                try (var pdf = Loader.loadPDF(in.readAllBytes())) {
                    text = new PDFTextStripper().getText(pdf);
                }
            } else if (ext.equals(".docx")) {
                try (var doc = new XWPFDocument(in); var ex = new XWPFWordExtractor(doc)) {
                    text = ex.getText();
                }
            } else {
                text = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            }
        }
        // PDF scan không có lớp text sẽ trích ra chuỗi rỗng; lưu vậy thì tài liệu vô dụng mà vẫn hiện thành công.
        if (text == null || text.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Không đọc được nội dung tài liệu. Tệp có thể rỗng hoặc là bản quét chưa nhận dạng ký tự.");
        }
        KnowledgeDocument d = new KnowledgeDocument();
        d.setTitle(file.getOriginalFilename());
        d.setContent(text);
        return repo.save(d);
    }

    public List<String> findRelevant(String question, int limit) {
        Set<String> words = Arrays.stream(question.toLowerCase().split("\\s+"))
                .filter(w -> w.length() > 2).collect(Collectors.toSet());
        if (words.isEmpty()) return List.of();

        record Scored(String text, int score) {}
        List<Scored> all = new ArrayList<>();
        for (KnowledgeDocument d : repo.findAll()) {
            for (String chunk : split(d.getContent(), 500)) {
                String lower = chunk.toLowerCase();
                int score = (int) words.stream().filter(lower::contains).count();
                if (score > 0) all.add(new Scored(chunk, score));
            }
        }
        return all.stream()
                .sorted(Comparator.comparingInt(Scored::score).reversed())
                .limit(limit).map(Scored::text).toList();
    }

    private List<String> split(String text, int size) {
        List<String> parts = new ArrayList<>();
        if (text == null) return parts;
        for (int i = 0; i < text.length(); i += size) {
            parts.add(text.substring(i, Math.min(text.length(), i + size)));
        }
        return parts;
    }
}