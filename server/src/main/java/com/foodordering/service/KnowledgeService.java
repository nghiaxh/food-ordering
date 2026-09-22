package com.foodordering.service;

import com.foodordering.entity.KnowledgeDocument;
import com.foodordering.repository.KnowledgeDocumentRepository;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class KnowledgeService {
    private final KnowledgeDocumentRepository repo;

    public KnowledgeService(KnowledgeDocumentRepository repo) {
        this.repo = repo;
    }

    public KnowledgeDocument upload(MultipartFile file) throws Exception {
        String name = Objects.requireNonNullElse(file.getOriginalFilename(), "document").toLowerCase();
        String text;
        try (InputStream in = file.getInputStream()) {
            if (name.endsWith(".pdf")) {
                try (var pdf = Loader.loadPDF(in.readAllBytes())) {
                    text = new PDFTextStripper().getText(pdf);
                }
            } else if (name.endsWith(".docx")) {
                try (var doc = new XWPFDocument(in); var ex = new XWPFWordExtractor(doc)) {
                    text = ex.getText();
                }
            } else {
                text = new String(in.readAllBytes());
            }
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