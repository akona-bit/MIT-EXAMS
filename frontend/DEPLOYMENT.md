Triển khai UI (frontend) lên Vercel/v0

1. Kết nối repository
   - Vercel: New Project → Import Git Repository → chọn `akona-bit/MIT-EXAMS`.
   - v0: mở dự án từ GitHub repository này để tiếp tục chỉnh UI, sau đó chọn Deploy.
   - Nếu Vercel hỏi Root Directory, chọn `frontend`. Nếu deploy từ root repository,
     `vercel.json` ở root đã cấu hình build `frontend`.

2. Build settings
   - Framework Preset: Vite.
   - Khi Root Directory = `frontend`: Build Command `npm run build`, Output Directory `dist`.
   - Khi Root Directory là repository: Build Command `npm --prefix frontend run build`,
     Output Directory `frontend/dist`.

3. Environment Variables
   - Vercel Dashboard → Project → Settings → Environment Variables:
     - VITE_API_URL = https://api.example.com (thay bằng URL backend thực tế)
     - RELEASE = v0
   - Đặt scope cho Production / Preview tương ứng.

4. Production branch & Previews
   - Đặt Production Branch = main
   - Bật Preview Deploys (mặc định bật khi dùng Git Integration)

5. Alias / Domain (tuỳ chọn)
   - Nếu có domain, thêm Domain vào Vercel và gán alias v0.<domain> cho deployment production.

6. Kiểm tra local trước khi deploy
   - Từ thư mục repository: `cd frontend` rồi chạy `npm run build`.
   - Chạy dev server: `npm run dev` và mở URL Vite hiển thị trong terminal.

7. CLI (tuỳ chọn)
   - Tạo token: vercel token create (trên Vercel dashboard)
   - Local deploy (không cần Git Integration):
     VERCEL_TOKEN="<token>" npx vercel --prod --confirm --env RELEASE=v0

8. Kiểm tra sau deploy
   - Vào phần Deployments trên Vercel, mở URL production, kiểm tra console/network, và xác nhận biến môi trường hoạt động.

Ghi chú

- Không commit secrets (API keys) vào repository.
- Nếu backend ở môi trường khác, đảm bảo CORS cho domain vercel.app hoặc cấu hình proxy trên frontend.
