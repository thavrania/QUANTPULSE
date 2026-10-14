# QuantPulse Android Mobile Application

The official Android mobile companion app for the **QuantPulse** quantitative volume-crossover trading and options execution terminal.

---

## 📱 Features

1. **20-Day Volume Crossover Radar (Zone C Mobile)**
   - Real-time tracking of 55+ F&O stocks with live progress against 20-Day traded volume averages.
   - Filter chips: `All`, `🔥 Crossed (X)`, `⚡ Near Cross (>80%)`.
   - Bullish BUY (▲) and Bearish Breakdown (▼) indicators with exact execution timestamps.

2. **Tactical Option Next-Action Sheet (Zone D Mobile)**
   - Dynamic ATM Strike selection for Call (CE) and Put (PE).
   - Capital allocation selector chips (`₹25k`, `₹50k`, `₹100k`, `₹200k`).
   - 1-Tap institutional order dispatch to Dhan HQ broker with haptic vibration feedback.
   - Stop-Loss (-15%) & Target (+30%) pre-calculations.

3. **Positions & Trailing Stop-Loss Monitor (Zone E Mobile)**
   - Net Realized & Unrealized P&L banner.
   - Automatic milestone progression:
     - **L1**: Shift Stop-Loss to Break-Even at +10% profit.
     - **L2**: Trail Stop-Loss to +10% at +20% profit.
     - **L3**: Target locked at +30% profit.
   - **🚨 Panic Kill Switch**: Instantly square off all open derivative legs at market price.

4. **Multi-Terminal Workstation Manager & Remote Kill**
   - Live visibility into every desktop PC, laptop, or browser running QuantPulse.
   - **`🔴 Kill Browser`**: One-tap instant termination of any remote browser session.
   - **`🚨 Kill All Other Browsers`**: Terminate all remote sessions while keeping only your phone logged in.

5. **Biometric Security Gate**
   - Android native `BiometricPrompt` (Fingerprint / Face Unlock).
   - Fallback master password (`admin` / `Valo@0033`).

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js (v18+)
- Android Studio (for Android Emulator) or Expo Go on a physical Android phone.

### 2. Installation
```bash
cd mobile
npm install
```

### 3. Running Locally
```bash
npx expo start
```
- Press `a` in the terminal to launch the app on your Android Emulator.
- Or scan the QR code with the **Expo Go** app on your physical Android phone (ensure phone and PC are on the same Wi-Fi network).

### 4. Configuring Backend URL
In `mobile/src/config/apiConfig.ts`:
- **Android Emulator**: Uses `http://10.0.2.2:3000` by default.
- **Physical Phone**: Set `EXPO_PUBLIC_API_URL=http://<YOUR_PC_IP>:3000` (e.g. `http://192.168.1.100:3000`).

---

## 📦 Building a Standalone Android APK

To generate a standalone `.apk` that can be downloaded and installed directly on any Android smartphone:

```bash
# 1. Install EAS CLI globally if not already installed
npm install -g eas-cli

# 2. Login to your Expo account
eas login

# 3. Configure build profile
eas build:configure

# 4. Build standalone APK for testing
eas build -p android --profile preview
```

Upon completion, EAS provides a direct download link and QR code to download the `.apk` straight to your phone.
