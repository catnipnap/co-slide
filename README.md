# Co-Slide PPT (코-슬라이드 PPT)

> **Next-Generation Presentation Canvas for Seamless IDE & AI Agent Co-Creation**  
> *IDE 네이티브 환경에서 AI 에이전트와 실시간으로 함께 빚어내는 차세대 프레젠테이션 에디터*

---

## 🌐 English Overview

### 💡 What is Co-Slide PPT?
**Co-Slide PPT** stands for **Co-creation, Co-pilot, and Co-working with Slides**.  
It is a native custom editor extension crafted specifically for **Visual Studio Code** and **Google Antigravity IDE**.  
Instead of creating slides alone in external software, Co-Slide PPT bridges the visual canvas and code workspace so that **users and AI agents can build presentations together in real time**.

> ⚠️ **Compatibility Notice**: Co-Slide PPT is primarily developed and tested based on the **Google Antigravity IDE** environment.

---

### 🚀 Why We Built Co-Slide PPT (Philosophy)

1. **Native IDE Agent Pairing (No Dedicated Token API Keys Required)**:
   - Operates entirely on open, file-backed data (`*.slide.json`).
   - Instead of charging per-token or requiring separate proprietary API keys, Co-Slide PPT leverages the **AI agent environment you already use in your IDE** (Google Antigravity, GitHub Copilot, Claude Code, or local LLMs). The AI agent directly reads and edits the JSON file in your project, while you design on the visual canvas.

2. **True Bidirectional Synchronization (Human & AI Pair Designing)**:
   - Visual edits on the canvas instantly update the `.slide.json` file.
   - When the AI agent generates or modifies slides in the chat, the visual canvas hot-reloads in real time.

3. **100% Pure PowerPoint (.pptx) Native Export**:
   - Zero vendor lock-in. Exports directly to genuine, editable PowerPoint files (`.pptx`) with real vector shapes, text boxes, and tables.

---

### ✨ Key Features

* **Full HD 16:9 WYSIWYG Canvas Engine**: 1920×1080 design space with crisp vector rendering.
* **Rich Elements**: Textboxes, diverse shapes, and media cards.
* **Precision Table Suite**: Cell-level styling, live resizing, and dynamic row/column management.
* **Smart Guides & Magnetic Snapping**: One-click center crosshairs and magnetic snap for perfect visual balance.
* **Automatic Safety Backup & Version History**:
  - Automatically captures timestamped backups (`<deck>_backup_YYMMDD_HHMMSS_<save|manual|prerestore>.slide.json`, latest 30 kept) on every save (`Ctrl+S`).
  - One-click version rollback via the `📜 History` interface.
* **Native Local Font Integration**: Live font search and instant scanning of local system fonts.

---

### 🛠️ How to Use

1. **Create a Slide Deck**:
   - Create any file ending with `.slide.json` (e.g., `deck.slide.json`). It will immediately launch the custom Co-Slide PPT editor.
   - Or open Command Palette (`Ctrl+Shift+P`) ➔ run `Co-Slide PPT: 새 프레젠테이션 생성`.
2. **Pair with Your AI Agent**:
   - Ask your IDE's AI assistant in chat: *"deck.slide.json에 주요 성과 비교 슬라이드 하나 추가해줘"* — and watch the canvas update live!
3. **Save & Export**:
   - Hit `💾 Save` (`Ctrl+S`) to save and generate automatic revision backups.
   - Click `🚀 PPTX 내보내기` (Export PPTX) to generate ready-to-present PowerPoint decks.

---

### 🤖 Pair AI Designer Skill (Bundled Together)

Co-Slide PPT works best as a **bundle** with its dedicated AI Pair Designer skill!  
To let your AI agent conduct design interviews, plan storylines with `/plan`, and co-edit slides:

👉 **Simply download [`skills/co-slide-ppt/SKILL.md`](skills/co-slide-ppt/SKILL.md) from this repository and register it with your AI agent.**

---

## 🇰🇷 한국어 안내

### 💡 Co-Slide PPT란 무엇인가요?
**Co-Slide PPT(코-슬라이드 PPT)**는 **Co-working(협업), Co-pilot(동반자), Co-creation(공동 창작)**의 가치를 담았습니다.  
VS Code 및 Google Antigravity IDE 내부에서 동작하는 네이티브 커스텀 슬라이드 에디터로, 사용자가 혼자 슬라이드를 만드는 것을 넘어 **IDE 안에서 AI 에이전트와 호흡을 맞추며 프레젠테이션을 함께 빚어내는 공동 창작 환경**을 제공합니다.

> ⚠️ **환경 호환성 안내**: Co-Slide PPT는 **Google Antigravity IDE** 환경을 기준으로 우선 개발 및 테스트되었습니다. 그 외의 환경에서는 아직 충분한 테스트를 거치지 않았으므로 이용에 참고 부탁드립니다.

---

### 🎯 왜 Co-Slide PPT를 만들었을까요? (개발 철학 및 배경)

1. **별도 토큰 API 연동 없이, 사용 중인 IDE 에이전트와 직접 협업**:
   - 순수 파일 기반(`*.slide.json`)의 오픈 네이티브 구조로 동작합니다.
   - 별도의 슬라이드 전용 API 키를 등록하거나 토큰당 비용을 과금하는 방식이 아닌, **사용자가 이미 사용 중인 IDE 환경의 AI 에이전트**(Google Antigravity, GitHub Copilot, 로컬 LLM 등)와 대화하며 작업합니다. 에이전트가 프로젝트 내의 JSON 파일을 직접 읽고 수정하여 슬라이드를 실시간으로 완성합니다.

2. **완벽한 양방향 실시간 동기화 (Human & Agent Pairing)**:
   - 사용자가 시각적 캔버스에서 마우스로 요소를 드래그하고 서식을 바꾸면 `*.slide.json` 파일에 즉시 기록됩니다.
   - 반대로 AI 에이전트가 채팅창 지시를 받아 JSON 구조를 변경하거나 새 슬라이드를 추가하면, 캔버스가 실시간으로 리로드되며 화면에 즉각 반영됩니다.

3. **100% 온전한 파워포인트 (.pptx) 네이티브 출력**:
   - 특정 플랫폼에 종속되지 않습니다. Co-Slide PPT는 단순 화면 캡처 이미지가 아닌, 텍스트 상자·도형·표가 실제 오피스 개체로 살아있는 **순수 파워포인트(`.pptx`) 파일**로 1:1 완벽하게 변환해 드립니다.

---

### ✨ 주요 기능 요약

* **16:9 풀HD (1920×1080) 위지윅 캔버스**: 섬세한 드래그 앤 드롭 및 벡터 렌더링 지원
* **풍부한 개체 컴포넌트**: 텍스트 상자, 다채로운 도형(사각형, 둥근 모서리, 원형, 말풍선, 화살표, 별, 리본 등), 미디어 카드
* **정밀 테이블(표) 엔진**: 셀 단위 글자색/배경색/테두리 서식 설정, 자유로운 크기 조절 및 행/열 추가·삭제
* **스마트 안내선 & 자석 스냅(Snap)**: 정중앙 가로/세로 십자선 토글 및 이동 시 자동 흡착 자석 스냅 지원
* **안전 백업 & 버전 기록 (히스토리)**:
  - 저장(`Ctrl+S` 또는 `💾 저장` 버튼) 시마다 타임스탬프 원본 백업(`<덱이름>_backup_YYMMDD_HHMMSS_<save|manual|prerestore>.slide.json`, 최근 30개 보관) 자동 생성
  - `📜 기록` 버튼을 통해 과거 버전 목록 확인 및 원클릭 복원 지원
* **내 PC 로컬 폰트 원클릭 연동**: 실시간 폰트 검색 및 시스템 로컬 폰트 자동 스캔

---

### 🛠️ 사용 방법

1. **새 슬라이드 생성**:
   - 탐색기에서 `[파일명].slide.json` 파일 생성 (확장자가 `.slide.json`이면 자동으로 Co-Slide 전용 에디터로 열립니다.)
   - 또는 명령 팔레트(`Ctrl+Shift+P`) ➔ `Co-Slide PPT: 새 프레젠테이션 생성` 실행
2. **AI 에이전트와 함께 작업하기**:
   - IDE 채팅창에 *"deck.slide.json에 주요 성과 비교 슬라이드 하나 추가해줘"*라고 입력하면 슬라이드가 실시간으로 생성됩니다!
3. **저장 및 PPTX 출력**:
   - 상단 헤더의 `💾 저장` (`Ctrl+S`)으로 자동 백업과 함께 안전 저장
   - `🚀 PPTX 내보내기` 버튼으로 파워포인트 파일 즉시 생성

---

### 🤖 AI 페어 디자이너 스킬 함께 사용하기 (필수 권장)

Co-Slide PPT는 **시각적 위지윅 에디터(Extension)**와 **전용 AI 페어 디자이너(Skill)**가 한 쌍으로 함께 호흡을 맞추는 **세트(Bundle) 도구**입니다!  

👉 **저장소에 함께 동봉된 공식 스킬 파일 [`skills/co-slide-ppt/SKILL.md`](skills/co-slide-ppt/SKILL.md)를 다운받아서 사용 중인 AI 에이전트에게 등록해 주세요!**

스킬이 등록되면 새 세션에서도 에이전트가 알아서 사전 맥락 인터뷰를 진행하고, `/plan` 모드로 스토리라인을 정밀 설계하며, 실시간 캔버스 편집 파트너로 변신합니다!

---

### 📬 문의 및 지원 (Contact & Support)

질문, 개선 아이디어, 버그 제보 등 언제든지 편하게 연락주세요!  
* 📧 **Email**: [rlgus5126@gmail.com](mailto:rlgus5126@gmail.com)  
* 🐙 **GitHub**: [https://github.com/catnipnap/co-slide-ppt](https://github.com/catnipnap/co-slide-ppt)

---

Developed with ❤️ for Google Antigravity & VS Code

