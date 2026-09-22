# Quy ước phân nhánh và commit

## Mô hình

```
main  ───────────────────────────────────────●  (production, chỉ merge từ dev khi release)
  │                                          │
dev  ───────────────────●────────●───────────●  (integration, mọi feature nhập vào đây)
  │                    │        │
  feat/tim-kiem-món    │        │             (feature branch)
  fix/cart             │
  ...
```

## Trạng thái hiện tại (scaffolding)

| Branch | Vai trò | Trạng thái |
| ------ | ------- | ----------- |
| `main` | Production-ready | Chứa commit scaffolding ban đầu |
| `dev` | Integration | Vừa tạo, **chưa có thay đổi nào** |
| `draft` | Working scaffold | Chạy tự do, dự kiến **triển khai chi tiết sau** |

> Tạm thời chỉ có `dev` đứng yên. Khi bắt đầu làm tính năng thật, dùng `main` →
> `dev` → `feat/*` như mô hình bên dưới, còn `draft` dùng để nhồi code to rồi tách commit sau.

## Quy tắc

| Branch          | Vai trò                     | Quy tắc                                                         |
| --------------- | --------------------------- | --------------------------------------------------------------- |
| `main`          | Production-ready            | **Không commit trực tiếp** ngoài scaffolding ban đầu. Chỉ nhận merge từ `dev` khi release |
| `dev`           | Integration                 | Branch phát triển chính, mọi feature/fix gộp về đây qua PR       |
| `draft`         | Working scaffold            | Tự do, dùng để triển khai chi tiết sau, có thể rebase/cherry-pick vào `dev` |
| `feat/<ten>`    | Tính năng mới               | Nhánh ra từ `dev`, merge vào `dev`                              |
| `fix/<ten>`     | Sửa lỗi                     | Nhánh ra từ `dev`, merge vào `dev`                              |
| `refactor/<ten>`| Refactor giữ nguyên hành vi | Nhánh ra từ `dev`                                               |
| `docs/<ten>`    | Tài liệu                    | Nhánh ra từ `dev`                                               |

## Workflow

### 1. Tạo feature branch từ dev

```bash
git checkout dev
git pull
git checkout -b feat/ten-feature
```

### 2. Làm việc và commit

Commit theo **Conventional Commits**: lowercase, dạng mệnh lệnh, không dấu chấm cuối.
Commit message có thể dùng tiếng Anh hoặc tiếng Việt.

```
feat: them bo loc gia mon an
fix: xu ly loi vuot ton kho khi them gio
refactor: tach ChatbotService thanh cac buoc nho
test: them unit test cho cartStore
docs: cap nhat huong dan chay test
style: can chinh khoang cach nut chinh sua
```

Các type chính: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `build`, `ci`, `chore`, `revert`.
Commit nhỏ, một commit một mục đích.

### 3. Đẩy lên và tạo PR

```bash
git push -u origin feat/ten-feature
# Tạo PR: feat/ten-feature → dev (GitHub UI hoặc: gh pr create)
```

Merge PR vào `dev` bằng **squash merge** để lịch sử dev gọn. PR đang làm dở đánh dấu _draft_.

### 4. Release

```bash
# Sau khi dev ổn định:
# Tạo PR: dev → main, merge khi test (client + server + e2e) đều xanh.
```

## Lưu ý

- Không push trực tiếp lên `main` (ngoài commit scaffolding ban đầu).
- Luôn `git pull` nhánh `dev` trước khi tạo branch mới để tránh conflict.
- Không nhầm lẫn: cấu trúc nhánh là `dev → feat/ten-feature`, không tách branch trực tiếp từ `main`.