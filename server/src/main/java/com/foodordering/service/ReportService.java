package com.foodordering.service;

import com.foodordering.dto.ReportDtos;
import com.foodordering.entity.OrderItem;
import com.foodordering.entity.Orders;
import com.foodordering.entity.Promotion;
import com.foodordering.repository.OrdersRepository;
import com.foodordering.repository.PromotionRepository;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ReportService {
    private final OrdersRepository orderRepo;
    private final PromotionRepository promotionRepo;

    public ReportService(OrdersRepository orderRepo, PromotionRepository promotionRepo) {
        this.orderRepo = orderRepo;
        this.promotionRepo = promotionRepo;
    }

    private List<Orders> inRange(LocalDateTime from, LocalDateTime to) {
        return orderRepo.findAll().stream()
                .filter(o -> o.getCreatedAt() != null)
                .filter(o -> !o.getCreatedAt().isBefore(from) && !o.getCreatedAt().isAfter(to))
                .toList();
    }

    /** Doanh thu của một dòng sau giảm giá; discountAmount là số tiền giảm của cả dòng. */
    private static BigDecimal netLine(OrderItem item) {
        BigDecimal gross = item.getPrice().multiply(BigDecimal.valueOf(item.getQuantity()));
        BigDecimal discount = item.getDiscountAmount() == null ? BigDecimal.ZERO : item.getDiscountAmount();
        return gross.subtract(discount);
    }

    public ReportDtos.SummaryResponse summary(LocalDateTime from, LocalDateTime to) {
        List<Orders> orders = inRange(from, to);
        List<Orders> active = orders.stream().filter(o -> o.getStatus() != Orders.Status.CANCELLED).toList();
        BigDecimal revenue = active.stream().map(Orders::getTotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        long count = active.size();
        long completed = orders.stream().filter(o -> o.getStatus() == Orders.Status.COMPLETED).count();
        BigDecimal avg = count == 0 ? BigDecimal.ZERO : revenue.divide(BigDecimal.valueOf(count), 2, java.math.RoundingMode.HALF_UP);
        long customers = active.stream().map(o -> o.getUser().getId()).distinct().count();
        BigDecimal promoDiscount = active.stream().map(o -> o.getDiscountTotal() == null ? BigDecimal.ZERO : o.getDiscountTotal())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new ReportDtos.SummaryResponse(revenue, count, completed, avg, customers, promoDiscount);
    }

    public List<ReportDtos.RevenuePoint> revenue(LocalDateTime from, LocalDateTime to) {
        Map<String, BigDecimal> rev = new LinkedHashMap<>();
        Map<String, Long> cnt = new LinkedHashMap<>();
        for (Orders o : inRange(from, to)) {
            if (o.getStatus() == Orders.Status.CANCELLED) continue;
            String d = o.getCreatedAt().toLocalDate().toString();
            rev.merge(d, o.getTotal() == null ? BigDecimal.ZERO : o.getTotal(), BigDecimal::add);
            cnt.merge(d, 1L, Long::sum);
        }
        List<ReportDtos.RevenuePoint> out = new ArrayList<>();
        rev.forEach((d, r) -> out.add(new ReportDtos.RevenuePoint(d, r, cnt.getOrDefault(d, 0L))));
        out.sort(Comparator.comparing(ReportDtos.RevenuePoint::date));
        return out;
    }

    public List<ReportDtos.TopFood> topFoods(LocalDateTime from, LocalDateTime to, int limit) {
        Map<String, Long> qty = new HashMap<>();
        Map<String, BigDecimal> rev = new HashMap<>();
        for (Orders o : inRange(from, to)) {
            if (o.getStatus() == Orders.Status.CANCELLED) continue;
            for (var item : o.getItems()) {
                if (item.getFood() == null) continue;
                String name = item.getFood().getName();
                qty.merge(name, (long) item.getQuantity(), Long::sum);
                rev.merge(name, netLine(item), BigDecimal::add);
            }
        }
        List<ReportDtos.TopFood> out = new ArrayList<>();
        qty.forEach((name, q) -> out.add(new ReportDtos.TopFood(name, q, rev.getOrDefault(name, BigDecimal.ZERO))));
        out.sort((a, b) -> Long.compare(b.quantity(), a.quantity()));
        if (out.size() > limit) return out.subList(0, limit);
        return out;
    }

    public byte[] exportExcel(LocalDateTime from, LocalDateTime to) throws Exception {
        Workbook wb = new XSSFWorkbook();
        // Tổng quan
        Sheet s0 = wb.createSheet("Tong quan");
        ReportDtos.SummaryResponse sm = summary(from, to);
        int r = 0;
        Row row = s0.createRow(r++);
        row.createCell(0).setCellValue("Chi so");
        row.createCell(1).setCellValue("Gia tri");
        addRow(s0, r++, "Doanh thu", sm.revenue().toPlainString());
        addRow(s0, r++, "So don", String.valueOf(sm.orderCount()));
        addRow(s0, r++, "Don hoan thanh", String.valueOf(sm.completedCount()));
        addRow(s0, r++, "Gia tri don TB", sm.avgOrder().toPlainString());
        addRow(s0, r++, "Khach hang", String.valueOf(sm.customerCount()));
        addRow(s0, r++, "Tong giam KM", sm.promotionDiscount().toPlainString());

        // Doanh thu theo ngay
        Sheet s1 = wb.createSheet("Doanh thu");
        Row h1 = s1.createRow(0);
        h1.createCell(0).setCellValue("Ngay");
        h1.createCell(1).setCellValue("Doanh thu");
        h1.createCell(2).setCellValue("So don");
        int i = 1;
        for (ReportDtos.RevenuePoint p : revenue(from, to)) {
            Row rr = s1.createRow(i++);
            rr.createCell(0).setCellValue(p.date());
            rr.createCell(1).setCellValue(p.revenue().doubleValue());
            rr.createCell(2).setCellValue(p.orders());
        }

        // Top mon
        Sheet s2 = wb.createSheet("Top mon");
        Row h2 = s2.createRow(0);
        h2.createCell(0).setCellValue("Mon");
        h2.createCell(1).setCellValue("So luong");
        h2.createCell(2).setCellValue("Doanh thu");
        i = 1;
        for (ReportDtos.TopFood t : topFoods(from, to, 20)) {
            Row rr = s2.createRow(i++);
            rr.createCell(0).setCellValue(t.name());
            rr.createCell(1).setCellValue(t.quantity());
            rr.createCell(2).setCellValue(t.revenue().doubleValue());
        }

        // Don hang
        Sheet s4 = wb.createSheet("Don hang");
        Row h4 = s4.createRow(0);
        String[] headers = {"Ma don", "Ngay", "Trang thai", "Tong tien", "Giam gia", "Khach"};
        for (int k = 0; k < headers.length; k++) h4.createCell(k).setCellValue(headers[k]);
        i = 1;
        for (Orders o : inRange(from, to)) {
            Row rr = s4.createRow(i++);
            rr.createCell(0).setCellValue(o.getId());
            rr.createCell(1).setCellValue(o.getCreatedAt().toString());
            rr.createCell(2).setCellValue(o.getStatus().name());
            rr.createCell(3).setCellValue(o.getTotal().doubleValue());
            rr.createCell(4).setCellValue((o.getDiscountTotal() == null ? BigDecimal.ZERO : o.getDiscountTotal()).doubleValue());
            rr.createCell(5).setCellValue(o.getUser() == null ? "" : o.getUser().getEmail());
        }

        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        wb.write(bos);
        wb.close();
        return bos.toByteArray();
    }

    private void addRow(Sheet sheet, int r, String label, String value) {
        Row row = sheet.createRow(r);
        row.createCell(0).setCellValue(label);
        row.createCell(1).setCellValue(value);
    }
}