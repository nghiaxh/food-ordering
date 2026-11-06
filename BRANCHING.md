# Quy ước phân nhánh và commit

## Mô hình

Mô hình đơn giản, chỉ có một nhánh chính. Mọi thay đổi tách từ `main`,
làm việc trên branch riêng, rồi mở PR ngược về `main`.

```
main  ───────────────────────────────────────●  (production, luôn chay duoc)
  │            │           │
  feat/...     fix/...     docs/...           (working branch, tach tu main)
```

Không dùng các tầng trung gian như `dev` hay `draft`.

## Quy tắc

| Branch          | Vai trò                     | Quy tắc                                             |
| --------------- | --------------------------- | --------------------------------------------------- |
| `main`          | Production-ready            | **Không làm việc trực tiếp**, không commit và không push thẳng lên đây |
| `feat/<ten>`    | Tính năng mới               | Tách từ `main`, PR về `main`                        |
| `fix/<ten>`     | Sửa lỗi                     | Tách từ `main`, PR về `main`                        |
| `refactor/<ten>`| Refactor giữ nguyên hành vi | Tách từ `main`, PR về `main`                        |
| `test/<ten>`    | Bổ sung hoặc sửa test       | Tách từ `main`, PR về `main`                        |
| `docs/<ten>`    | Tài liệu                    | Tách từ `main`, PR về `main`                        |

## Workflow

### 1. Đồng bộ `main` rồi tách branch

Luôn `git pull` trước khi tách branch để code up to date.

```bash
git checkout main
git pull origin main
git checkout -b feat/ten-feature
```

### 2. Làm việc và commit

Commit theo **Conventional Commits**: lowercase, dạng mệnh lệnh, không dấu chấm cuối.
Commit message dùng tiếng Anh.

```
feat: add price filter for menu items
fix: prevent negative stock when adding to cart
refactor: split ChatbotService into small steps
test: add unit test for cartStore
docs: update test setup guide
style: align edit button spacing
```

Các type chính: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore`, `revert`.
Commit nhỏ, một commit một mục đích, một commit một loại thay đổi.

### 3. Đẩy lên và tạo PR

```bash
git push -u origin feat/ten-feature
# Tao PR: feat/ten-feature -> main (GitHub UI hoac: gh pr create)
```

Merge PR vào `main` bằng **squash merge** để lịch sử gọn.

## Lưu ý

- Không làm việc trên `main`. Mọi thay đổi bắt đầu từ branch tách từ `main`.
- Luôn `git pull origin main` trước khi tạo branch mới để tránh conflict.
- Không push trực tiếp lên `main`.
