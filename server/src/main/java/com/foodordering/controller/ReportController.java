package com.foodordering.controller;

import com.foodordering.dto.ReportDtos;
import com.foodordering.service.ReportService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/admin/reports")
public class ReportController {
    private final ReportService service;

    public ReportController(ReportService service) { this.service = service; }

    private LocalDateTime from(String v) {
        if (v == null || v.isBlank()) return LocalDateTime.now().minusDays(30);
        return LocalDateTime.parse(v);
    }

    private LocalDateTime to(String v) {
        if (v == null || v.isBlank()) return LocalDateTime.now();
        return LocalDateTime.parse(v);
    }

    @GetMapping("/summary")
    public ReportDtos.SummaryResponse summary(@RequestParam(required = false) String from,
                                             @RequestParam(required = false) String to) {
        return service.summary(from(from), to(to));
    }

    @GetMapping("/revenue")
    public java.util.List<ReportDtos.RevenuePoint> revenue(@RequestParam(required = false) String from,
                                                          @RequestParam(required = false) String to) {
        return service.revenue(from(from), to(to));
    }

    @GetMapping("/top-foods")
    public java.util.List<ReportDtos.TopFood> topFoods(@RequestParam(required = false) String from,
                                                      @RequestParam(required = false) String to,
                                                      @RequestParam(defaultValue = "10") int limit) {
        return service.topFoods(from(from), to(to), limit);
    }

    @GetMapping("/promotions")
    public java.util.List<ReportDtos.PromotionUsage> promotions(@RequestParam(required = false) String from,
                                                               @RequestParam(required = false) String to) {
        return service.promotions(from(from), to(to));
    }

    @GetMapping("/combos")
    public java.util.List<ReportDtos.ComboSales> combos(@RequestParam(required = false) String from,
                                                       @RequestParam(required = false) String to) {
        return service.combos(from(from), to(to));
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(@RequestParam(required = false) String from,
                                        @RequestParam(required = false) String to) throws Exception {
        byte[] data = service.exportExcel(from(from), to(to));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"bao-cao.xlsx\"")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }
}