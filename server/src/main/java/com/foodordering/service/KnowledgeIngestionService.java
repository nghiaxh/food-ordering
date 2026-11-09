package com.foodordering.service;

import com.foodordering.entity.ChatbotKnowledge;
import com.foodordering.entity.ChatbotKnowledgeChunk;
import com.foodordering.repository.ChatbotKnowledgeChunkRepository;
import com.foodordering.repository.ChatbotKnowledgeRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Nạp tai lieu: luu file, tach text, chia doan, tao embedding roi luu chunk.
 * Dong bo cho file nho (<10MB) la du, file lon sau nay chuyen sang job nen.
 */
@Service
public class KnowledgeIngestionService {
    private final ChatbotKnowledgeRepository docRepo;
    private final ChatbotKnowledgeChunkRepository chunkRepo;
    private final DocumentParserService parser;
    private final AiClient ai;
    private final Path uploadDir;

    public KnowledgeIngestionService(ChatbotKnowledgeRepository docRepo,
                                     ChatbotKnowledgeChunkRepository chunkRepo,
                                     DocumentParserService parser,
                                     AiClient ai,
                                     @org.springframework.beans.factory.annotation.Value("${app.upload.dir:uploads}") String uploadDir) {
        this.docRepo = docRepo;
        this.chunkRepo = chunkRepo;
        this.parser = parser;
        this.ai = ai;
        this.uploadDir = Path.of(uploadDir);
    }

    @Transactional
    public ChatbotKnowledge ingestText(String title, String category, String keywords, String content, boolean enabled) {
        ChatbotKnowledge d = new ChatbotKnowledge(title, category, keywords, content, enabled);
        d.setStatus("READY");
        ChatbotKnowledge saved = docRepo.save(d);
        reingest(saved.getId());
        return saved;
    }

    @Transactional
    public ChatbotKnowledge ingestFile(MultipartFile file, String title, String category, String keywords) throws Exception {
        ChatbotKnowledge d = new ChatbotKnowledge(title, category, keywords, "", true);
        d.setFileName(file.getOriginalFilename());
        d.setFileSize(file.getSize());
        d.setStatus("PENDING");
        ChatbotKnowledge saved = docRepo.save(d);

        // Luu file de reingest sau nay khong phai tai len lai.
        Files.createDirectories(uploadDir);
        Path target = uploadDir.resolve(safeName(saved.getId(), file.getOriginalFilename()));
        file.transferTo(target.toAbsolutePath());

        String text = parser.parse(file);
        saved.setContent(truncate(text, 4000));
        saved.setStatus("READY");
        docRepo.save(saved);
        buildChunks(saved, text);
        return saved;
    }

    /** Tao lai chunk tu noi dung hien tai (khi sua bang chu hoac doi embedding model). */
    @Transactional
    public void reingest(Long documentId) {
        ChatbotKnowledge d = docRepo.findById(documentId).orElseThrow();
        String text = d.getContent();
        if (text == null || text.isBlank()) {
            // Neu co file thi doc lai tu file.
            if (d.getFileName() != null) {
                Path p = uploadDir.resolve(safeName(documentId, d.getFileName()));
                if (Files.exists(p)) {
                    try {
                        // Doc lai bang parser qua file that (lay bytes giong upload).
                        byte[] bytes = Files.readAllBytes(p);
                        MultipartFile mf = mockFile(d.getFileName(), bytes);
                        text = parser.parse(mf);
                        d.setContent(truncate(text, 4000));
                    } catch (Exception e) {
                        d.setStatus("FAILED");
                        docRepo.save(d);
                        return;
                    }
                }
            }
            if (text == null || text.isBlank()) {
                d.setStatus("FAILED");
                docRepo.save(d);
                return;
            }
        }
        buildChunks(d, text);
        d.setStatus("READY");
        docRepo.save(d);
    }

    private void buildChunks(ChatbotKnowledge d, String text) {
        chunkRepo.deleteByDocumentId(d.getId());
        List<String> chunks = parser.chunk(text);
        int idx = 0;
        for (String c : chunks) {
            float[] vec = ai.embed(c);
            String lit = AiClient.toVectorLiteral(vec);
            chunkRepo.save(new ChatbotKnowledgeChunk(d.getId(), idx++, c, lit));
        }
    }

    @Transactional
    public void delete(Long documentId) {
        chunkRepo.deleteByDocumentId(documentId);
        docRepo.deleteById(documentId);
    }

    private String safeName(Long id, String original) {
        String name = original == null ? "doc" : original.replaceAll("[^a-zA-Z0-9._-]", "_");
        return id + "_" + name;
    }

    private String truncate(String s, int max) {
        if (s == null) return "";
        String t = s.replaceAll("\\s+", " ").trim();
        return t.length() <= max ? t : t.substring(0, max);
    }

    private MultipartFile mockFile(String name, byte[] bytes) {
        return new MultipartFile() {
            public String getName() { return "file"; }
            public String getOriginalFilename() { return name; }
            public String getContentType() { return null; }
            public boolean isEmpty() { return bytes.length == 0; }
            public long getSize() { return bytes.length; }
            public byte[] getBytes() { return bytes; }
            public java.io.InputStream getInputStream() throws IOException { return new java.io.ByteArrayInputStream(bytes); }
            public void transferTo(Path dest) throws IOException, IllegalStateException { Files.write(dest, bytes); }
            public void transferTo(java.io.File dest) throws IOException, IllegalStateException { Files.write(dest.toPath(), bytes); }
        };
    }
}
