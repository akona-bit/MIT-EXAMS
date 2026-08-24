Triển khai UI (frontend) lên Vercel — Hướng dẫn nhanh

1) Chuẩn bị
   - Đảm bảo repository akona-bit/MIT-EXAMS có thư mục frontend/ chứa mã nguồn UI.
   - Kiểm tra file frontend/package.json có script "build": "tsc -b && vite build" (đã có sẵn).

2) Import project vào Vercel (Git Integration)
   - Vào https://vercel.com → New Project → Import Git Repository → chọn akona-bit/MIT-EXAMS.
   - Trong phần Import, set Root Directory = frontend (nếu Vercel không tự phát hiện).
   - Framework Preset: Vite (hoặc Static Site). Build Command: npm run build. Output Directory: dist.

3) Environment Variables
   - Vercel Dashboard → Project → Settings → Environment Variables:
     - VITE_API_URL = https://api.example.com  (thay bằng URL backend thực tế)
     - RELEASE = v0
   - Đặt scope cho Production / Preview tương ứng.

4) Production branch & Previews
   - Đặt Production Branch = main
   - Bật Preview Deploys (mặc định bật khi dùng Git Integration)

5) Alias / Domain (tuỳ chọn)
   - Nếu có domain, thêm Domain vào Vercel và gán alias v0.<domain> cho deployment production.

6) CLI (tuỳ chọn)
   - Tạo token: vercel token create (trên Vercel dashboard)
   - Local deploy (không cần Git Integration):
     VERCEL_TOKEN="<token>" npx vercel --prod --confirm --env RELEASE=v0

7) Kiểm tra sau deploy
   - Vào phần Deployments trên Vercel, mở URL production, kiểm tra console/network, và xác nhận biến môi trường hoạt động.

Ghi chú
   - Không commit secrets (API keys) vào repository.
   - Nếu backend ở môi trường khác, đảm bảo CORS cho domain vercel.app hoặc cấu hình proxy trên frontend.
