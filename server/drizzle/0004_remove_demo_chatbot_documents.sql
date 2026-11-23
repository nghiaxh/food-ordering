-- Xoa 8 tai lieu demo tu seed; seeder khong chay lai khi DB da co user.
DELETE FROM chatbot_knowledge_chunk
WHERE document_id IN (
  SELECT id FROM chatbot_knowledge WHERE title IN (
    'Giờ mở cửa',
    'Địa chỉ quán',
    'Giao hàng và phí ship',
    'Thanh toán',
    'Cách đặt món',
    'Hủy đơn',
    'Dị ứng và thành phần',
    'Giỏ hàng đăng nhập'
  )
);

DELETE FROM chatbot_knowledge
WHERE title IN (
  'Giờ mở cửa',
  'Địa chỉ quán',
  'Giao hàng và phí ship',
  'Thanh toán',
  'Cách đặt món',
  'Hủy đơn',
  'Dị ứng và thành phần',
  'Giỏ hàng đăng nhập'
);
