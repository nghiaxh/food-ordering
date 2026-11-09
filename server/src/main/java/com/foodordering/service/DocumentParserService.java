package com.foodordering.service;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Tach text tu file admin tai len: TXT/MD doc thang UTF-8, PDF bang PDFBox, DOCX bang POI.
 * Chi nhan file khong vuot 10MB (gioi han cua spring.servlet.multipart).
 */
@Service
public class DocumentParserService {

    public String parse(MultipartFile file) throws Exception {
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".markdown")) {
            return new String(file.getBytes(), StandardCharsets.UTF_8);
        }
        if (name.endsWith(".pdf")) {
            try (PDDocument doc = Loader.loadPDF(file.getBytes())) {
                return new PDFTextStripper().getText(doc);
            }
        }
        if (name.endsWith(".docx")) {
            StringBuilder sb = new StringBuilder();
            try (XWPFDocument doc = new XWPFDocument(file.getInputStream())) {
                for (XWPFParagraph p : doc.getParagraphs()) sb.append(p.getText()).append("\n");
            }
            return sb.toString();
        }
        throw new IllegalArgumentException("Chỉ chấp nhận PDF, DOCX, TXT, MD");
    }

    /** Chia van ban thanh cac doan 600 ky tu, overlap 80 ky tu de khong vo y. */
    public List<String> chunk(String text) {
        if (text == null || text.isBlank()) return List.of();
        String t = text.replaceAll("\\s+", " ").trim();
        java.util.List<String> out = new java.util.ArrayList<>();
        final int SIZE = 600;
        final int STEP = 520;
        for (int i = 0; i < t.length(); i += STEP) {
            int end = Math.min(t.length(), i + SIZE);
            out.add(t.substring(i, end).trim());
            if (end == t.length()) break;
        }
        return out;
    }
}
