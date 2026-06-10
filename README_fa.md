<div align="center">
  <img src="logo/logo.png" alt="Homa Logo" width="128" height="128">
  <h1>هما (Homa)</h1>
  <h3>🚀 کلاینت پیشرفته V2Ray برای مرورگر</h3>
  <p>
    <b>Powered by <a href="https://t.me/foxfig">Foxfig</a></b>
  </p>
  <p>
    <a href="LICENSE">
      <img src="https://img.shields.io/badge/License-GPLv3-blue.svg" alt="License: GPL v3">
    </a>
    <img src="https://img.shields.io/badge/build-passing-brightgreen" alt="Build Status">
    <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platform">
  </p>
  <p>
    <b><a href="README.md">English Version</a> | نسخه فارسی</b>
  </p>
</div>

---

### ✨ معرفی
**هما (Homa)** چیزی فراتر از یک اکستنشن معمولی است؛ این ابزار، قدرت کامل V2Ray را مستقیماً به مرورگر شما می‌آورد. برخلاف سایر راهکارها که نیازمند اجرای نرم‌افزارهای جداگانه هستند، **هما** با استفاده از یک **Native Messaging Bridge** اختصاصی، هسته‌ی Xray را به‌صورت هوشمند و در پس‌زمینه مدیریت می‌کند. نتیجه؟ اتصالی فوق‌العاده پایدار، سریع و بدون دردسر!

> **💡 نکته:** هما در حال حاضر **تنها راهکار جهانی** است که امکان اجرای واقعی و بومی (Native) کانفیگ‌های V2Ray را مستقیماً در مرورگر فراهم می‌کند.

### 🌟 ویژگی‌های کلیدی
*   **📦 اینستالر هوشمند:** نصب و راه‌اندازی با یک کلیک. بدون درگیری با تنظیمات پیچیده.
*   **🌐 همه‌فن‌حریف:** سازگاری کامل با تمام مرورگرهای محبوب (Chrome, Edge, Brave, Firefox, Vivaldi).
*   **⚡️ هسته قدرتمند Xray:** پشتیبانی کامل از پروتکل‌های مدرن (VLESS, VMess, Trojan, Shadowsocks).
*   **🚀 سرعت نور:** ارتباط مستقیم و بهینه (Native) بین مرورگر و هسته برای کمترین پینگ ممکن.

---

### 📥 راهنمای نصب و راه‌اندازی سریع

برای پیوستن به دنیای هما، تنها دو قدم ساده پیش رو دارید:

#### 1️⃣ گام اول: نصب افزونه (رابط کاربری)

شما می‌توانید افزونه را به دو روش نصب کنید. **روش اول (استور)** برای اکثر کاربران پیشنهاد می‌شود، اما اگر لینک‌ها هنوز فعال نیستند، از **روش دوم (دستی)** استفاده کنید.

**روش اول: نصب آسان (از فروشگاه مرورگر)**
*   این روش پیشنهاد می‌شود اما تا زمان انتشار رسمی، **غیرفعال است**.
*   Chrome / Edge / Brave: [لینک به زودی...]
*   Firefox: [نصب هما برای فایرفاکس](https://addons.mozilla.org/en-US/firefox/addon/homa/)

**روش دوم: نصب دستی (پیش‌نمایش / مخصوص توسعه‌دهندگان)**

<details>
<summary><b>🔵 نصب در Chrome / Brave / Edge</b></summary>
<br>

1. فایل `extension-chrome.zip` را از بخش **[Releases](https://github.com/Fox-Fig/Homa/releases)** دانلود کنید.
2. فایل را از حالت فشرده خارج کنید (Unzip).
3. در مرورگر خود به آدرس `chrome://extensions/` بروید.
4. دکمه **Developer mode** را در بالای صفحه (سمت راست) فعال کنید.
5. روی دکمه **Load unpacked** کلیک کنید و پوشه اکسترکت شده را انتخاب نمایید.
</details>

<details>
<summary><b>🟠 نصب در Firefox</b></summary>
<br>

1. فایل `extension-firefox.zip` را از بخش **[Releases](https://github.com/Fox-Fig/Homa/releases)** دانلود کنید.
2. فایل را از حالت فشرده خارج کنید.
3. در نوار آدرس مرورگر، عبارت `about:debugging#/runtime/this-firefox` را تایپ کنید و اینتر بزنید.
4. روی دکمه **Load Temporary Add-on...** کلیک کنید و فایل `manifest.json` که داخل پوشه اکسترکت شده است را انتخاب کنید.
</details>

#### 2️⃣ (مهم) گام دوم: نصب برنامه میزبان (Host)
این "پل ارتباطی" برای عملکرد هما **ضروری** است. بدون این برنامه، افزونه کار نخواهد کرد.

برای نصب خودکار و آسان، فقط کافیست دستور زیر را کپی کرده و در ترمینال سیستم خود اجرا کنید:

*   **🪟 ویندوز (Windows):**
    برنامه PowerShell را باز کرده و دستور زیر را وارد کنید:
    ```powershell
    irm https://raw.githubusercontent.com/Fox-Fig/Homa/main/install.ps1 | iex
    ```

*   **🍎 مک (macOS) و 🐧 لینوکس (Linux):**
    برنامه Terminal را باز کرده و دستور زیر را وارد کنید:
    ```bash
    curl -fsSL https://raw.githubusercontent.com/Fox-Fig/Homa/main/install.sh | bash
    ```

🎉 **تمام شد!** اینستالر به‌صورت خودکار اجرا شده و مراحل نصب را انجام می‌دهد. حالا می‌توانید روی آیکون هما در مرورگر کلیک کنید و متصل شوید.

---

### 🛠️ برای توسعه‌دهندگان
اگر دوست دارید در توسعه هما مشارکت کنید، قدمتان روی چشم!

۱. **دریافت مخزن:**
   ```bash
   git clone https://github.com/Fox-Fig/Homa.git
   cd homa
   go mod tidy
   ```

۲. **بیلد کردن پروژه:**
   با توجه به سیستم‌عامل خود، دستور مناسب را اجرا کنید:

   - **ویندوز:**
     ```powershell
     build_installers.bat
     ```
   - **لینوکس / مک:**
     ```bash
     chmod +x build_installers.sh
     ./build_installers.sh
     ```

### 🤝 مشارکت و همکاری
ما در FoxFig همیشه پذیرای ایده‌های نو و کمک‌های شما هستیم.
*   **چالش فنی:** ما همچنان مشتاق پورت کردن هسته Xray به **WebAssembly (WASM)** هستیم. اگر در این زمینه تخصص دارید، کمک شما می‌تواند انقلابی باشد!
*   **پیشنهادات:** اگر قابلیتی را خالی می‌بینید، حتما با ما در میان بگذارید.

### ⚡ تشکر و قدردانی
این پروژه از هسته قدرتمند **[Xray-core](https://github.com/XTLS/Xray-core)** استفاده می‌کند.

### 📄 لایسنس
این پروژه تحت مجوز آزاد **GPLv3** منتشر شده است.

---
<div align="center">
  <p>ساخته شده با ❤️ برای آزادی در <a href="https://t.me/foxfig">FoxFig</a></p>
</div>
