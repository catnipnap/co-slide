# Co-Slide (코-슬라이드)

> **Next-Generation Presentation Canvas for Seamless IDE & AI Agent Co-Creation**  
> *IDE 네이티브 환경에서 AI 에이전트와 실시간으로 함께 빚어내는 차세대 프레젠테이션 에디터*

---

## 🌐 English Overview

### 💡 What is Co-Slide? (Meaning & Identity)
**Co-Slide** stands for **Co-creation, Co-pilot, and Co-working with Slides**.  
It is a native custom editor extension crafted specifically for **Visual Studio Code** and **Google Antigravity IDE**.  
Instead of creating slides alone in external software, Co-Slide bridges the visual canvas and code workspace so that **users and AI agents can build presentations together in real time**.

> ⚠️ **Compatibility Notice**: Co-Slide is primarily developed and tested based on the **Google Antigravity IDE** environment. Operation and compatibility in other IDE environments (e.g., standard VS Code, VSCodium, Cursor) have not been extensively tested yet.

---

### 🚀 Why We Built Co-Slide (Philosophy & Motivation)

1. **Native IDE Agent Pairing (No Dedicated Token API Keys Required)**:
   - Traditional AI presentation tools require external API keys (OpenAI, Anthropic, etc.) with per-token billing or force you onto separate web platforms.
   - **Co-Slide adopts an IDE-native workflow**: It operates entirely on open, file-backed data (`*.slide.json`).
   - You don't need to connect separate presentation API keys or pay per-slide token charges. Instead, Co-Slide leverages the **AI agent environment you already use in your IDE** (Google Antigravity, GitHub Copilot, Claude Code, or local LLMs). The AI agent directly reads and edits the JSON file in your project, while you design on the visual canvas.

2. **True Bidirectional Synchronization (Human & AI Pair Designing)**:
   - When a user moves, resizes, or formats elements on the visual WYSIWYG canvas, the underlying `.slide.json` file updates instantly.
   - When the AI agent generates or modifies slides via natural language in the IDE chat, the visual canvas hot-reloads in real time.
   - Auto-generated canvas captures allow AI agents to visually inspect their design output just like a human pair-designer.

3. **100% Pure PowerPoint (.pptx) Native Export**:
   - Zero vendor lock-in. Co-Slide exports directly to genuine, editable PowerPoint files (`.pptx`) with real vector shapes, text boxes, and tables — never flat image snapshots.

---

### ✨ Key Features

* **Full HD 16:9 WYSIWYG Canvas Engine**: 1920×1080 design space with crisp vector rendering.
* **Rich Elements**: Textboxes, diverse shapes (rectangles, rounded boxes, circles, triangles, arrows, speech bubbles, stars, ribbons), and media cards.
* **Precision Table Suite**: Cell-level styling (font colors, background fills, borders), live resizing, and dynamic row/column management.
* **Smart Guides & Magnetic Snapping**: One-click center crosshairs and magnetic snap for perfect visual balance.
* **Automatic Safety Backup & Version History**:
  - Automatically captures timestamped backups (`_backup_YYMMDD_HHMM.slide.json`) on every save (`Ctrl+S`).
  - One-click version rollback via the `📜 History` interface.
* **Native Local Font Integration**: Live font search and instant scanning of local system fonts.

---

### 🛠️ How to Use

1. **Create a Slide Deck**:
   - Create any file ending with `.slide.json` (e.g., `deck.slide.json`). It will immediately launch the custom Co-Slide editor.
   - Or open Command Palette (`Ctrl+Shift+P`) ➔ run `Slide Studio: 새 프레젠테이션 생성` (Create New Presentation).
2. **Pair with Your AI Agent**:
   - Ask your IDE's AI assistant in chat: *"Add an executive summary slide to deck.slide.json"* — and watch the canvas update live!
3. **Save & Export**:
   - Hit `💾 Save` (`Ctrl+S`) to save and generate automatic revision backups.
   - Click `🚀 PPTX 내보내기` (Export PPTX) to generate ready-to-present PowerPoint decks.

---

### 📬 Contact & Support
Have questions, bug reports, or suggestions? Feel free to reach out!  
📧 **Email**: [rlgus5126@gmail.com](mailto:rlgus5126@gmail.com)  
🐙 **GitHub**: [https://github.com/kkihyeon/co-slide](https://github.com/kkihyeon/co-slide)

---

## 🇰🇷 한국어 안내

### 💡 Co-Slide란 무엇인가요?
**Co-Slide(코-슬라이드)**는 **Co-working(협업), Co-pilot(동반자), Co-creation(공동 창작)**의 의미를 담아 탄생했습니다.  
VS Code 및 Google Antigravity IDE 내부에서 동작하는 네이티브 커스텀 슬라이드 에디터로, 사용자가 혼자 슬라이드를 만드는 것을 넘어 **IDE 안에서 AI 에이전트와 호흡을 맞추며 프레젠테이션을 함께 빚어내는 공동 창작 환경**을 제공합니다.

> ⚠️ **환경 호환성 안내**: Co-Slide는 **Google Antigravity IDE** 환경을 기준으로 우선 개발 및 테스트되었습니다. 그 외의 환경(일반 VS Code, VSCodium, Cursor 등)에서는 아직 충분한 테스트를 거치지 않았으므로 이용에 참고 부탁드립니다.

---

### 🎯 왜 Co-Slide를 만들었을까요? (개발 철학 및 배경)

1. **별도 토큰 API 연동 없이, 사용 중인 IDE 에이전트와 직접 협업**:
   - 기존의 많은 AI 슬라이드 툴들은 별도의 API 키(OpenAI 등)를 발급받아 토큰 사용료를 건당 지불해야 하거나, 외부 웹 플랫폼으로 이동해야 하는 번거로움이 있었습니다.
   - **Co-Slide는 방식이 다릅니다**: 순수 파일 기반(`*.slide.json`)의 오픈 네이티브 구조로 동작합니다.
   - 별도의 슬라이드 전용 API 키를 등록하거나 추가 토큰을 과금할 필요 없이, **사용자가 이미 구독하고 사용 중인 IDE 환경의 AI 에이전트**(Google Antigravity, GitHub Copilot, 또는 로컬 LLM 등)와 평소 코딩하듯 대화하며 작업합니다. 에이전트가 프로젝트 내의 JSON 파일을 직접 읽고 수정하여 슬라이드를 실시간으로 완성합니다.

2. **완벽한 양방향 실시간 동기화 (Human & Agent Pairing)**:
   - 사용자가 시각적 캔버스에서 마우스로 요소를 드래그하고 서식을 바꾸면 `*.slide.json` 파일에 즉시 기록됩니다.
   - 반대로 AI 에이전트가 채팅창 지시를 받아 JSON 구조를 변경하거나 새 슬라이드를 추가하면, 캔버스가 실시간으로 리로드되며 화면에 즉각 반영됩니다.
   - 저장 시점마다 캔버스 뷰포트 캡처가 자동 생성되어 AI 에이전트가 자신이 만든 디자인 결과물을 시각적으로 직접 확인하고 정밀하게 다듬을 수 있습니다.

3. **100% 온전한 파워포인트 (.pptx) 네이티브 출력**:
   - 특정 플랫폼에 종속되지 않습니다. Co-Slide는 단순 화면 캡처 이미지가 아닌, 텍스트 상자·도형·표가 실제 오피스 개체로 살아있는 **순수 파워포인트(`.pptx`) 파일**로 1:1 완벽하게 변환해 드립니다.

---

### ✨ 주요 기능 요약

* **16:9 풀HD (1920×1080) 위지윅 캔버스**: 섬세한 드래그 앤 드롭 및 벡터 렌더링 지원
* **풍부한 개체 컴포넌트**: 텍스트 상자, 다채로운 도형(사각형, 둥근 모서리, 원형, 말풍선, 화살표, 별, 리본 등), 미디어 카드
* **정밀 테이블(표) 엔진**: 셀 단위 글자색/배경색/테두리 서식 설정, 자유로운 크기 조절 및 행/열 추가·삭제
* **스마트 안내선 & 자석 스냅(Snap)**: 정중앙 가로/세로 십자선 토글 및 이동 시 자동 흡착 자석 스냅 지원
* **안전 백업 & 버전 기록 (히스토리)**:
  - 저장(`Ctrl+S` 또는 `💾 저장` 버튼) 시마다 타임스탬프 원본 백업(`_backup_YYMMDD_HHMM.slide.json`) 자동 생성
  - `📜 기록` 버튼을 통해 과거 버전 목록 확인 및 원클릭 복원 지원
* **내 PC 로컬 폰트 원클릭 연동**: 실시간 폰트 검색 및 시스템 로컬 폰트 자동 스캔

---

### 🛠️ 사용 방법

1. **새 슬라이드 생성**:
   - 탐색기에서 `[파일명].slide.json` 파일 생성 (확장자가 `.slide.json`이면 자동으로 Co-Slide 전용 에디터로 열립니다.)
   - 또는 명령 팔레트(`Ctrl+Shift+P`) ➔ `Slide Studio: 새 프레젠테이션 생성` 실행
2. **AI 에이전트와 함께 작업하기**:
   - IDE 채팅창에 *"deck.slide.json에 주요 성과 비교 슬라이드 하나 추가해줘"*라고 입력하면 슬라이드가 실시간으로 생성됩니다!
3. **저장 및 PPTX 출력**:
   - 상단 헤더의 `💾 저장` (`Ctrl+S`)으로 자동 백업과 함께 안전 저장
   - `🚀 PPTX 내보내기` 버튼으로 파워포인트 파일 즉시 생성

---

### 📬 문의 및 피드백 (Contact & Support)
질문, 개선 아이디어, 버그 제보 등 언제든지 편하게 연락주세요!  
📧 **Email**: [rlgus5126@gmail.com](mailto:rlgus5126@gmail.com)  
🐙 **GitHub**: [https://github.com/kkihyeon/co-slide](https://github.com/kkihyeon/co-slide)

---

Developed with ❤️ for Google Antigravity & VS Code
