/**
 * Antigravity Slide Studio - Core Canvas & Editor Controller (v1.5)
 */

(function () {
  const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;

  // 기본 슬라이드 데이터 모델
  let deckData = {
    version: "1.0",
    title: "2025 AI 융합 수업 기획안",
    theme: { primary: "#2563EB", secondary: "#64748B", background: "#F8FAFC" },
    slides: [
      {
        id: "slide-1",
        title: "표지 슬라이드",
        background: "#0F172A",
        elements: [
          {
            id: "el-1",
            type: "text",
            text: "2025 AI 융합 수업 기획안",
            left: 200,
            top: 340,
            width: 1520,
            fontSize: 64,
            fontWeight: "bold",
            fill: "#FFFFFF",
            align: "center",
            fontFamily: "맑은 고딕"
          }
        ]
      }
    ]
  };

  let currentSlideIndex = 0;
  let canvas = null;
  let canvasScale = 0.55;
  const CANVAS_WIDTH = 1920;
  const CANVAS_HEIGHT = 1080;
  // 파워포인트 표준 포인트(pt) 단위 일원화 (16:9 10인치 기준 1pt = 192/72 = 2.6667px)
  const PX_PER_PT = 192 / 72;
  const PT_PER_PX = 72 / 192;
  let clipboard = null;
  let pendingDeckData = null;
  let recentColors = ['#FFFFFF', '#000000', '#2563EB', '#0D9488', '#EF4444'];
  let activeColorTarget = 'text';

  // 실행 취소(Undo) / 다시 실행(Redo) 히스토리 스택
  let undoStack = [];
  let redoStack = [];
  const MAX_HISTORY = 30;
  let isHistoryProcessing = false;

  function recordHistory() {
    if (isHistoryProcessing || !deckData.slides[currentSlideIndex]) return;
    const currentSlide = deckData.slides[currentSlideIndex];
    const snapshot = JSON.stringify({
      background: currentSlide.background || '#FFFFFF',
      elements: currentSlide.elements || []
    });
    if (undoStack.length > 0 && undoStack[undoStack.length - 1] === snapshot) return;
    undoStack.push(snapshot);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    const btnUndo = document.getElementById('btnUndo');
    const btnRedo = document.getElementById('btnRedo');
    if (btnUndo) btnUndo.disabled = (undoStack.length <= 1);
    if (btnRedo) btnRedo.disabled = (redoStack.length === 0);
  }

  window.undo = function () {
    if (undoStack.length <= 1) {
      showToast('더 이상 실행 취소할 작업이 없습니다.');
      return;
    }
    isHistoryProcessing = true;
    const current = undoStack.pop();
    redoStack.push(current);
    const prev = JSON.parse(undoStack[undoStack.length - 1]);
    
    const targetSlide = deckData.slides[currentSlideIndex];
    if (targetSlide) {
      if (prev.elements !== undefined) {
        targetSlide.elements = prev.elements;
        targetSlide.background = prev.background || '#FFFFFF';
      } else {
        targetSlide.elements = prev;
      }
      loadSlide(currentSlideIndex, false);
      notifySlideModified();
    }
    isHistoryProcessing = false;
    updateUndoRedoButtons();
    showToast('실행 취소 (Ctrl+Z)');
  };

  window.redo = function () {
    if (redoStack.length === 0) {
      showToast('더 이상 다시 실행할 작업이 없습니다.');
      return;
    }
    isHistoryProcessing = true;
    const next = JSON.parse(redoStack.pop());
    undoStack.push(JSON.stringify(next));

    const targetSlide = deckData.slides[currentSlideIndex];
    if (targetSlide) {
      if (next.elements !== undefined) {
        targetSlide.elements = next.elements;
        targetSlide.background = next.background || '#FFFFFF';
      } else {
        targetSlide.elements = next;
      }
      loadSlide(currentSlideIndex, false);
      notifySlideModified();
    }
    isHistoryProcessing = false;
    updateUndoRedoButtons();
    showToast('다시 실행 (Ctrl+Y)');
  };

  // 한글 친숙 명칭 매핑 테이블
  const FONT_KO_MAP = {
    'nanumgothic': '나눔고딕',
    'nanum gothic': '나눔고딕',
    'nanumgothiccoding': '나눔고딕코딩',
    'nanummyeongjo': '나눔명조',
    'nanum myeongjo': '나눔명조',
    'nanumsquare': '나눔스퀘어',
    'nanum square': '나눔스퀘어',
    'nanumsquareround': '나눔스퀘어 라운드',
    'nanum square round': '나눔스퀘어 라운드',
    'nanumsquare_ac': '나눔스퀘어',
    'nanumbarungothic': '나눔바른고딕',
    'nanumbarunpen': '나눔바른펜',
    'nanum brush script': '나눔손글씨 붓',
    'nanum pen script': '나눔손글씨 펜',
    'malgun gothic': '맑은 고딕',
    'malgungothic': '맑은 고딕',
    'batang': '바탕',
    'batangche': '바탕체',
    'gungsuh': '궁서',
    'gungsuhche': '궁서체',
    'gulim': '굴림',
    'gulimche': '굴림체',
    'dotum': '돋움',
    'dotumche': '돋움체',
    'headline': '헤드라인',
    'headlinea': '헤드라인',
    'noto sans kr': '본고딕 (Noto Sans KR)',
    'noto serif kr': '본명조 (Noto Serif KR)',
    'pretendard': 'Pretendard (프리텐다드)',
    'pretendard variable': 'Pretendard (프리텐다드)',
    'gmarket sans': 'Gmarket Sans (지마켓 산스)',
    'gmarketsans': 'Gmarket Sans (지마켓 산스)',
    'gmarketsansmedium': 'Gmarket Sans (지마켓 산스)',
    's-core dream': '에스코어 드림',
    's-coredream': '에스코어 드림',
    'bm jua': '배달의민족 주아',
    'bmjua': '배달의민족 주아',
    'bm hanna': '배달의민족 한나',
    'bmhanna': '배달의민족 한나',
    'kopubdotum': 'KoPub돋움',
    'kopubworlddotum': 'KoPub돋움',
    'kopubmyeongjo': 'KoPub명조',
    'kopubworldmyeongjo': 'KoPub명조',
    'tmoney roundwind': '티머니 둥근바람',
    'chosunilbo_myungjo': '조선일보명조'
  };

  function getFontDisplayLabel(fontName) {
    if (!fontName) return '';
    const key = fontName.toLowerCase().trim();
    if (FONT_KO_MAP[key]) {
      return `${FONT_KO_MAP[key]} (${fontName})`;
    }
    return fontName;
  }

  // 스캔 전(또는 스캔에 실패했을 때) 기본으로 제공하는 폰트. 기본값은 맑은 고딕이다.
  const BASE_FONTS = ['맑은 고딕', '궁서체', '바탕체', '굴림체', 'Arial', 'Noto Sans'];
  let allAvailableFonts = BASE_FONTS.slice();

  // 브라우저 환경에서 F5 새로고침 시 초기화 방지를 위한 실시간 자동 저장 키
  const STORAGE_KEY = 'slideStudio_deckData_autosave';

  // 텍스트 상자 자체의 사각형 외곽 테두리(Shape Border) 렌더링 지원
  // Fabric.js 기본 Textbox는 stroke를 글자 획 테두리로 그리므로, 박스 외곽선 전용 boxStroke / boxStrokeWidth 구현
  const origTextboxRenderBackground = fabric.Textbox.prototype._renderBackground;
  fabric.Textbox.prototype._renderBackground = function (ctx) {
    if (origTextboxRenderBackground) {
      origTextboxRenderBackground.call(this, ctx);
    } else if (this.backgroundColor) {
      const dim = this._getNonTransformedDimensions ? this._getNonTransformedDimensions() : { x: this.width, y: this.height };
      ctx.fillStyle = this.backgroundColor;
      ctx.fillRect(-dim.x / 2, -dim.y / 2, dim.x, dim.y);
    }

    if (this.boxStroke && this.boxStroke !== 'transparent' && (this.boxStrokeWidth || 0) > 0) {
      const dim = this._getNonTransformedDimensions ? this._getNonTransformedDimensions() : { x: this.width, y: this.height };
      ctx.save();
      ctx.strokeStyle = this.boxStroke;
      ctx.lineWidth = this.boxStrokeWidth;
      // 텍스트 상자 네모 박스 외곽에 정확히 테두리 그리기
      ctx.strokeRect(-dim.x / 2, -dim.y / 2, dim.x, dim.y);
      ctx.restore();
    }
  };

  // ================= 1. 캔버스 초기화 =================
  function initCanvas() {
    canvas = new fabric.Canvas('slideCanvas', {
      width: CANVAS_WIDTH * canvasScale,
      height: CANVAS_HEIGHT * canvasScale,
      backgroundColor: '#FFFFFF',
      preserveObjectStacking: true,
      selectionColor: 'rgba(59, 130, 246, 0.2)',
      selectionBorderColor: '#3B82F6',
      selectionLineWidth: 1,
      uniformScaling: false,
      fireRightClick: true,
      stopContextMenu: true
    });
    window.canvas = canvas;

    fabric.Object.prototype.transparentCorners = false;
    fabric.Object.prototype.cornerColor = '#3B82F6';
    fabric.Object.prototype.cornerStyle = 'circle';
    fabric.Object.prototype.cornerSize = 10;
    fabric.Object.prototype.borderColor = '#3B82F6';
    fabric.Object.prototype.strokeUniform = true; // 스트로크 두께가 객체 바운딩 박스/너비에 누적 합산되지 않도록 원천 고정!

    setupCanvasEvents();
    setupKeyboardShortcuts();
    setupContextMenu();
    setupSidebarResizer();
    setupColorPopovers();
    setupCtrlWheelZoom();
    populateFontSelect(allAvailableFonts);
    const fontSearch = document.getElementById('fontSearchInput');
    if (fontSearch) {
      fontSearch.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        const select = document.getElementById('fontFamilySelect');
        if (select && select.value) window.changeFontFamily(select.value);
      });
    }

    if (pendingDeckData) {
      deckData = pendingDeckData;
      pendingDeckData = null;
    } else if (!vscode) {
      // 브라우저 단독 실행(preview.html)에서만 F5 새로고침 대비 localStorage 복원을 사용한다.
      // VS Code에서는 파일이 원본이며, localStorage는 모든 덱이 공유하므로 다른 덱이 섞일 수 있다.
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
            deckData = parsed;
          }
        }
      } catch (err) {
        console.warn('localStorage autosave 복원 오류:', err);
      }
    }

    const titleInput = document.getElementById('projectTitleInput');
    if (titleInput && deckData.title) {
      titleInput.value = deckData.title;
    }

    loadSlide(0);
    adjustZoomFit();
    generateAllThumbnails();

    // 페이지 언로드 전 최종 상태 저장
    window.addEventListener('beforeunload', function () {
      if (vscode) return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanDeckData(deckData)));
      } catch (e) {}
    });
  }

  // ================= 2. Ctrl + 마우스 휠 줌 (브라우저 기본 줌 원천 차단 및 에디터 줌) =================
  function setupCtrlWheelZoom() {
    window.addEventListener('wheel', function (e) {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); // 브라우저 전체 확대/축소 원천 방지
        if (e.deltaY < 0) {
          window.zoomIn();
        } else {
          window.zoomOut();
        }
      }
    }, { passive: false });
  }

  // ================= 3. 폰트 검색 및 한글 명칭 스캔 =================
  function populateFontSelect(fontList) {
    const select = document.getElementById('fontFamilySelect');
    if (!select) return;
    const currentVal = select.value || '맑은 고딕';
    select.innerHTML = '';

    fontList.forEach(font => {
      const family = typeof font === 'string' ? font : font.family;
      const label = getFontDisplayLabel(family);
      const opt = document.createElement('option');
      opt.value = family;
      opt.textContent = label;
      select.appendChild(opt);
    });

    if (fontList.includes(currentVal)) {
      select.value = currentVal;
    }
  }

  // 선택한 개체의 폰트가 목록에 없어도(PC에 없거나 에이전트가 지정한 폰트) 드롭다운에 표시되도록 항목을 추가한다
  function setFontSelectValue(font) {
    const select = document.getElementById('fontFamilySelect');
    if (!select) return;
    if (!Array.from(select.options).some(o => o.value === font)) {
      const opt = document.createElement('option');
      opt.value = font;
      opt.textContent = getFontDisplayLabel(font);
      select.insertBefore(opt, select.firstChild);
    }
    select.value = font;
  }

  window.filterFontList = function (keyword) {
    keyword = (keyword || '').trim().toLowerCase();
    if (!keyword) {
      populateFontSelect(allAvailableFonts);
      return;
    }
    const filtered = allAvailableFonts.filter(f => {
      const family = typeof f === 'string' ? f : f.family;
      const label = getFontDisplayLabel(family);
      return family.toLowerCase().includes(keyword) || label.toLowerCase().includes(keyword);
    });
    populateFontSelect(filtered);
    // 검색 중에는 선택 개체의 글꼴을 바꾸지 않는다. Enter 또는 드롭다운 선택으로 확정한다.
    if (filtered.length > 0) {
      const select = document.getElementById('fontFamilySelect');
      if (select) select.selectedIndex = 0;
    }
  };

  function handleScannedFonts(fontNames) {
    if (!Array.isArray(fontNames) || fontNames.length === 0) return;
    const set = new Set();
    fontNames.forEach(f => {
      const name = typeof f === 'string' ? f.trim() : (f && f.family ? f.family.trim() : '');
      if (!name || name.startsWith('@')) return;
      set.add(name);
    });
    allAvailableFonts = Array.from(set).sort((a, b) => {
      const aHasKo = !!FONT_KO_MAP[a.toLowerCase()] || /[가-힣]/.test(a);
      const bHasKo = !!FONT_KO_MAP[b.toLowerCase()] || /[가-힣]/.test(b);
      if (aHasKo && !bHasKo) return -1;
      if (!aHasKo && bHasKo) return 1;
      return a.localeCompare(b);
    });
    populateFontSelect(allAvailableFonts);

    // 스캔 버튼 및 검색창에 가시적인 피드백 즉시 제공
    const scanBtn = document.getElementById('btnScanFonts');
    if (scanBtn) {
      scanBtn.innerHTML = `✓ 폰트 ${allAvailableFonts.length}개`;
      scanBtn.style.color = '#38BDF8';
      scanBtn.style.borderColor = '#38BDF8';
    }
    const searchInput = document.getElementById('fontSearchInput');
    if (searchInput) {
      searchInput.placeholder = `폰트 ${allAvailableFonts.length}개 검색...`;
    }
  }

  // 스캔에 실패하면 가짜 목록으로 채우지 않고, 기본 폰트(BASE_FONTS)를 유지한 채 원인을 알린다
  function reportFontScanFailure(reason) {
    populateFontSelect(allAvailableFonts);
    showToast(`폰트 스캔 실패: ${reason}`, 7000);
  }

  let fontScanTimer = null;
  let fontScanIsManual = false;

  function requestSystemFonts(manual) {
    fontScanIsManual = !!manual;
    if (fontScanTimer) clearTimeout(fontScanTimer);
    vscode.postMessage({ type: 'scanSystemFonts' });
    // 확장 호스트가 이전 버전이면(.vsix 설치 후 창을 다시 로드하지 않은 경우) 이 메시지를 처리하지 못해 응답이 오지 않는다
    fontScanTimer = setTimeout(() => {
      fontScanTimer = null;
      reportFontScanFailure('확장 호스트가 응답하지 않습니다. 확장을 새로 설치했다면 Ctrl+Shift+P → "Developer: Reload Window"로 창을 다시 로드하세요.');
    }, 4000);
  }

  window.scanLocalFonts = async function () {
    showToast('내 PC에 설치된 폰트를 스캔하고 있습니다...', 2000);
    if (vscode) {
      requestSystemFonts(true);
      return;
    }
    // 브라우저 단독 실행(preview.html) 환경: Local Font Access API 사용
    if ('queryLocalFonts' in window) {
      try {
        const availableFonts = await window.queryLocalFonts();
        handleScannedFonts(availableFonts.map(f => f.family));
        showToast(`시스템에서 ${allAvailableFonts.length}개의 폰트를 성공적으로 불러왔습니다!`, 3500);
      } catch (err) {
        reportFontScanFailure('폰트 접근 권한이 허용되지 않았습니다.');
      }
    } else {
      reportFontScanFailure('이 브라우저는 폰트 목록 조회를 지원하지 않습니다.');
    }
  };

  // ================= 4. 캔버스 이벤트 & Shift 축 고정 & 표 인터랙션 =================
  function setupCanvasEvents() {
    let moveStartPos = null;
    let tableHoverSplit = null;
    let tableResizeSession = null;
    let tableResizeGuideLine = null;
    let isTableResizingSplit = false;

    canvas.on('mouse:move', function (opt) {
      if (tableResizeSession) {
        const pointer = canvas.getPointer(opt.e);
        const t = tableResizeSession.table;
        if (!tableResizeGuideLine) {
          tableResizeGuideLine = new fabric.Line([0, 0, 0, 0], {
            stroke: '#38BDF8',
            strokeWidth: 2,
            strokeDashArray: [4, 4],
            selectable: false,
            evented: false
          });
          canvas.add(tableResizeGuideLine);
        }

        const sx = (tableResizeSession.orient === 'v') ? (t.scaleX || 1) : (t.scaleY || 1);
        const rawD = (tableResizeSession.orient === 'v'
          ? (pointer.x - tableResizeSession.startPointer.x)
          : (pointer.y - tableResizeSession.startPointer.y)) / sx;

        if (tableResizeSession.isSub) {
          // 서브셀 내부 분할선 조절: 해당 셀 크기 범위 내로 이동량 clamp
          const maxD = tableResizeSession.maxD || Infinity;
          const minD = tableResizeSession.minD || -Infinity;
          const d = Math.max(minD, Math.min(maxD, rawD));
          tableResizeSession.pendingD = d;

          if (tableResizeSession.orient === 'v') {
            const gx = t.left + (tableResizeSession.pos + d) * (t.scaleX || 1);
            tableResizeGuideLine.set({
              x1: gx, y1: t.top + tableResizeSession.cellTop * (t.scaleY || 1),
              x2: gx, y2: t.top + (tableResizeSession.cellTop + tableResizeSession.cellH) * (t.scaleY || 1)
            });
          } else {
            const gy = t.top + (tableResizeSession.pos + d) * (t.scaleY || 1);
            tableResizeGuideLine.set({
              x1: t.left + tableResizeSession.cellLeft * (t.scaleX || 1), y1: gy,
              x2: t.left + (tableResizeSession.cellLeft + tableResizeSession.cellW) * (t.scaleX || 1), y2: gy
            });
          }
        } else {
          const drag = tableResizeSession.drag;
          const d = tblResolveLineDrag(drag, rawD);
          tableResizeSession.pendingD = d;

          // 가이드선은 "함께 움직이는 테두리 구간"에만 표시 (끊어진 테두리면 해당 셀 구간만)
          if (tableResizeSession.orient === 'v') {
            const gx = t.left + (drag.pos + d) * (t.scaleX || 1);
            tableResizeGuideLine.set({
              x1: gx, y1: t.top + drag.lo * (t.scaleY || 1),
              x2: gx, y2: t.top + drag.hi * (t.scaleY || 1)
            });
          } else {
            const gy = t.top + (drag.pos + d) * (t.scaleY || 1);
            tableResizeGuideLine.set({
              x1: t.left + drag.lo * (t.scaleX || 1), y1: gy,
              x2: t.left + drag.hi * (t.scaleX || 1), y2: gy
            });
          }
        }
        tableResizeGuideLine.bringToFront();
        canvas.requestRenderAll();
        return;
      }

      // 표 테두리에 마우스 접근 시 col-resize, row-resize 화살표 커서 전환
      const target = canvas.getActiveObject() || opt.target;
      if (target && target.isTable && target.colWidths && target.rowHeights) {
        const pointer = canvas.getPointer(opt.e);
        const sxx = target.scaleX || 1;
        const syy = target.scaleY || 1;
        const relX = (pointer.x - target.left) / sxx;
        const relY = (pointer.y - target.top) / syy;
        const tol = 6 / Math.min(sxx, syy);

        // 1. 셀 내부 독립 분할선(cellSplits) 우선 검사!
        if (target.cellSplits && Object.keys(target.cellSplits).length > 0) {
          const cols = target.tableCols || 3;
          const rows = target.tableRows || 3;
          const colX = [0];
          for (let c = 0; c < cols; c++) colX.push(colX[c] + target.colWidths[c]);
          const rowY = [0];
          for (let r = 0; r < rows; r++) rowY.push(rowY[r] + target.rowHeights[r]);

          let subHit = null;
          for (const cellKey of Object.keys(target.cellSplits)) {
            const sp = target.cellSplits[cellKey];
            if (!sp || ((sp.rows || 1) <= 1 && (sp.cols || 1) <= 1)) continue;
            const [mr, mc] = cellKey.split('_').map(Number);
            const mInfo = getMergeInfo(target.merges, mr, mc);
            const rowspan = mInfo ? (mInfo.merge.rowspan || 1) : 1;
            const colspan = mInfo ? (mInfo.merge.colspan || 1) : 1;

            const cellLeft = colX[mc];
            const cellTop = rowY[mr];
            const cellW = colX[mc + colspan] - colX[mc];
            const cellH = rowY[mr + rowspan] - rowY[mr];

            if (relX < cellLeft - tol || relX > cellLeft + cellW + tol || relY < cellTop - tol || relY > cellTop + cellH + tol) {
              continue;
            }

            const sR = sp.rows || 1;
            const sC = sp.cols || 1;
            const rr = (sp.rowRatios && sp.rowRatios.length === sR) ? sp.rowRatios : Array(sR).fill(1 / sR);
            const cr = (sp.colRatios && sp.colRatios.length === sC) ? sp.colRatios : Array(sC).fill(1 / sC);

            // 가로 분할선 검사
            let curY = cellTop;
            for (let i = 0; i < sR - 1; i++) {
              curY += cellH * rr[i];
              if (Math.abs(relY - curY) <= tol && relX >= cellLeft - 1 && relX <= cellLeft + cellW + 1) {
                const minH = 15;
                const minD = -(cellH * rr[i] - minH);
                const maxD = (cellH * rr[i + 1] - minH);
                subHit = {
                  isSub: true, type: 'sub_row', orient: 'h', table: target, cellKey: cellKey,
                  lineIdx: i, cellLeft: cellLeft, cellTop: cellTop, cellW: cellW, cellH: cellH,
                  pos: curY, minD: minD, maxD: maxD
                };
                break;
              }
            }
            if (subHit) break;

            // 세로 분할선 검사
            let curX = cellLeft;
            for (let j = 0; j < sC - 1; j++) {
              curX += cellW * cr[j];
              if (Math.abs(relX - curX) <= tol && relY >= cellTop - 1 && relY <= cellTop + cellH + 1) {
                const minW = 20;
                const minD = -(cellW * cr[j] - minW);
                const maxD = (cellW * cr[j + 1] - minW);
                subHit = {
                  isSub: true, type: 'sub_col', orient: 'v', table: target, cellKey: cellKey,
                  lineIdx: j, cellLeft: cellLeft, cellTop: cellTop, cellW: cellW, cellH: cellH,
                  pos: curX, minD: minD, maxD: maxD
                };
                break;
              }
            }
            if (subHit) break;
          }

          if (subHit) {
            const cur = subHit.orient === 'v' ? 'col-resize' : 'row-resize';
            canvas.defaultCursor = cur;
            canvas.setCursor(cur);
            tableHoverSplit = subHit;
            return;
          }
        }

        // 2. 표 전체 메인 격자선 검사
        const hit = tblFindLineAt(tblModelFromObj(target), relX, relY, tol);
        if (hit) {
          const cur = hit.orient === 'v' ? 'col-resize' : 'row-resize';
          canvas.defaultCursor = cur;
          canvas.setCursor(cur);
          tableHoverSplit = { isSub: false, table: target, orient: hit.orient, pos: hit.pos, along: hit.along };
          return;
        }
      }

      if (tableHoverSplit) {
        tableHoverSplit = null;
        canvas.defaultCursor = 'default';
        canvas.setCursor('default');
      }
    });

    canvas.on('mouse:down', function (opt) {
      if (opt.button === 3 || (opt.e && opt.e.button === 2)) {
        if (opt.target) {
          canvas.setActiveObject(opt.target);
          if (opt.target.isTable) {
            const pointer = canvas.getPointer(opt.e);
            const rawCell = getTableCellFromPointer(opt.target, pointer);
            let cell = rawCell;
            let cellKey = rawCell.key || `${rawCell.r}_${rawCell.c}`;
            const coverKeys = [];

            if (rawCell.isSubCell) {
              coverKeys.push(cellKey);
            } else {
              const mInfo = getMergeInfo(opt.target.merges, rawCell.r, rawCell.c);
              cell = mInfo ? { r: mInfo.merge.r, c: mInfo.merge.c, key: `${mInfo.merge.r}_${mInfo.merge.c}`, isSubCell: false } : rawCell;
              cellKey = `${cell.r}_${cell.c}`;
              if (mInfo) {
                for (let mr = mInfo.merge.r; mr < mInfo.merge.r + (mInfo.merge.rowspan || 1); mr++) {
                  for (let mc = mInfo.merge.c; mc < mInfo.merge.c + (mInfo.merge.colspan || 1); mc++) {
                    coverKeys.push(`${mr}_${mc}`);
                  }
                }
              } else {
                coverKeys.push(cellKey);
              }
            }

            const curSel = opt.target.selectedCells || [];
            // 현재 우클릭한 셀이 기존 다중 선택 영역에 포함되어 있지 않은 경우에만 단독 선택으로 전환
            if (!curSel.includes(cellKey)) {
              opt.target.selectedCells = coverKeys;
              opt.target.selectedCell = cell;
              opt.target.anchorCell = cell;
              updateTableHighlights(opt.target);
              updateInspector(opt.target);
            }
          }
          canvas.renderAll();
        } else {
          // 빈 슬라이드 배경 우클릭 시 선택 해제하여 슬라이드 전용 메뉴가 표시되도록 보장
          canvas.discardActiveObject();
          canvas.renderAll();
        }
        showContextMenu(opt.e.clientX, opt.e.clientY);
        return;
      }
      hideContextMenu();
      hideAllColorPopovers();

      // 경계선 위에서 마우스 누르면 테두리 이동 드래그 시작 (정확히 테두리 8px 이내일 때만 진입)
      if (tableHoverSplit && tableHoverSplit.table) {
        const pointer = canvas.getPointer(opt.e);
        const t = tableHoverSplit.table;
        const sxx = t.scaleX || 1;
        const syy = t.scaleY || 1;
        const relX = (pointer.x - t.left) / sxx;
        const relY = (pointer.y - t.top) / syy;
        const hitTol = 8 / Math.min(sxx, syy);

        let isActualBorderHit = false;
        if (tableHoverSplit.orient === 'v') {
          isActualBorderHit = Math.abs(relX - tableHoverSplit.pos) <= hitTol;
        } else {
          isActualBorderHit = Math.abs(relY - tableHoverSplit.pos) <= hitTol;
        }

        if (isActualBorderHit) {
          if (tableHoverSplit.isSub) {
            tableResizeSession = {
              isSub: true,
              table: t,
              orient: tableHoverSplit.orient,
              type: tableHoverSplit.type,
              cellKey: tableHoverSplit.cellKey,
              lineIdx: tableHoverSplit.lineIdx,
              cellLeft: tableHoverSplit.cellLeft,
              cellTop: tableHoverSplit.cellTop,
              cellW: tableHoverSplit.cellW,
              cellH: tableHoverSplit.cellH,
              pos: tableHoverSplit.pos,
              minD: tableHoverSplit.minD,
              maxD: tableHoverSplit.maxD,
              startPointer: pointer,
              pendingD: 0
            };
            t.lockMovementX = true;
            t.lockMovementY = true;
            return;
          } else {
            const drag = tblPrepareLineDrag(tblModelFromObj(t), tableHoverSplit.orient, tableHoverSplit.pos, tableHoverSplit.along);
            if (drag) {
              tableResizeSession = {
                isSub: false,
                table: t,
                orient: tableHoverSplit.orient,
                drag: drag,
                startPointer: pointer,
                pendingD: 0
              };
              t.lockMovementX = true;
              t.lockMovementY = true;
              return;
            }
          }
        } else {
          tableHoverSplit = null;
        }
      }

      const tableObj = (opt.target && opt.target.isTable)
        ? opt.target
        : (canvas.getActiveObject() && canvas.getActiveObject().isTable ? canvas.getActiveObject() : null);

      if (opt.target) {
        moveStartPos = { left: opt.target.left, top: opt.target.top };
      }

      if (tableObj) {
        const pointer = canvas.getPointer(opt.e);
        const rawCell = getTableCellFromPointer(tableObj, pointer);
        let cell = rawCell;
        let cellKey = rawCell.key || `${rawCell.r}_${rawCell.c}`;
        const cellCoverKeys = [];

        if (rawCell.isSubCell) {
          cellCoverKeys.push(cellKey);
        } else {
          const mInfo = getMergeInfo(tableObj.merges, rawCell.r, rawCell.c);
          cell = mInfo ? { r: mInfo.merge.r, c: mInfo.merge.c, key: `${mInfo.merge.r}_${mInfo.merge.c}`, isSubCell: false } : rawCell;
          cellKey = `${cell.r}_${cell.c}`;
          if (mInfo) {
            for (let mr = mInfo.merge.r; mr < mInfo.merge.r + (mInfo.merge.rowspan || 1); mr++) {
              for (let mc = mInfo.merge.c; mc < mInfo.merge.c + (mInfo.merge.colspan || 1); mc++) {
                cellCoverKeys.push(`${mr}_${mc}`);
              }
            }
          } else {
            cellCoverKeys.push(cellKey);
          }
        }

        // 표 셀 다중 선택: Shift 누르고 클릭 시 기준 셀(anchor)과 현재 셀 사이의 사각형 영역 전체 선택
        // Ctrl 누르고 클릭 시 개별 토글, 일반 클릭 시 단일/병합 셀 선택
        const isShift = opt.e && opt.e.shiftKey;
        const isCtrl = opt.e && (opt.e.ctrlKey || opt.e.metaKey);

        if (isShift) {
          const anchor = tableObj.anchorCell || tableObj.selectedCell || cell;
          let minR = Math.min(anchor.r, cell.r);
          let maxR = Math.max(anchor.r, cell.r);
          let minC = Math.min(anchor.c, cell.c);
          let maxC = Math.max(anchor.c, cell.c);

          // 선택 사각형에 걸쳐 있는 모든 기존 병합 셀들을 탐색하여,
          // 하나라도 선택 영역에 걸치면 해당 병합 셀 전체를 감싸도록 범위를 계속 확장 (시각적 하이라이트와 실제 선택 일치 보장)
          const merges = tableObj.merges || [];
          let expanded = true;
          while (expanded) {
            expanded = false;
            for (let i = 0; i < merges.length; i++) {
              const m = merges[i];
              const mMinR = m.r;
              const mMaxR = m.r + (m.rowspan || 1) - 1;
              const mMinC = m.c;
              const mMaxC = m.c + (m.colspan || 1) - 1;

              const hasOverlap = !(mMaxR < minR || mMinR > maxR || mMaxC < minC || mMinC > maxC);
              if (hasOverlap) {
                if (mMinR < minR) { minR = mMinR; expanded = true; }
                if (mMaxR > maxR) { maxR = mMaxR; expanded = true; }
                if (mMinC < minC) { minC = mMinC; expanded = true; }
                if (mMaxC > maxC) { maxC = mMaxC; expanded = true; }
              }
            }
          }

          const rangeKeys = [];
          for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
              rangeKeys.push(`${r}_${c}`);
            }
          }
          tableObj.selectedCells = rangeKeys;
        } else if (isCtrl) {
          if (!tableObj.selectedCells) tableObj.selectedCells = [];
          const isAlreadySelected = cellCoverKeys.some(k => tableObj.selectedCells.includes(k));
          if (isAlreadySelected) {
            if (tableObj.selectedCells.length > cellCoverKeys.length) {
              tableObj.selectedCells = tableObj.selectedCells.filter(k => !cellCoverKeys.includes(k));
            }
          } else {
            cellCoverKeys.forEach(k => {
              if (!tableObj.selectedCells.includes(k)) tableObj.selectedCells.push(k);
            });
          }
          tableObj.anchorCell = cell;
        } else {
          tableObj.selectedCells = [...cellCoverKeys];
          tableObj.anchorCell = cell;
        }
        tableObj.selectedCell = cell;

        // 하이라이트 상태 즉시 갱신 및 화면 즉시 렌더링
        updateTableHighlights(tableObj);
        updateInspector(tableObj);
        canvas.requestRenderAll();
        canvas.renderAll();
      }
    });

    canvas.on('mouse:up', function () {
      if (tableResizeGuideLine) {
        canvas.remove(tableResizeGuideLine);
        tableResizeGuideLine = null;
      }

      if (tableResizeSession) {
        const t = tableResizeSession.table;
        t.lockMovementX = false;
        t.lockMovementY = false;

        const d = tableResizeSession.pendingD || 0;

        if (tableResizeSession.isSub) {
          if (Math.abs(d) >= 0.5 && t.cellSplits && t.cellSplits[tableResizeSession.cellKey]) {
            const sp = t.cellSplits[tableResizeSession.cellKey];
            const lineIdx = tableResizeSession.lineIdx;
            if (tableResizeSession.type === 'sub_row') {
              const sR = sp.rows || 1;
              const rr = (sp.rowRatios && sp.rowRatios.length === sR) ? [...sp.rowRatios] : Array(sR).fill(1 / sR);
              const deltaRatio = d / tableResizeSession.cellH;
              const minRatio = 15 / tableResizeSession.cellH;
              const totalPair = rr[lineIdx] + rr[lineIdx + 1];
              let newR0 = rr[lineIdx] + deltaRatio;
              let newR1 = rr[lineIdx + 1] - deltaRatio;
              if (newR0 < minRatio) { newR0 = minRatio; newR1 = totalPair - minRatio; }
              if (newR1 < minRatio) { newR1 = minRatio; newR0 = totalPair - minRatio; }
              rr[lineIdx] = newR0;
              rr[lineIdx + 1] = newR1;
              sp.rowRatios = rr;
            } else if (tableResizeSession.type === 'sub_col') {
              const sC = sp.cols || 1;
              const cr = (sp.colRatios && sp.colRatios.length === sC) ? [...sp.colRatios] : Array(sC).fill(1 / sC);
              const deltaRatio = d / tableResizeSession.cellW;
              const minRatio = 20 / tableResizeSession.cellW;
              const totalPair = cr[lineIdx] + cr[lineIdx + 1];
              let newC0 = cr[lineIdx] + deltaRatio;
              let newC1 = cr[lineIdx + 1] - deltaRatio;
              if (newC0 < minRatio) { newC0 = minRatio; newC1 = totalPair - minRatio; }
              if (newC1 < minRatio) { newC1 = minRatio; newC0 = totalPair - minRatio; }
              cr[lineIdx] = newC0;
              cr[lineIdx + 1] = newC1;
              sp.colRatios = cr;
            }
            isTableResizingSplit = true;
            rebuildTableGroup(t);
            setTimeout(() => { isTableResizingSplit = false; }, 150);
            saveCurrentSlideState();
            recordHistory();
            showToast('셀 내부 분할 크기가 조절되었습니다.');
          }
          tableResizeSession = null;
          tableHoverSplit = null;
          return;
        }

        // 일반 표 외곽/일직선 테두리 조절 완료 처리
        const result = Math.abs(d) >= 0.01
          ? tblApplyLineDrag(tableResizeSession.drag, d, t.selectedCells || [])
          : null;
        tableResizeSession = null;
        tableHoverSplit = null;

        if (result) {
          applyTableModelResult(t, result);
          isTableResizingSplit = true;
          rebuildTableGroup(t);
          setTimeout(() => { isTableResizingSplit = false; }, 150);
          saveCurrentSlideState();
          recordHistory();
          showToast('표의 테두리가 조절되었습니다.');
        }
      }
    });

    // 표 더블클릭 시 인라인 텍스트 편집기 오픈
    canvas.on('mouse:dblclick', function (opt) {
      const target = opt.target;
      if (target && target.isTable) {
        const pointer = canvas.getPointer(opt.e);
        const cell = getTableCellFromPointer(target, pointer);
        target.selectedCell = cell;
        openTableCellEditor(target, cell);
      }
    });

    canvas.on('object:moving', function (opt) {
      const e = opt.e;
      const target = opt.target;
      if (e && e.shiftKey && moveStartPos) {
        const dx = Math.abs(target.left - moveStartPos.left);
        const dy = Math.abs(target.top - moveStartPos.top);
        if (dx > dy) {
          target.top = moveStartPos.top;
        } else {
          target.left = moveStartPos.left;
        }
      } else if (showGuidelines && target && !target.isGuideline) {
        // 안내선 활성화 시 슬라이드 중앙(X: 960, Y: 540) 근처 접근 시 자석 스냅 지원
        const centerX = CANVAS_WIDTH / 2; // 960
        const centerY = CANVAS_HEIGHT / 2; // 540
        const targetW = target.getScaledWidth ? target.getScaledWidth() : (target.width * (target.scaleX || 1));
        const targetH = target.getScaledHeight ? target.getScaledHeight() : (target.height * (target.scaleY || 1));
        const targetCenterX = target.left + targetW / 2;
        const targetCenterY = target.top + targetH / 2;
        const SNAP_DIST = 14;

        // 개체 중심이 세로 중앙선(960)에 스냅
        if (Math.abs(targetCenterX - centerX) < SNAP_DIST) {
          target.left = centerX - targetW / 2;
        }
        // 개체 중심이 가로 중앙선(540)에 스냅
        if (Math.abs(targetCenterY - centerY) < SNAP_DIST) {
          target.top = centerY - targetH / 2;
        }
      }
      updateInspector();
      updateSlideOverflowGuides();
    });

    canvas.on('object:scaling', function (opt) {
      const target = opt.target;
      if (target && target.type === 'textbox') {
        const newWidth = Math.max(50, target.width * target.scaleX);
        target.set({
          width: newWidth,
          scaleX: 1,
          scaleY: 1
        });
      } else if (target && target.isTable) {
        // 표 크기 조절 시 내부 글자가 찌그러지지 않도록 역스케일 실시간 보정
        const sX = target.scaleX || 1;
        const sY = target.scaleY || 1;
        if (target.getObjects) {
          target.getObjects().forEach(child => {
            if (child.type === 'text') {
              child.set({
                scaleX: 1 / sX,
                scaleY: 1 / sY
              });
            }
          });
        }
      }
      updateInspector();
      updateSlideOverflowGuides();
    });

    canvas.on('selection:created', onObjectSelected);
    canvas.on('selection:updated', onObjectSelected);
    canvas.on('selection:cleared', onObjectCleared);

    // 변환(회전 등) 시작 시 원래 중심점을 기억하여 위치 튐 원천 방지
    canvas.on('before:transform', function (opt) {
      const transform = opt ? opt.transform : null;
      const target = transform ? transform.target : canvas.getActiveObject();
      if (target) {
        target._rotationCenter = target.getCenterPoint();
      }
    });

    // 회전 시 Shift를 누르면 45도 단위 자석 스냅 (0, 45, 90, 135, 180, 225, 270, 315도) - 중심점 완벽 고정
    canvas.on('object:rotating', function (opt) {
      const target = opt ? opt.target : canvas.getActiveObject();
      if (!target) return;

      if (!target._rotationCenter) {
        target._rotationCenter = target.getCenterPoint();
      }
      const center = target._rotationCenter;

      const isShift = opt.e && opt.e.shiftKey;
      if (isShift) {
        const snap = 45;
        const curAngle = target.angle || 0;
        const normalized = ((curAngle % 360) + 360) % 360;
        const snapped = Math.round(normalized / snap) * snap;
        target.angle = snapped % 360;
      }

      // 회전 중에는 어떤 경우에도 객체 중심점이 1px도 벗어나지 않도록 제자리 고정!
      target.setPositionByOrigin(center, 'center', 'center');
      target.setCoords();
      updateInspector();
      updateSlideOverflowGuides();
    });

    canvas.on('object:modified', function (opt) {
      const target = opt ? opt.target : canvas.getActiveObject();
      if (target) target._rotationCenter = null;
      if (isTableResizingSplit) return;
      if (target && target.isTable) {
        // 표 모서리 핸들 드래그(스케일 변경) 시에만 각 colWidths, rowHeights 동기화 및 rebuild
        const sX = target.scaleX || 1;
        const sY = target.scaleY || 1;
        if (sX !== 1 || sY !== 1) {
          if (target.colWidths && sX !== 1) {
            target.colWidths = target.colWidths.map(w => Math.max(30, Math.round(w * sX)));
          }
          if (target.rowHeights && sY !== 1) {
            target.rowHeights = target.rowHeights.map(h => Math.max(20, Math.round(h * sY)));
          }
          target.width = target.colWidths ? target.colWidths.reduce((a, b) => a + b, 0) : Math.max(120, target.width * sX);
          target.height = target.rowHeights ? target.rowHeights.reduce((a, b) => a + b, 0) : Math.max(60, target.height * sY);
          target.scaleX = 1;
          target.scaleY = 1;
          rebuildTableGroup(target);
        }
      }
      saveCurrentSlideState();
      updateSlideOverflowGuides();
    });

    setupAutoFit();
  }

  // ================= 5. 줌 컨트롤 (+, - 버튼) =================
  // 맞춤 모드: true인 동안 패널 크기(개요 바 조절, 탭 확대, 탐색기 닫기 등)가 바뀌면 자동으로 다시 맞춘다.
  // 사용자가 +/-/Ctrl+휠로 직접 줌하면 해제되고, '맞춤' 버튼을 누르면 다시 켜진다.
  let autoFit = true;
  let fitFrame = null;
  const FIT_PADDING = 24; // 슬라이드 주변 여백(px). editor.css의 .canvas-paper-wrapper padding과 같아야 한다.

  window.zoomIn = function () {
    autoFit = false;
    canvasScale = Math.min(2.5, Math.round((canvasScale + 0.05) * 100) / 100);
    applyCanvasZoom();
  };

  window.zoomOut = function () {
    autoFit = false;
    canvasScale = Math.max(0.15, Math.round((canvasScale - 0.05) * 100) / 100);
    applyCanvasZoom();
  };

  function computeFitScale() {
    const container = document.getElementById('canvasOuter');
    if (!container) return null;
    const scaleX = (container.clientWidth - FIT_PADDING * 2) / CANVAS_WIDTH;
    const scaleY = (container.clientHeight - FIT_PADDING * 2) / CANVAS_HEIGHT;
    const fit = Math.min(scaleX, scaleY);
    if (!(fit > 0)) return null; // 탭이 숨겨졌거나 크기가 0일 때는 무시
    // 내림 처리해야 반올림 오차로 스크롤바가 생기지 않는다
    return Math.max(0.15, Math.min(2.5, Math.floor(fit * 1000) / 1000));
  }

  window.adjustZoomFit = function () {
    autoFit = true;
    if (!canvas) return;
    const fit = computeFitScale();
    if (fit === null) return;
    canvasScale = fit;
    applyCanvasZoom();
  };

  function setupAutoFit() {
    const container = document.getElementById('canvasOuter');
    const refit = () => {
      if (!autoFit || !canvas) return;
      if (fitFrame) cancelAnimationFrame(fitFrame);
      fitFrame = requestAnimationFrame(() => {
        fitFrame = null;
        const fit = computeFitScale();
        if (fit !== null && fit !== canvasScale) {
          canvasScale = fit;
          applyCanvasZoom();
        }
      });
    };
    if (container && typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(refit).observe(container);
    } else {
      window.addEventListener('resize', refit);
    }
  }

  function applyCanvasZoom() {
    if (!canvas) return;
    canvas.setWidth(CANVAS_WIDTH * canvasScale);
    canvas.setHeight(CANVAS_HEIGHT * canvasScale);
    canvas.setZoom(canvasScale);
    canvas.renderAll();

    const zoomIndicator = document.getElementById('zoomVal');
    if (zoomIndicator) {
      zoomIndicator.textContent = Math.round(canvasScale * 100) + '%';
    }
    updateSlideOverflowGuides();
  }

  // ================= 6. 좌측 개요 바 크기 조절 =================
  function setupSidebarResizer() {
    const resizer = document.getElementById('navResizer');
    const leftNav = document.getElementById('leftNav');
    if (!resizer || !leftNav) return;

    let isResizing = false;

    resizer.addEventListener('mousedown', function (e) {
      isResizing = true;
      resizer.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      e.preventDefault();
    });

    window.addEventListener('mousemove', function (e) {
      if (!isResizing) return;
      const newWidth = Math.max(100, Math.min(450, e.clientX));
      leftNav.style.width = newWidth + 'px';
    });

    window.addEventListener('mouseup', function () {
      if (isResizing) {
        isResizing = false;
        resizer.classList.remove('resizing');
        document.body.style.cursor = 'default';
      }
    });
  }

  // ================= 7. 단축키 및 통합 전체 선택 =================
  window.handleSelectAll = function () {
    const obj = canvas ? canvas.getActiveObject() : null;
    if (obj && obj.isTable) {
      window.selectAllTableCells();
    } else {
      window.selectAllSlideObjects();
    }
  };

  window.selectAllSlideObjects = function () {
    if (!canvas) return;
    const objs = canvas.getObjects().filter(o => o.selectable !== false && !o.isGuideline);
    if (!objs || objs.length === 0) {
      showToast('슬라이드에 선택할 개체가 없습니다.');
      return;
    }
    canvas.discardActiveObject();
    const sel = new fabric.ActiveSelection(objs, { canvas: canvas });
    canvas.setActiveObject(sel);
    canvas.requestRenderAll();
    updateInspector(sel);
    showToast(`슬라이드의 모든 개체(${objs.length}개)를 선택했습니다 (Ctrl+A)`);
  };

  // 하위 호환
  window.selectAllObjects = window.selectAllSlideObjects;

  // ================= 7-1. 슬라이드 중앙선(안내선) 토글 및 렌더링 =================
  let showGuidelines = false;

  window.toggleGuideline = function (show) {
    showGuidelines = (show !== undefined) ? !!show : !showGuidelines;
    const chk = document.getElementById('chkGuideline');
    if (chk) chk.checked = showGuidelines;
    updateGuidelines();
    showToast(showGuidelines ? '중앙 안내선(가로·세로)이 표시됩니다.' : '중앙 안내선이 숨겨졌습니다.');
  };

  function updateGuidelines() {
    if (!canvas) return;
    // 기존 가이드라인 안전하게 제거
    const existing = canvas.getObjects().filter(o => o.isGuideline);
    existing.forEach(o => canvas.remove(o));

    if (showGuidelines) {
      // 세로 중앙선 (X: 960)
      const vGuide = new fabric.Line([CANVAS_WIDTH / 2, 0, CANVAS_WIDTH / 2, CANVAS_HEIGHT], {
        stroke: '#0EA5E9',
        strokeWidth: 1.5,
        strokeDashArray: [6, 6],
        selectable: false,
        evented: false,
        excludeFromExport: true,
        isGuideline: true,
        opacity: 0.85
      });

      // 가로 중앙선 (Y: 540)
      const hGuide = new fabric.Line([0, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT / 2], {
        stroke: '#0EA5E9',
        strokeWidth: 1.5,
        strokeDashArray: [6, 6],
        selectable: false,
        evented: false,
        excludeFromExport: true,
        isGuideline: true,
        opacity: 0.85
      });

      canvas.add(vGuide);
      canvas.add(hGuide);
      vGuide.bringToFront();
      hGuide.bringToFront();
    }
    canvas.requestRenderAll();
  }

  // ================= 7-2. 저장(Ctrl+S), 버전 기록(히스토리) & 백업 시스템 =================
  const STORAGE_BACKUPS_KEY = 'slideStudio_deckData_backups';

  function formatDateTime(d) {
    const pad = n => String(n).padStart(2, '0');
    const y = d.getFullYear();
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${y}.${m}.${day} ${hh}:${mm}:${ss}`;
  }

  function formatBackupFilename(title, d) {
    const pad = n => String(n).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    const m = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const safeTitle = (title || 'presentation').replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
    return `${safeTitle}_backup_${yy}${m}${day}_${hh}${mm}.slide.json`;
  }

  function getBackupsList() {
    try {
      const raw = localStorage.getItem(STORAGE_BACKUPS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  }

  function saveBackupsList(list) {
    try {
      localStorage.setItem(STORAGE_BACKUPS_KEY, JSON.stringify(list.slice(0, 30)));
    } catch (e) {
      console.warn('백업 목록 저장 실패:', e);
    }
  }

  const BACKUP_KIND_LABELS = { save: '저장 (Ctrl+S)', manual: '수동 백업', prerestore: '복원 직전 자동 백업' };

  // kind: 'save' | 'manual' | 'prerestore'
  // VS Code에서는 호스트가 .slide-src/backups/ 에 파일로 저장·관리한다 (localStorage 용량 제한 회피).
  // 브라우저 단독 실행(preview.html)에서만 localStorage를 사용한다.
  function recordBackup(kind = 'save') {
    if (!deckData || !deckData.slides) return null;
    if (vscode) {
      vscode.postMessage({ type: 'createBackupFile', kind: kind, deck: cleanDeckData(deckData) });
      return null;
    }
    const now = new Date();
    const backupItem = {
      id: `bk-${Date.now()}`,
      timestamp: now.toISOString(),
      dateStr: formatDateTime(now),
      fileName: formatBackupFilename(deckData.title, now),
      title: deckData.title || 'Presentation',
      slidesCount: deckData.slides.length,
      kind: kind,
      data: cleanDeckData(deckData)
    };
    const list = getBackupsList();
    list.unshift(backupItem);
    saveBackupsList(list);
    return backupItem;
  }

  // 캔버스를 지정한 가로 픽셀 크기의 PNG로 캡처한다 (줌 배율과 무관하게 일정한 해상도)
  function captureCanvasPng(targetWidth) {
    const guides = canvas.getObjects().filter(o => o.isGuideline);
    guides.forEach(g => { g.visible = false; });
    try {
      return canvas.toDataURL({ format: 'png', multiplier: targetWidth / (CANVAS_WIDTH * canvasScale) });
    } finally {
      guides.forEach(g => { g.visible = true; });
    }
  }

  window.handleManualSave = function () {
    saveCurrentSlideState();
    recordBackup('save');

    let currentScreenshot = null;
    try {
      if (canvas) currentScreenshot = captureCanvasPng(1920);
    } catch (e) {}

    if (vscode) {
      vscode.postMessage({
        type: 'manualSave',
        deck: cleanDeckData(deckData),
        screenshot: currentScreenshot,
        slideNumber: currentSlideIndex + 1
      });
    }

    showToast('슬라이드가 저장되고 백업이 보관되었습니다!');
  };

  window.createManualBackup = function () {
    saveCurrentSlideState();
    recordBackup('manual');
    if (!vscode) renderHistoryList(); // VS Code에서는 호스트가 새 목록을 보내오면 다시 그린다
    showToast('새 백업이 생성되었습니다.');
  };

  window.openHistoryModal = function () {
    const modal = document.getElementById('historyModalOverlay');
    if (!modal) return;
    if (vscode) vscode.postMessage({ type: 'listBackups' });
    renderHistoryList();
    modal.classList.add('show');
  };

  window.closeHistoryModal = function (e) {
    if (e && e.target && e.target.id !== 'historyModalOverlay') return;
    const modal = document.getElementById('historyModalOverlay');
    if (modal) modal.classList.remove('show');
  };

  // 호스트가 알려준 백업 목록 (VS Code). 브라우저 단독 실행에서는 localStorage 목록을 쓴다.
  let hostBackups = [];

  function getHistoryItems() {
    if (vscode) {
      return hostBackups.map(b => ({
        id: b.fileName,
        fileName: b.fileName,
        dateStr: formatDateTime(new Date(b.timestamp)),
        title: b.title,
        slidesCount: b.slidesCount,
        kind: b.kind
      }));
    }
    return getBackupsList().map(b => ({ ...b, kind: b.kind || 'save' }));
  }

  function renderHistoryList() {
    const container = document.getElementById('historyListContainer');
    if (!container) return;
    const list = getHistoryItems();

    container.innerHTML = '';
    if (list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'history-empty-notice';
      empty.innerHTML = `
        <div style="font-size: 28px; margin-bottom: 8px;">📁</div>
        <div>보관된 백업 버전이 없습니다.</div>
        <div style="font-size: 12px; color: #475569; margin-top: 4px;">저장(Ctrl+S)을 누르거나 '현재 상태 즉시 백업'을 클릭하면 안전하게 보관됩니다.</div>
      `;
      container.appendChild(empty);
      return;
    }

    // 파일 내용(제목 등)은 신뢰할 수 없으므로 textContent로만 넣는다
    const span = (text, className) => {
      const el = document.createElement('span');
      if (className) el.className = className;
      el.textContent = text;
      return el;
    };

    list.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = `history-item-card ${idx === 0 ? 'current' : ''}`;

      const isAuto = item.kind === 'prerestore';
      const badgeClass = idx === 0 ? 'badge-current' : (isAuto ? 'badge-auto' : 'badge-manual');
      const badgeText = idx === 0 ? '최신 백업' : (BACKUP_KIND_LABELS[item.kind] || '백업');

      const left = document.createElement('div');
      left.className = 'history-info-left';
      const nameRow = document.createElement('div');
      nameRow.className = 'history-file-name';
      nameRow.append(span(item.fileName), span(badgeText, `history-badge ${badgeClass}`));
      const meta = document.createElement('div');
      meta.className = 'history-meta-sub';
      meta.append(span(`🕒 ${item.dateStr}`), span(`📄 슬라이드 ${item.slidesCount || 1}장`), span(`🏷️ ${item.title || '프레젠테이션'}`));
      left.append(nameRow, meta);

      const right = document.createElement('div');
      right.className = 'history-actions-right';
      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'history-restore-btn';
      restoreBtn.title = '이 시점으로 슬라이드 복원';
      restoreBtn.append(span('⟲ 복원'));
      restoreBtn.addEventListener('click', () => window.restoreBackup(item.id));
      const delBtn = document.createElement('button');
      delBtn.className = 'history-delete-btn';
      delBtn.title = '이 백업 삭제';
      delBtn.textContent = '❌';
      delBtn.addEventListener('click', () => window.deleteBackup(item.id));
      right.append(restoreBtn, delBtn);

      card.append(left, right);
      container.appendChild(card);
    });
  }

  function applyRestoredDeck(deck, label) {
    if (!deck || !Array.isArray(deck.slides) || deck.slides.length === 0) {
      showToast('복원할 슬라이드가 없는 백업입니다.');
      return;
    }
    recordBackup('prerestore'); // 복원 직전 현재 상태를 안전 백업

    deckData = JSON.parse(JSON.stringify(deck));
    const titleInput = document.getElementById('projectTitleInput');
    if (titleInput && deckData.title) {
      titleInput.value = deckData.title;
    }

    renderSlideList();
    loadSlide(0);
    const modal = document.getElementById('historyModalOverlay');
    if (modal) modal.classList.remove('show');
    notifySlideModified();
    showToast(`'${label}' 시점의 버전으로 복원되었습니다! ⟲`);
  }

  window.restoreBackup = function (backupId) {
    if (vscode) {
      vscode.postMessage({ type: 'restoreBackupFile', fileName: backupId });
      return;
    }
    const target = getBackupsList().find(b => b.id === backupId);
    if (!target || !target.data) {
      showToast('백업 데이터를 찾을 수 없습니다.');
      return;
    }
    applyRestoredDeck(target.data, target.dateStr);
  };

  window.deleteBackup = function (backupId) {
    if (vscode) {
      vscode.postMessage({ type: 'deleteBackupFile', fileName: backupId });
    } else {
      saveBackupsList(getBackupsList().filter(b => b.id !== backupId));
      renderHistoryList();
    }
    showToast('백업 항목이 삭제되었습니다.');
  };

  const BACKUPS_TO_KEEP = 5;
  window.clearOldBackups = function () {
    if (getHistoryItems().length <= BACKUPS_TO_KEEP) {
      showToast(`정리할 오래된 백업이 없습니다 (최근 ${BACKUPS_TO_KEEP}개 유지 중)`);
      return;
    }
    // Webview에서는 confirm()이 차단되므로 확인 없이 정리한다
    if (vscode) {
      vscode.postMessage({ type: 'pruneBackups', keep: BACKUPS_TO_KEEP });
    } else {
      saveBackupsList(getBackupsList().slice(0, BACKUPS_TO_KEEP));
      renderHistoryList();
    }
    showToast(`최근 ${BACKUPS_TO_KEEP}개를 제외한 오래된 백업이 정리되었습니다.`);
  };

  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', function (e) {
      // 입력 필드(폰트 검색창, 글자 크기 등)에 포커스된 경우 캔버스 단축키 무시
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) {
        return;
      }

      // Ctrl+S로 저장 및 백업 보관
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        window.handleManualSave();
        return;
      }

      // Ctrl+A로 전체 선택 (표 선택 시 표 전체 셀, 그 외 슬라이드 전체 개체)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        window.handleSelectAll();
        return;
      }

      // Ctrl+Z 실행 취소, Ctrl+Y / Ctrl+Shift+Z 다시 실행
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (e.shiftKey) {
          window.redo();
        } else {
          window.undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        window.redo();
        return;
      }

      const activeObj = canvas ? canvas.getActiveObject() : null;
      if (activeObj && activeObj.isEditing) {
        return;
      }

      // 방향키(Arrow keys) / PageUp / PageDown 단축키 처리
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(e.key)) {
        if (activeObj) {
          // PageUp / PageDown 키는 개체 선택 상태에서도 슬라이드 이전/다음 이동 지원
          if (e.key === 'PageUp') {
            e.preventDefault();
            if (currentSlideIndex > 0) switchSlide(currentSlideIndex - 1);
            return;
          }
          if (e.key === 'PageDown') {
            e.preventDefault();
            if (currentSlideIndex < deckData.slides.length - 1) switchSlide(currentSlideIndex + 1);
            return;
          }

          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();

          const step = e.shiftKey ? 10 : 1;
          let dx = 0;
          let dy = 0;
          if (e.key === 'ArrowUp') dy = -step;
          else if (e.key === 'ArrowDown') dy = step;
          else if (e.key === 'ArrowLeft') dx = -step;
          else if (e.key === 'ArrowRight') dx = step;

          activeObj.set({
            left: Math.round((activeObj.left || 0) + dx),
            top: Math.round((activeObj.top || 0) + dy)
          });
          activeObj.setCoords();
          canvas.renderAll();
          updateInspector();
          updateSlideOverflowGuides();
          saveCurrentSlideState();
          return;
        } else {
          // 개체가 선택되지 않은 경우: 위/아래 방향키 또는 PageUp/PageDown으로 앞/뒤 슬라이드 즉시 이동
          if (e.key === 'ArrowUp' || e.key === 'PageUp') {
            e.preventDefault();
            if (currentSlideIndex > 0) {
              switchSlide(currentSlideIndex - 1);
            }
            return;
          }
          if (e.key === 'ArrowDown' || e.key === 'PageDown') {
            e.preventDefault();
            if (currentSlideIndex < deckData.slides.length - 1) {
              switchSlide(currentSlideIndex + 1);
            }
            return;
          }
        }
      }

      // Delete 또는 Backspace 키로 선택 개체 삭제
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeObj) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          deleteSelected();
          return;
        }
      }

      // Ctrl+C 복사
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        if (activeObj) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          copySelected();
          return;
        }
      }

      // Ctrl+V 붙여넣기
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        if (clipboard) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          pasteClipboard();
          return;
        }
      }

      // Ctrl+X 잘라내기
      if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
        if (activeObj) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          cutSelected();
          return;
        }
      }

      // Ctrl+D 개체 빠른 복제
      if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        if (activeObj) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          copySelected();
          pasteClipboard();
          return;
        }
      }

      // Ctrl+G 그룹화, Ctrl+Shift+G 그룹 해제 (IDE Go to line 가로채기 방지)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (e.shiftKey) {
          window.ungroupSelected();
        } else {
          window.groupSelected();
        }
        return;
      }
    }, true);
  }

  // ================= 그룹화 및 그룹 해제 =================
  window.groupSelected = function () {
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (!activeObj) {
      showToast('그룹화할 개체들을 선택해주세요.');
      return;
    }

    if (activeObj.type === 'activeSelection') {
      const allObjects = canvas.getObjects();
      const selObjects = activeObj.getObjects().slice();
      let minIndex = allObjects.length;
      selObjects.forEach(obj => {
        const idx = allObjects.indexOf(obj);
        if (idx !== -1 && idx < minIndex) minIndex = idx;
      });

      const group = activeObj.toGroup();
      group.id = `el-group-${Date.now()}`;
      
      // 원래 개체들이 있던 z-order 위치로 그룹 배치
      if (minIndex < allObjects.length) {
        canvas.moveTo(group, minIndex);
      }
      group.setCoords();
      canvas.setActiveObject(group);
      canvas.requestRenderAll();
      saveCurrentSlideState();
      showToast('선택한 개체들이 그룹화되었습니다 (Ctrl+G)');
    } else if (activeObj.type === 'group') {
      showToast('이미 그룹화된 개체입니다.');
    } else {
      showToast('2개 이상의 개체를 드래그 또는 Shift로 선택해주세요.');
    }
  };

  window.ungroupSelected = function () {
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (!activeObj) {
      showToast('그룹 해제할 개체를 선택해주세요.');
      return;
    }

    if (activeObj.type === 'group') {
      if (activeObj.isTable) {
        showToast('표 객체는 그룹 해제할 수 없습니다.');
        return;
      }
      if (activeObj.isVideo) {
        showToast('비디오 객체는 그룹 해제할 수 없습니다.');
        return;
      }

      // 1. 그룹이 현재 위치한 캔버스 상의 z-index를 정확히 기록
      const groupIndex = canvas.getObjects().indexOf(activeObj);

      // 2. 그룹 해제하여 ActiveSelection 생성
      const sel = activeObj.toActiveSelection();
      const items = sel.getObjects().slice();

      // 3. 자식 개체들의 위치를 그룹이 있던 원래 z-index 층위로 복원하여 다른 개체 덮어씌움 방지
      if (groupIndex !== -1) {
        items.forEach((item, i) => {
          canvas.moveTo(item, groupIndex + i);
        });
      }

      // 4. 텍스트 박스 가로 길이가 줄어드는 현상 완벽 방지
      items.forEach(item => {
        if (item.type === 'textbox' || item.type === 'text') {
          if (item.scaleX && item.scaleX !== 1) {
            item.set('width', Math.round(item.width * item.scaleX));
            item.set('scaleX', 1);
          }
          if (item.scaleY && item.scaleY !== 1) {
            item.set('scaleY', 1);
          }
        }
        item.setCoords();
      });

      canvas.setActiveObject(sel);
      canvas.requestRenderAll();
      saveCurrentSlideState();
      showToast('그룹이 해제되었습니다 (Ctrl+Shift+G)');
    } else {
      showToast('그룹화된 개체를 선택해주세요.');
    }
  };

  // 데이터 직렬화 기반 복사/잘라내기/붙여넣기 (표, 텍스트, 비디오, 다중선택 완벽 보존)
  function copySelected() {
    const activeObj = canvas.getActiveObject();
    if (!activeObj) return;

    if (activeObj.type === 'activeSelection') {
      const objects = activeObj.getObjects();
      clipboard = {
        isMultiple: true,
        items: objects.map((obj, i) => exportFabricObjectToData(obj, i))
      };
    } else {
      clipboard = {
        isMultiple: false,
        item: exportFabricObjectToData(activeObj, 0)
      };
    }
    showToast('복사되었습니다 (Ctrl+C)');
  }

  function cutSelected() {
    const activeObj = canvas.getActiveObject();
    if (!activeObj) return;
    copySelected();
    if (activeObj.type === 'activeSelection') {
      activeObj.getObjects().forEach(obj => canvas.remove(obj));
    } else {
      canvas.remove(activeObj);
    }
    canvas.discardActiveObject();
    canvas.renderAll();
    saveCurrentSlideState();
    showToast('잘라냈습니다 (Ctrl+X)');
  }

  function pasteClipboard() {
    if (!clipboard) return;
    canvas.discardActiveObject();

    if (clipboard.isMultiple && Array.isArray(clipboard.items)) {
      const newObjects = [];
      let pending = clipboard.items.length;
      clipboard.items.forEach((item, idx) => {
        const itemCopy = JSON.parse(JSON.stringify(item));
        itemCopy.id = `el-copy-${Date.now()}-${idx}`;
        itemCopy.left = (itemCopy.left || 0) + 30;
        itemCopy.top = (itemCopy.top || 0) + 30;
        // 연속 붙여넣기를 위해 클립보드 오프셋 갱신
        item.left = itemCopy.left;
        item.top = itemCopy.top;

        createFabricObjectFromData(itemCopy, function (createdObj) {
          if (createdObj) {
            canvas.add(createdObj);
            newObjects.push(createdObj);
          }
          pending--;
          if (pending === 0 && newObjects.length > 0) {
            const sel = new fabric.ActiveSelection(newObjects, { canvas: canvas });
            canvas.setActiveObject(sel);
            canvas.renderAll();
            updateInspector(sel);
            saveCurrentSlideState();
            showToast('붙여넣었습니다 (Ctrl+V)');
          }
        });
      });
    } else if (clipboard.item) {
      const itemCopy = JSON.parse(JSON.stringify(clipboard.item));
      itemCopy.id = `el-copy-${Date.now()}`;
      itemCopy.left = (itemCopy.left || 0) + 30;
      itemCopy.top = (itemCopy.top || 0) + 30;
      // 연속 붙여넣기를 위해 클립보드 오프셋 갱신
      clipboard.item.left = itemCopy.left;
      clipboard.item.top = itemCopy.top;

      createFabricObjectFromData(itemCopy, function (createdObj) {
        if (!createdObj) return;
        canvas.add(createdObj);
        canvas.setActiveObject(createdObj);
        canvas.renderAll();
        updateInspector(createdObj);
        saveCurrentSlideState();
        showToast('붙여넣었습니다 (Ctrl+V)');
      });
    }
  }

  // ================= 8. 우클릭 컨텍스트 메뉴 =================
  function setupContextMenu() {
    const menu = document.getElementById('contextMenu');
    if (!menu) return;

    // 크롬 기본 우클릭 메뉴 원천 차단하고 편집기 우클릭 메뉴만 띄우기
    window.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (canvas) {
        const target = canvas.findTarget(e);
        if (target) {
          if (canvas.getActiveObject() !== target) {
            canvas.setActiveObject(target);
            canvas.renderAll();
          }
          if (target.isTable) {
            const pointer = canvas.getPointer(e);
            const rawCell = getTableCellFromPointer(target, pointer);
            let cell = rawCell;
            let cellKey = rawCell.key || `${rawCell.r}_${rawCell.c}`;
            const coverKeys = [];
            if (rawCell.isSubCell) {
              coverKeys.push(cellKey);
            } else {
              const mInfo = getMergeInfo(target.merges, rawCell.r, rawCell.c);
              cell = mInfo ? { r: mInfo.merge.r, c: mInfo.merge.c, key: `${mInfo.merge.r}_${mInfo.merge.c}`, isSubCell: false } : rawCell;
              cellKey = `${cell.r}_${cell.c}`;
              if (mInfo) {
                for (let mr = mInfo.merge.r; mr < mInfo.merge.r + (mInfo.merge.rowspan || 1); mr++) {
                  for (let mc = mInfo.merge.c; mc < mInfo.merge.c + (mInfo.merge.colspan || 1); mc++) {
                    coverKeys.push(`${mr}_${mc}`);
                  }
                }
              } else {
                coverKeys.push(cellKey);
              }
            }
            const curSel = target.selectedCells || [];
            if (!curSel.includes(cellKey)) {
              target.selectedCells = coverKeys;
              target.selectedCell = cell;
              target.anchorCell = cell;
              updateTableHighlights(target);
              updateInspector(target);
            }
          }
        } else {
          // 슬라이드 빈 곳 우클릭 시 슬라이드 전용 메뉴가 표시되도록 보장
          if (!menu.contains(e.target)) {
            canvas.discardActiveObject();
            canvas.renderAll();
          }
        }
      }
      showContextMenu(e.clientX, e.clientY);
    }, true);

    window.addEventListener('click', function (e) {
      if (!menu.contains(e.target)) {
        hideContextMenu();
      }
    });
  }

  function showContextMenu(x, y) {
    const menu = document.getElementById('contextMenu');
    if (!menu) return;

    const obj = canvas ? canvas.getActiveObject() : null;
    const isTable = !!(obj && obj.isTable);
    const ctxTblWrapper = document.getElementById('ctxTableSettingsWrapper');
    const ctxTableActionGroup = document.getElementById('ctxTableActionGroup');
    const ctxSlideGroup = document.getElementById('ctxSlideGroup');
    const ctxObjectGroup = document.getElementById('ctxObjectGroup');

    if (obj) {
      // 1. 개체가 선택된 경우: 개체 메뉴 노출, 슬라이드 메뉴 숨김
      if (ctxSlideGroup) ctxSlideGroup.style.display = 'none';
      if (ctxObjectGroup) ctxObjectGroup.style.display = 'block';

      if (ctxTblWrapper) {
        ctxTblWrapper.style.display = isTable ? 'block' : 'none';
      }
      if (ctxTableActionGroup) {
        ctxTableActionGroup.style.display = isTable ? 'block' : 'none';
      }

      if (isTable) {
        if (!obj.selectedCell) obj.selectedCell = { r: 0, c: 0 };
        const { r, c } = obj.selectedCell;
        const mInfo = getMergeInfo(obj.merges, r, c);

        // 셀 병합/분리 가능 여부에 따라 버튼 시각적 상태 갱신
        const canMerge = canMergeSelectedCells(obj);
        const canSplit = canSplitSelectedCells(obj);
        const mergeBtn = document.getElementById('ctxMergeCellsBtn');
        const splitBtn = document.getElementById('ctxSplitCellsBtn');
        if (mergeBtn) {
          mergeBtn.classList.toggle('disabled', !canMerge);
          mergeBtn.style.opacity = canMerge ? '1' : '0.45';
          mergeBtn.style.cursor = canMerge ? 'pointer' : 'not-allowed';
          mergeBtn.title = canMerge ? '선택한 인접 직사각형 셀 병합' : '인접한 연속된 직사각형 형태의 2개 이상 셀만 병합 가능합니다';
        }
        if (splitBtn) {
          splitBtn.classList.toggle('disabled', !canSplit);
          splitBtn.style.opacity = canSplit ? '1' : '0.45';
          splitBtn.style.cursor = canSplit ? 'pointer' : 'not-allowed';
          splitBtn.title = canSplit
            ? (obj.selectedCells && obj.selectedCells.length === 1 ? '선택한 셀을 여러 행/열로 분할' : '선택한 병합된 셀 분리')
            : '선택 영역에 분리할 수 있는 셀이 없습니다';
        }

        const flyoutMergeBtn = document.getElementById('flyoutMergeBtn');
        const flyoutSplitBtn = document.getElementById('flyoutSplitBtn');
        if (flyoutMergeBtn) flyoutMergeBtn.disabled = !canMerge;
        if (flyoutSplitBtn) flyoutSplitBtn.disabled = !canSplit;

        const cellCoordEl = document.getElementById('selectedCellCoord');
        if (cellCoordEl) {
          const totalCount = obj.tableRows * obj.tableCols;
          const selectedCount = (obj.selectedCells && obj.selectedCells.length) || 1;
          if (selectedCount === totalCount) {
            cellCoordEl.textContent = `전체 셀 (${obj.tableRows}×${obj.tableCols})`;
          } else if (mInfo && selectedCount === (mInfo.merge.rowspan || 1) * (mInfo.merge.colspan || 1)) {
            cellCoordEl.textContent = `${mInfo.merge.r + 1}행 ${mInfo.merge.c + 1}열 (병합 ${mInfo.merge.rowspan}×${mInfo.merge.colspan})`;
          } else if (selectedCount > 1) {
            cellCoordEl.textContent = `${r + 1}행 ${c + 1}열 외 ${selectedCount - 1}개 (총 ${selectedCount}개)`;
          } else {
            cellCoordEl.textContent = `${r + 1}행 ${c + 1}열`;
          }
        }
        const cellInputEl = document.getElementById('tableCellInput');
        if (cellInputEl) {
          let val = '';
          if (obj.selectedCell && obj.selectedCell.isSubCell && obj.subCellData) {
            val = obj.subCellData[obj.selectedCell.key] || '';
          } else {
            val = (obj.tableData[r] && obj.tableData[r][c] !== undefined) ? obj.tableData[r][c] : '';
          }
          cellInputEl.value = val;
        }

        const curRowSpan = mInfo ? (mInfo.merge.rowspan || 1) : 1;
        const curColSpan = mInfo ? (mInfo.merge.colspan || 1) : 1;
        const flyRowInput = document.getElementById('flyoutSplitRowCount');
        const flyColInput = document.getElementById('flyoutSplitColCount');
        if (flyRowInput) flyRowInput.value = Math.max(2, curRowSpan);
        if (flyColInput) flyColInput.value = Math.max(2, curColSpan);
        const flyRowCheck = document.getElementById('flyoutSplitRowCheck');
        const flyColCheck = document.getElementById('flyoutSplitColCheck');
        if (flyRowCheck) flyRowCheck.checked = (curRowSpan > 1 || curColSpan <= 1);
        if (flyColCheck) flyColCheck.checked = (curColSpan > 1 || curRowSpan <= 1);

        if (window.updateTableDpadUI) window.updateTableDpadUI();
      }
    } else {
      // 2. 슬라이드 빈 배경을 우클릭한 경우: 슬라이드 레벨 메뉴 노출, 개체 메뉴 숨김
      if (ctxSlideGroup) ctxSlideGroup.style.display = 'block';
      if (ctxObjectGroup) ctxObjectGroup.style.display = 'none';
      if (ctxTblWrapper) ctxTblWrapper.style.display = 'none';
      if (ctxTableActionGroup) ctxTableActionGroup.style.display = 'none';
    }

    const estimatedHeight = isTable ? 420 : (obj ? 250 : 220);
    // 플라이아웃 패널 너비(약 210px)를 고려하여 우측 가장자리에 걸리지 않도록 배치
    const safeX = Math.min(window.innerWidth - 380, Math.max(10, x));
    const safeY = Math.min(window.innerHeight - estimatedHeight, Math.max(10, y));

    menu.style.left = safeX + 'px';
    menu.style.top = safeY + 'px';
    menu.style.display = 'block';
  }

  function hideContextMenu() {
    const menu = document.getElementById('contextMenu');
    if (menu) menu.style.display = 'none';
    const wrap = document.getElementById('ctxTableSettingsWrapper');
    if (wrap) wrap.classList.remove('active');
  }

  window.toggleCtxTableFlyout = function (e) {
    if (e) e.stopPropagation();
    const wrap = document.getElementById('ctxTableSettingsWrapper');
    if (wrap) wrap.classList.toggle('active');
  };

  // 표 셀 병합/분리 컨텍스트 액션
  window.ctxMergeCells = function () {
    const obj = canvas ? canvas.getActiveObject() : null;
    if (obj && obj.isTable) {
      mergeSelectedCells(obj);
    }
    hideContextMenu();
  };

  window.ctxSplitCells = function () {
    const obj = canvas ? canvas.getActiveObject() : null;
    if (obj && obj.isTable) {
      splitSelectedCells(obj);
    }
    hideContextMenu();
  };

  // 개체 레벨 컨텍스트 액션
  window.ctxCopy = function () { copySelected(); hideContextMenu(); };
  window.ctxCut = function () { cutSelected(); hideContextMenu(); };
  window.ctxPaste = function () { pasteClipboard(); hideContextMenu(); };
  window.ctxGroup = function () { window.groupSelected(); hideContextMenu(); };
  window.ctxUngroup = function () { window.ungroupSelected(); hideContextMenu(); };
  window.ctxDelete = function () { deleteSelected(); hideContextMenu(); };
  window.ctxBringForward = function () { bringForward(); hideContextMenu(); };
  window.ctxSendBackward = function () { sendBackward(); hideContextMenu(); };
  window.ctxBringToFront = function () { bringToFront(); hideContextMenu(); };
  window.ctxSendToBack = function () { sendToBack(); hideContextMenu(); };

  // 슬라이드 레벨 컨텍스트 액션 (빈 배경 우클릭 시)
  window.ctxChangeSlideBg = function (e) {
    hideContextMenu();
    window.handleUnifiedBgClick(e);
  };
  window.ctxAddSlide = function () {
    hideContextMenu();
    window.addNewSlide();
  };
  window.ctxDuplicateSlide = function () {
    hideContextMenu();
    window.duplicateSlide(currentSlideIndex);
  };
  window.ctxDeleteSlide = function () {
    hideContextMenu();
    window.deleteSlide(currentSlideIndex);
  };
  window.ctxToggleGuideline = function () {
    hideContextMenu();
    window.toggleGuideline();
  };

  // ================= 9. 드롭다운 팝오버 메뉴 제어 =================
  window.toggleShapePopover = function (e) {
    if (e) e.stopPropagation();
    hideAllPopoversExcept('shapePopover');
    const pop = document.getElementById('shapePopover');
    if (!pop) return;
    if (pop.classList.contains('show')) {
      pop.classList.remove('show');
      return;
    }
    const trigger = e ? e.currentTarget : document.getElementById('shapeDropdownTrigger');
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      pop.style.left = rect.left + 'px';
      pop.style.top = (rect.bottom + 6) + 'px';
    }
    pop.classList.add('show');
  };

  window.toggleTablePopover = function (e) {
    if (e) e.stopPropagation();
    hideAllPopoversExcept('tablePopover');
    const pop = document.getElementById('tablePopover');
    if (!pop) return;
    if (pop.classList.contains('show')) {
      pop.classList.remove('show');
      return;
    }
    const trigger = e ? e.currentTarget : document.getElementById('tableDropdownTrigger');
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      pop.style.left = rect.left + 'px';
      pop.style.top = (rect.bottom + 6) + 'px';
    }
    pop.classList.add('show');
  };

  window.toggleMediaPopover = function (e) {
    if (e) e.stopPropagation();
    hideAllPopoversExcept('mediaPopover');
    const pop = document.getElementById('mediaPopover');
    if (!pop) return;
    if (pop.classList.contains('show')) {
      pop.classList.remove('show');
      return;
    }
    const trigger = e ? e.currentTarget : document.getElementById('mediaDropdownTrigger');
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      pop.style.left = rect.left + 'px';
      pop.style.top = (rect.bottom + 6) + 'px';
    }
    pop.classList.add('show');
  };

  function hideAllPopoversExcept(exceptId) {
    ['shapePopover', 'tablePopover', 'mediaPopover', 'colorPopover'].forEach(id => {
      if (id !== exceptId) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('show');
      }
    });
  }

  window.hideAllPopovers = function () {
    ['shapePopover', 'tablePopover', 'mediaPopover', 'colorPopover'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('show');
    });
  };

  // ================= 10. 색상 팝오버 =================
  function setupColorPopovers() {
    renderRecentColors();
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.dropdown-menu-popover') &&
          !e.target.closest('.color-popover') &&
          !e.target.closest('.color-trigger-btn') &&
          !e.target.closest('.dropdown-trigger-btn')) {
        window.hideAllPopovers();
      }
    });
  }

  window.toggleColorPopover = function (targetType, e) {
    if (e) e.stopPropagation();
    activeColorTarget = targetType;
    const popover = document.getElementById('colorPopover');
    if (!popover) return;

    if (popover.classList.contains('show')) {
      popover.classList.remove('show');
      return;
    }

    const triggerBtn = e ? e.currentTarget : document.getElementById('textColorTrigger');
    if (triggerBtn) {
      const rect = triggerBtn.getBoundingClientRect();
      popover.style.left = rect.left + 'px';
      popover.style.top = (rect.bottom + 6) + 'px';
    }
    popover.classList.add('show');
    renderRecentColors();
  };

  function hideAllColorPopovers() {
    const popover = document.getElementById('colorPopover');
    if (popover) popover.classList.remove('show');
  }

  function addRecentColor(color) {
    if (!color || color === 'transparent') return;
    color = color.toUpperCase();
    recentColors = recentColors.filter(c => c !== color);
    recentColors.unshift(color);
    if (recentColors.length > 5) recentColors.pop();
    renderRecentColors();
  }

  function renderRecentColors() {
    const container = document.getElementById('recentColorsContainer');
    if (!container) return;
    container.innerHTML = '';
    recentColors.forEach(c => {
      const chip = document.createElement('div');
      chip.className = 'color-swatch-chip';
      chip.style.background = c;
      chip.title = c;
      chip.onclick = () => window.applyColorChoice(c);
      container.appendChild(chip);
    });
  }

  window.triggerEyeDropper = async function () {
    if (window.EyeDropper) {
      try {
        const eyeDropper = new EyeDropper();
        const result = await eyeDropper.open();
        window.applyColorChoice(result.sRGBHex);
      } catch (err) {}
    } else {
      showToast('현재 환경에서는 스포이드 API를 지원하지 않습니다.');
    }
  };

  function updateColorBarVisual(el, color) {
    if (!el) return;
    if (!color || color === 'transparent') {
      el.style.backgroundColor = '#FFFFFF';
      el.style.backgroundImage = 'linear-gradient(45deg, transparent calc(50% - 1.5px), #EF4444 calc(50% - 1.5px), #EF4444 calc(50% + 1.5px), transparent calc(50% + 1.5px))';
    } else {
      el.style.backgroundImage = 'none';
      el.style.backgroundColor = color;
    }
  }

  // ================= 10. 색상 적용 & 상단바/표/도형 연동 =================
  window.applyColorChoice = function (color) {
    addRecentColor(color);
    const obj = canvas.getActiveObject();

    if (activeColorTarget === 'text') {
      if (obj && obj.isTable) {
        // 표의 선택된 셀(들) 글자색 일괄 변경
        if (!obj.cellColors) obj.cellColors = {};
        const targetKeys = getTableTargetKeys(obj);
        targetKeys.forEach(k => {
          obj.cellColors[k] = color;
        });
        rebuildTableGroup(obj);
        saveCurrentSlideState();
      } else {
        applyTextColorWithSelection(color);
      }
      updateColorBarVisual(document.getElementById('textColorBar'), color);
    } else if (activeColorTarget === 'topFill') {
      // 상단 서식 바 배경색 버튼 (텍스트박스 / 표 / 도형 통합)
      if (obj && (obj.type === 'textbox' || obj.type === 'text')) {
        obj.set('backgroundColor', color);
        canvas.renderAll();
        saveCurrentSlideState();
      } else if (obj && obj.isTable) {
        if (!obj.cellFills) obj.cellFills = {};
        const targetKeys = getTableTargetKeys(obj);
        targetKeys.forEach(k => {
          obj.cellFills[k] = color;
        });
        rebuildTableGroup(obj);
        saveCurrentSlideState();
      } else if (obj) {
        window.changeFill(color);
      }
      updateUnifiedBgBar();
    } else if (activeColorTarget === 'fill') {
      window.changeFill(color);
      updateUnifiedBgBar();
    } else if (activeColorTarget === 'stroke') {
      window.changeStrokeColor(color);
    } else if (activeColorTarget === 'slideBg') {
      window.changeSlideBackground(color);
      updateUnifiedBgBar();
    } else if (activeColorTarget === 'cellBg') {
      if (obj && obj.isTable) {
        if (!obj.cellFills) obj.cellFills = {};
        const targetKeys = getTableTargetKeys(obj);
        targetKeys.forEach(k => {
          obj.cellFills[k] = color;
        });
        const bar = document.getElementById('cellBgBar');
        if (bar) bar.style.background = color;
        const topBar = document.getElementById('topFillColorBar');
        if (topBar) topBar.style.background = color;
        rebuildTableGroup(obj);
        saveCurrentSlideState();
      }
    } else if (activeColorTarget === 'cellTextColor') {
      if (obj && obj.isTable) {
        if (!obj.cellColors) obj.cellColors = {};
        const targetKeys = getTableTargetKeys(obj);
        targetKeys.forEach(k => {
          obj.cellColors[k] = color;
        });
        const bar = document.getElementById('cellTextColorBar');
        if (bar) bar.style.background = color;
        const tb = document.getElementById('textColorBar');
        if (tb) tb.style.background = color;
        rebuildTableGroup(obj);
        saveCurrentSlideState();
      }
    }
    hideAllColorPopovers();
  };

  function applyTextColorWithSelection(color) {
    const obj = canvas.getActiveObject();
    if (applyToSelectionTexts(obj, ts => ts.forEach(o => { o.set('fill', color); o.styles = {}; }))) return;
    if (!obj || (obj.type !== 'textbox' && obj.type !== 'text')) return;

    if (obj.isEditing && obj.selectionStart !== obj.selectionEnd) {
      // 텍스트 일부만 선택된 경우: 해당 구간 스타일 변경
      obj.setSelectionStyles({ fill: color });
    } else {
      // 텍스트 전체 변경: 개별 스타일 캐시 완전 초기화 후 fill 적용
      obj.set('fill', color);
      obj.styles = {}; // 이전 인라인 문자별 스타일 캐시 완전 초기화
    }
    canvas.renderAll();
    saveCurrentSlideState();
  }

  function setupTextboxBehavior(tb) {
    tb.setControlsVisibility({
      mt: false,
      mb: false
    });
    tb.set({
      lockScalingY: true
    });
  }

  // ================= 11. 슬라이드 로드 및 상태 관리 =================
  let isSwitchingSlide = false;
  let loadToken = 0;
  let captureSyncTimer = null;

  function triggerImmediateSlideCapture(slideNum) {
    if (!vscode || !canvas) return;
    try {
      const captureData = captureCanvasPng(1280);
      if (captureData && captureData.startsWith('data:image/')) {
        vscode.postMessage({
          type: 'saveSlideCapture',
          screenshot: captureData,
          slideNumber: slideNum || (currentSlideIndex + 1)
        });
      }
    } catch (e) {}
  }

  function scheduleSlideCaptureSync(slideNum) {
    if (!vscode || !canvas) return;
    if (captureSyncTimer) clearTimeout(captureSyncTimer);
    captureSyncTimer = setTimeout(() => {
      triggerImmediateSlideCapture(slideNum);
    }, 600);
  }

  function switchSlide(idx) {
    if (idx < 0 || idx >= deckData.slides.length) return;
    if (idx === currentSlideIndex) return;
    isSwitchingSlide = true;
    if (canvas) {
      canvas.discardActiveObject();
      canvas.renderAll();
    }
    // 이전 슬라이드 캡처 즉시 영구 저장
    triggerImmediateSlideCapture(currentSlideIndex + 1);
    saveCurrentSlideState();
    loadSlide(idx);
    clearInspector();
    isSwitchingSlide = false;
    // 새 슬라이드 진입 시 캡처 동기화 스케줄링
    scheduleSlideCaptureSync(idx + 1);
  }

  function loadSlide(index, resetHistory = true) {
    if (index < 0 || index >= deckData.slides.length) return;
    currentSlideIndex = index;

    if (canvas) {
      canvas.discardActiveObject();
    }

    const slide = deckData.slides[index];
    canvas.clear();
    canvas.setBackgroundColor(slide.background || '#FFFFFF', canvas.renderAll.bind(canvas));

    const token = ++loadToken;
    const els = slide.elements || [];
    const slots = new Array(els.length);
    let remaining = els.length;
    // 이미지처럼 비동기로 만들어지는 개체도 원래 z-order대로 한 번에 추가한다.
    const finishLoad = () => {
      if (token !== loadToken) return;
      slots.forEach(o => { if (o) canvas.add(o); });
      if (showGuidelines) updateGuidelines();
      canvas.renderAll();
      updateCurrentSlideThumbnail();
    };
    if (remaining === 0) finishLoad();
    els.forEach((el, i) => {
      createFabricObjectFromData(el, obj => {
        if (token !== loadToken) return; // 더 최근의 로드가 시작되면 이전 콜백은 버린다
        slots[i] = obj;
        if (--remaining === 0) finishLoad();
      });
    });
    const currentBg = slide.background || '#FFFFFF';
    updateUnifiedBgBar();

    if (showGuidelines) {
      updateGuidelines();
    }

    updateSlideListActive();
    setTimeout(updateCurrentSlideThumbnail, 50);

    if (resetHistory) {
      undoStack = [JSON.stringify({ background: slide.background || '#FFFFFF', elements: slide.elements || [] })];
      redoStack = [];
      updateUndoRedoButtons();
    }
    notifySessionState();
  }

  function cleanDeckData(deck) {
    if (!deck || typeof deck !== 'object') return deck;
    try {
      const clean = JSON.parse(JSON.stringify(deck));
      if (Array.isArray(clean.slides)) {
        clean.slides.forEach(s => {
          delete s.thumbnail; // base64 썸네일 속성 영구 제거하여 파일 초경량화
        });
      }
      return clean;
    } catch (e) {
      return deck;
    }
  }

  let slideModifiedTimeout = null;
  function notifySlideModified() {
    if (!vscode) return;
    if (slideModifiedTimeout) clearTimeout(slideModifiedTimeout);
    slideModifiedTimeout = setTimeout(() => {
      vscode.postMessage({
        type: 'slideModified',
        deck: cleanDeckData(deckData)
      });
    }, 250);
  }

  function saveCurrentSlideState() {
    const currentSlide = deckData.slides[currentSlideIndex];
    if (!currentSlide || !canvas) return;

    const elements = [];
    canvas.getObjects().forEach((obj, idx) => {
      if (obj.isGuideline) return;
      elements.push(exportFabricObjectToData(obj, idx));
    });
    currentSlide.elements = elements;

    recordHistory();
    updateCurrentSlideThumbnail();
    scheduleSlideCaptureSync(currentSlideIndex + 1);

    // 브라우저 환경에서도 F5 새로고침 시 절대 초기화되지 않도록 localStorage 자동 영구 저장
    // 브라우저 단독 실행에서만 localStorage에 자동 저장한다 (VS Code에서는 파일이 원본)
    if (!vscode) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanDeckData(deckData)));
      } catch (e) {
        console.warn('localStorage autosave failed:', e);
      }
    }

    notifySlideModified();
  }

  // 슬라이드 배경색 커스텀 변경
  window.changeSlideBackground = function (color) {
    if (!deckData.slides[currentSlideIndex]) return;
    deckData.slides[currentSlideIndex].background = color;
    canvas.setBackgroundColor(color, canvas.renderAll.bind(canvas));
    updateCurrentSlideThumbnail();
    saveCurrentSlideState();
    showToast(`슬라이드 배경색이 변경되었습니다 (${color})`);
  };

  // ================= 테이블 및 비디오 생성 헬퍼 =================
  function generateDefaultTableData(rows, cols) {
    const grid = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        if (r === 0) {
          row.push(`항목 ${c + 1}`);
        } else {
          row.push(`내용 ${r}-${c + 1}`);
        }
      }
      grid.push(row);
    }
    return grid;
  }

  // ================= 표 기하 모델 (DOM/fabric 비의존 순수 함수) =================
  // 표는 "서로 겹치지 않고 빈틈없이 덮는 직사각형 셀(leaf)들의 집합"으로 다룬다.
  // 분할/테두리 이동/병합은 모두 leaf 사각형을 수정한 뒤, 사각형들의 모서리 좌표로 격자(colWidths,
  // rowHeights, merges)를 다시 만든다. 어느 셀에도 쓰이지 않는 가짜 격자선은 자동으로 사라지고,
  // 서로 일직선이 된 테두리는 같은 격자선으로 합쳐지므로 "한 줄 전체 / 끊어진 테두리 / 정렬 후 한 줄"이
  // 모두 같은 규칙으로 처리된다.
  // <TABLE_MODEL_START>
  const TBL_PROP_NAMES = ['cellFills', 'cellColors', 'cellBorderColors', 'cellBorderWidths', 'cellFonts', 'cellFontSizes', 'cellBolds', 'cellItalics', 'cellUnderlines', 'cellAligns'];
  const TBL_EPS = 1.0;
  const TBL_MIN_W = 20;
  const TBL_MIN_H = 16;
  const TBL_SNAP = 6;
  let tblLeafSeq = 0;

  function tblRound2(v) {
    return Math.round(v * 100) / 100;
  }

  // 행 번호에 따라 달라지는 기본 서식 (행 번호가 바뀌어도 모양이 변하지 않게 고정하는 데 사용)
  function tblDefaultCellStyle(r) {
    return {
      cellFills: r === 0 ? '#1E293B' : (r % 2 === 1 ? '#FFFFFF' : '#F8FAFC'),
      cellColors: r === 0 ? '#FFFFFF' : '#334155',
      cellFontSizes: r === 0 ? 16 : 14,
      cellBolds: r === 0
    };
  }

  function tblModelFromObj(o) {
    const rows = o.tableRows || o.rows || 1;
    const cols = o.tableCols || o.cols || 1;
    const m = {
      rows: rows,
      cols: cols,
      colWidths: (o.colWidths && o.colWidths.length === cols) ? o.colWidths.slice() : Array(cols).fill((o.width || cols * 160) / cols),
      rowHeights: (o.rowHeights && o.rowHeights.length === rows) ? o.rowHeights.slice() : Array(rows).fill((o.height || rows * 56) / rows),
      merges: Array.isArray(o.merges) ? o.merges.map(g => ({ r: g.r, c: g.c, rowspan: g.rowspan || 1, colspan: g.colspan || 1 })) : [],
      tableData: o.tableData || []
    };
    TBL_PROP_NAMES.forEach(p => { m[p] = o[p] || {}; });
    return m;
  }

  function tblAssignModel(o, res) {
    o.tableRows = res.rows;
    o.tableCols = res.cols;
    o.colWidths = res.colWidths;
    o.rowHeights = res.rowHeights;
    o.merges = res.merges;
    o.tableData = res.tableData;
    TBL_PROP_NAMES.forEach(p => { o[p] = res[p]; });
    o.width = res.colWidths.reduce((a, b) => a + b, 0);
    o.height = res.rowHeights.reduce((a, b) => a + b, 0);
  }

  function tblCoverKeys(l) {
    const keys = [];
    for (let rr = 0; rr < l.rs; rr++) {
      for (let cc = 0; cc < l.cs; cc++) keys.push(`${l.r + rr}_${l.c + cc}`);
    }
    return keys;
  }

  function tblExtent(m) {
    return {
      w: m.colWidths.reduce((a, b) => a + b, 0),
      h: m.rowHeights.reduce((a, b) => a + b, 0)
    };
  }

  // 격자 + 병합 정보를 겹치지 않는 leaf 사각형 목록으로 변환
  function tblLeaves(m) {
    const rows = m.rows, cols = m.cols;
    const colX = [0];
    for (let c = 0; c < cols; c++) colX.push(colX[c] + m.colWidths[c]);
    const rowY = [0];
    for (let r = 0; r < rows; r++) rowY.push(rowY[r] + m.rowHeights[r]);
    const covered = [];
    for (let r = 0; r < rows; r++) covered.push(new Array(cols).fill(false));
    const leaves = [];

    const add = (r, c, rs, cs) => {
      for (let rr = r; rr < r + rs; rr++) {
        for (let cc = c; cc < c + cs; cc++) covered[rr][cc] = true;
      }
      const key = `${r}_${c}`;
      const style = {};
      TBL_PROP_NAMES.forEach(p => {
        if (m[p] && m[p][key] !== undefined) style[p] = m[p][key];
      });
      const raw = (m.tableData && m.tableData[r]) ? m.tableData[r][c] : undefined;
      leaves.push({
        id: ++tblLeafSeq,
        r: r, c: c, rs: rs, cs: cs, key: key,
        x0: colX[c], x1: colX[c + cs], y0: rowY[r], y1: rowY[r + rs],
        text: raw !== undefined && raw !== null ? raw : (r === 0 ? `항목 ${c + 1}` : '내용'),
        style: style
      });
    };

    (m.merges || []).forEach(g => {
      if (g.r < 0 || g.c < 0 || g.r >= rows || g.c >= cols) return;
      const rEnd = Math.min(rows, g.r + Math.max(1, g.rowspan || 1));
      const cEnd = Math.min(cols, g.c + Math.max(1, g.colspan || 1));
      for (let rr = g.r; rr < rEnd; rr++) {
        for (let cc = g.c; cc < cEnd; cc++) {
          if (covered[rr][cc]) return;
        }
      }
      add(g.r, g.c, rEnd - g.r, cEnd - g.c);
    });
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!covered[r][c]) add(r, c, 1, 1);
      }
    }
    return leaves;
  }

  function tblCloneLeaves(leaves) {
    return leaves.map(l => Object.assign({}, l, { style: Object.assign({}, l.style) }));
  }

  function tblHitLeaves(leaves, selKeys) {
    const sel = new Set(selKeys || []);
    return leaves.filter(l => tblCoverKeys(l).some(k => sel.has(k)));
  }

  function tblCluster(values) {
    const s = values.slice().sort((a, b) => a - b);
    const out = [];
    s.forEach(v => {
      if (!out.length || v - out[out.length - 1] > TBL_EPS) out.push(v);
    });
    return out;
  }

  function tblIndexOf(arr, v) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < arr.length; i++) {
      const d = Math.abs(arr[i] - v);
      if (d < bd) { bd = d; bi = i; }
    }
    return bi;
  }

  // leaf 사각형들로부터 격자/병합/셀 서식을 다시 만든다
  function tblRebuild(leaves) {
    const xs = tblCluster(leaves.reduce((a, l) => a.concat([l.x0, l.x1]), []));
    const ys = tblCluster(leaves.reduce((a, l) => a.concat([l.y0, l.y1]), []));
    const cols = Math.max(1, xs.length - 1);
    const rows = Math.max(1, ys.length - 1);
    const res = { rows: rows, cols: cols, colWidths: [], rowHeights: [], merges: [], tableData: [], idToCell: {} };
    for (let i = 0; i < cols; i++) res.colWidths.push(tblRound2(xs[i + 1] - xs[i]));
    for (let i = 0; i < rows; i++) res.rowHeights.push(tblRound2(ys[i + 1] - ys[i]));
    for (let r = 0; r < rows; r++) res.tableData.push(new Array(cols).fill(''));
    TBL_PROP_NAMES.forEach(p => { res[p] = {}; });

    leaves.forEach(l => {
      let c = tblIndexOf(xs, l.x0), c2 = tblIndexOf(xs, l.x1);
      let r = tblIndexOf(ys, l.y0), r2 = tblIndexOf(ys, l.y1);
      if (c2 <= c) c2 = Math.min(cols, c + 1);
      if (r2 <= r) r2 = Math.min(rows, r + 1);
      const key = `${r}_${c}`;
      res.tableData[r][c] = l.text;
      if (r2 - r > 1 || c2 - c > 1) res.merges.push({ r: r, c: c, rowspan: r2 - r, colspan: c2 - c });
      res.idToCell[l.id] = { r: r, c: c, rs: r2 - r, cs: c2 - c };

      const style = Object.assign({}, l.style);
      // 행 번호가 바뀌어 기본(줄무늬/머리글) 서식이 달라지는 셀은 원래 모양을 서식으로 고정
      const oldDef = tblDefaultCellStyle(l.r);
      const newDef = tblDefaultCellStyle(r);
      ['cellFills', 'cellColors', 'cellFontSizes', 'cellBolds'].forEach(p => {
        if (style[p] === undefined && oldDef[p] !== newDef[p]) style[p] = oldDef[p];
      });
      TBL_PROP_NAMES.forEach(p => {
        if (style[p] !== undefined) res[p][key] = style[p];
      });
    });
    return res;
  }

  function tblSelectionFromIds(res, ids) {
    const keys = [];
    let first = null;
    (ids || []).forEach(id => {
      const cl = res.idToCell[id];
      if (!cl) return;
      if (!first) first = cl;
      keys.push.apply(keys, tblCoverKeys(cl));
    });
    if (!first) return { selectedCells: ['0_0'], selectedCell: { r: 0, c: 0 } };
    return { selectedCells: keys, selectedCell: { r: first.r, c: first.c } };
  }

  // ---------- 병합 ----------
  // 선택된 셀들이 하나의 직사각형을 정확히 이루면 병합 대상 leaf 목록과 외곽 사각형을 돌려준다
  function tblMergePlan(m, selKeys) {
    const leaves = tblLeaves(m);
    const hit = tblHitLeaves(leaves, selKeys);
    if (hit.length < 2) return null;
    const bx0 = Math.min.apply(null, hit.map(l => l.x0));
    const bx1 = Math.max.apply(null, hit.map(l => l.x1));
    const by0 = Math.min.apply(null, hit.map(l => l.y0));
    const by1 = Math.max.apply(null, hit.map(l => l.y1));
    const hitIds = new Set(hit.map(l => l.id));
    const blocked = leaves.some(l => !hitIds.has(l.id)
      && l.x0 < bx1 - TBL_EPS && l.x1 > bx0 + TBL_EPS && l.y0 < by1 - TBL_EPS && l.y1 > by0 + TBL_EPS);
    if (blocked) return null;
    return { leaves: leaves, hit: hit, rect: { x0: bx0, x1: bx1, y0: by0, y1: by1 } };
  }

  function tblCanMerge(m, selKeys) {
    return !!tblMergePlan(m, selKeys);
  }

  function tblMerge(m, selKeys) {
    const plan = tblMergePlan(m, selKeys);
    if (!plan) return null;
    const ordered = plan.hit.slice().sort((a, b) => (a.y0 - b.y0) || (a.x0 - b.x0));
    const first = ordered[0];
    const texts = [];
    ordered.forEach(l => {
      const s = String(l.text === undefined || l.text === null ? '' : l.text).trim();
      if (s && !texts.includes(s)) texts.push(s);
    });
    const merged = {
      id: ++tblLeafSeq,
      r: first.r, c: first.c, rs: 1, cs: 1,
      x0: plan.rect.x0, x1: plan.rect.x1, y0: plan.rect.y0, y1: plan.rect.y1,
      text: texts.join(' '),
      style: Object.assign({}, first.style)
    };
    const hitIds = new Set(plan.hit.map(l => l.id));
    const out = plan.leaves.filter(l => !hitIds.has(l.id));
    out.push(merged);
    const res = tblRebuild(out);
    return { model: res, selection: tblSelectionFromIds(res, [merged.id]) };
  }

  // ---------- 분할 ----------
  // 선택된 각 셀을 "그 셀의 범위" 안에서만 정확히 n등분 한다 (주변 셀은 건드리지 않는다)
  function tblSplit(m, selKeys, nRows, nCols) {
    nRows = Math.max(1, Math.min(20, parseInt(nRows, 10) || 1));
    nCols = Math.max(1, Math.min(20, parseInt(nCols, 10) || 1));
    if (nRows === 1 && nCols === 1) return null;
    const leaves = tblLeaves(m);
    const targets = new Set(tblHitLeaves(leaves, selKeys).map(l => l.id));
    if (targets.size === 0) return null;
    const out = [];
    const firstIds = [];
    leaves.forEach(l => {
      if (!targets.has(l.id)) { out.push(l); return; }
      const w = l.x1 - l.x0, h = l.y1 - l.y0;
      for (let i = 0; i < nRows; i++) {
        for (let j = 0; j < nCols; j++) {
          const isFirst = (i === 0 && j === 0);
          const nl = {
            id: ++tblLeafSeq,
            r: l.r, c: l.c, rs: 1, cs: 1,
            x0: l.x0 + w * j / nCols, x1: l.x0 + w * (j + 1) / nCols,
            y0: l.y0 + h * i / nRows, y1: l.y0 + h * (i + 1) / nRows,
            text: isFirst ? l.text : '',
            style: Object.assign({}, l.style)
          };
          out.push(nl);
          if (isFirst) firstIds.push(nl.id);
        }
      }
    });
    const res = tblRebuild(out);
    return { model: res, selection: tblSelectionFromIds(res, firstIds) };
  }

  // ---------- 테두리 드래그 ----------
  // orient: 'v'(세로 테두리, x 방향 이동) | 'h'(가로 테두리, y 방향 이동)
  // pos: 테두리의 좌표, along: 테두리 위에서 잡은 지점의 (반대 축) 좌표
  function tblPrepareLineDrag(m, orient, pos, along) {
    const leaves = tblLeaves(m);
    const v = orient === 'v';
    const a0 = v ? 'x0' : 'y0', a1 = v ? 'x1' : 'y1';
    const b0 = v ? 'y0' : 'x0', b1 = v ? 'y1' : 'x1';
    const ext = tblExtent(m);
    const totalAlong = v ? ext.h : ext.w;

    const edge = leaves.filter(l => Math.abs(l[a1] - pos) <= TBL_EPS || Math.abs(l[a0] - pos) <= TBL_EPS);
    const sorted = edge.map(l => [l[b0], l[b1]]).sort((p, q) => p[0] - q[0]);
    const comps = [];
    sorted.forEach(iv => {
      const last = comps[comps.length - 1];
      if (last && iv[0] <= last.hi + TBL_EPS) last.hi = Math.max(last.hi, iv[1]);
      else comps.push({ lo: iv[0], hi: iv[1] });
    });
    const comp = comps.find(c => along >= c.lo - TBL_EPS && along <= c.hi + TBL_EPS);
    if (!comp) return null;

    const inComp = l => l[b0] >= comp.lo - TBL_EPS && l[b1] <= comp.hi + TBL_EPS;
    const before = edge.filter(l => Math.abs(l[a1] - pos) <= TBL_EPS && inComp(l));
    const after = edge.filter(l => Math.abs(l[a0] - pos) <= TBL_EPS && inComp(l));
    const full = comp.lo <= TBL_EPS && comp.hi >= totalAlong - TBL_EPS;
    const MIN = v ? TBL_MIN_W : TBL_MIN_H;
    const minBefore = before.length ? Math.min.apply(null, before.map(l => l[a1] - l[a0])) : Infinity;
    const minAfter = after.length ? Math.min.apply(null, after.map(l => l[a1] - l[a0])) : Infinity;
    const minD = isFinite(minBefore) ? -Math.max(0, minBefore - MIN) : -Infinity;
    const maxD = (after.length > 0 && isFinite(minAfter)) ? Math.max(0, minAfter - MIN) : Infinity;
    const lines = tblCluster(leaves.reduce((a, l) => a.concat([l[a0], l[a1]]), []))
      .filter(x => Math.abs(x - pos) > TBL_EPS);

    return {
      orient: orient, pos: pos, lo: comp.lo, hi: comp.hi, full: full,
      leaves: leaves, before: before, after: after, minD: minD, maxD: maxD, lines: lines
    };
  }

  // 마우스 이동량(rawD)을 한계/자석(주변 테두리에 맞춤) 규칙에 맞춰 실제 이동량으로 보정
  function tblResolveLineDrag(drag, rawD) {
    let d = rawD;
    if (d < drag.minD) d = drag.minD;
    if (d > drag.maxD) d = drag.maxD;
    let snapped = false;
    if (!drag.full) {
      let bestDist = Infinity, best = 0;
      drag.lines.forEach(x => {
        const cand = x - drag.pos;
        const dist = Math.abs(drag.pos + d - x);
        if (dist <= TBL_SNAP && dist < bestDist && cand >= drag.minD - TBL_EPS && cand <= drag.maxD + TBL_EPS) {
          bestDist = dist; best = cand; snapped = true;
        }
      });
      if (snapped) d = best;
    }
    if (!snapped) {
      d = Math.round(d);
      if (d < drag.minD) d = Math.ceil(drag.minD);
      if (d > drag.maxD) d = Math.floor(drag.maxD);
    }
    return d;
  }

  function tblApplyLineDrag(drag, d, selKeys) {
    if (Math.abs(d) < 0.01) return null;
    const v = drag.orient === 'v';
    const a0 = v ? 'x0' : 'y0', a1 = v ? 'x1' : 'y1';
    const leaves = tblCloneLeaves(drag.leaves);
    const beforeIds = new Set(drag.before.map(l => l.id));
    const afterIds = new Set(drag.after.map(l => l.id));
    leaves.forEach(l => {
      const inBefore = beforeIds.has(l.id);
      const inAfter = afterIds.has(l.id);
      if (inBefore) {
        l[a1] += d;
      }
      if (inAfter) {
        l[a0] += d;
      }
    });
    const ids = tblHitLeaves(leaves, selKeys).map(l => l.id);
    const res = tblRebuild(leaves);
    return { model: res, selection: tblSelectionFromIds(res, ids) };
  }

  // 마우스 위치 근처의 테두리(세로/가로) 찾기. 표의 왼쪽/위쪽 바깥 테두리는 제외
  function tblFindLineAt(m, relX, relY, tol) {
    const leaves = tblLeaves(m);
    const ext = tblExtent(m);
    let best = null;
    const consider = (orient, pos, along, dist) => {
      if (!best || dist < best.dist) best = { orient: orient, pos: pos, along: along, dist: dist };
    };
    leaves.forEach(l => {
      [l.x0, l.x1].forEach(x => {
        if (x <= TBL_EPS) return;
        if (relY >= l.y0 - 1 && relY <= l.y1 + 1) {
          const dist = Math.abs(relX - x);
          if (dist <= tol) consider('v', x, Math.max(l.y0, Math.min(l.y1, relY)), dist);
        }
      });
      [l.y0, l.y1].forEach(y => {
        if (y <= TBL_EPS) return;
        if (relX >= l.x0 - 1 && relX <= l.x1 + 1) {
          const dist = Math.abs(relY - y);
          if (dist <= tol) consider('h', y, Math.max(l.x0, Math.min(l.x1, relX)), dist);
        }
      });
    });
    return best;
  }

  // 이전 버전(cellSplits/subCellData)으로 저장된 표를 새 격자 모델로 변환
  function tblMigrateLegacySplits(data) {
    const rows = data.rows || 3, cols = data.cols || 3;
    const totalW = data.width || Math.min(cols * 220, 1000);
    const totalH = data.height || (rows * 56);
    const m = tblModelFromObj({
      rows: rows, cols: cols,
      width: totalW, height: totalH,
      colWidths: data.colWidths, rowHeights: data.rowHeights,
      merges: data.merges, tableData: data.tableData
    });
    TBL_PROP_NAMES.forEach(p => { m[p] = data[p] || {}; });
    const splits = data.cellSplits || {};
    const subData = data.subCellData || {};
    const leaves = tblLeaves(m);
    const out = [];
    let firstId = null;
    leaves.forEach(l => {
      const sp = splits[l.key];
      if (!sp || !((sp.rows || 1) > 1 || (sp.cols || 1) > 1)) { out.push(l); return; }
      const sR = sp.rows || 1, sC = sp.cols || 1;
      const rr = (sp.rowRatios && sp.rowRatios.length === sR) ? sp.rowRatios : Array(sR).fill(1 / sR);
      const cr = (sp.colRatios && sp.colRatios.length === sC) ? sp.colRatios : Array(sC).fill(1 / sC);
      const w = l.x1 - l.x0, h = l.y1 - l.y0;
      let yy = l.y0;
      for (let i = 0; i < sR; i++) {
        let xx = l.x0;
        for (let j = 0; j < sC; j++) {
          const sub = subData[`${l.key}_${i}_${j}`];
          const nl = {
            id: ++tblLeafSeq, r: l.r, c: l.c, rs: 1, cs: 1,
            x0: xx, x1: xx + cr[j] * w, y0: yy, y1: yy + rr[i] * h,
            text: sub !== undefined ? sub : ((i === 0 && j === 0) ? l.text : ''),
            style: Object.assign({}, l.style)
          };
          if (firstId === null) firstId = nl.id;
          out.push(nl);
          xx += cr[j] * w;
        }
        yy += rr[i] * h;
      }
    });
    const res = tblRebuild(out);
    const next = Object.assign({}, data, {
      rows: res.rows, cols: res.cols,
      colWidths: res.colWidths, rowHeights: res.rowHeights,
      merges: res.merges, tableData: res.tableData,
      width: res.colWidths.reduce((a, b) => a + b, 0),
      height: res.rowHeights.reduce((a, b) => a + b, 0),
      cellSplits: undefined, subCellData: undefined
    });
    TBL_PROP_NAMES.forEach(p => { next[p] = res[p]; });
    next.selectedCells = ['0_0'];
    next.selectedCell = { r: 0, c: 0 };
    return next;
  }
  // <TABLE_MODEL_END>

  // ================= 표 셀 병합/분리 헬퍼 =================
  function getMergeInfo(merges, r, c) {
    if (!Array.isArray(merges)) return null;
    for (let i = 0; i < merges.length; i++) {
      const m = merges[i];
      if (r >= m.r && r < m.r + (m.rowspan || 1) && c >= m.c && c < m.c + (m.colspan || 1)) {
        return {
          merge: m,
          isMaster: (r === m.r && c === m.c),
          index: i
        };
      }
    }
    return null;
  }

  // 선택된 셀들이 빈틈없는 하나의 직사각형을 이루거나, 분할된 서브셀인 경우 병합 가능
  function canMergeSelectedCells(tableObj) {
    if (!tableObj || !tableObj.isTable) return false;
    const selKeys = tableObj.selectedCells || [];
    if (selKeys.length === 0) return false;

    // 분할된 셀(서브셀)이 선택되어 있거나, 분할 이력이 있는 셀인 경우 항상 병합 가능
    const hasSplits = tableObj.cellSplits && Object.keys(tableObj.cellSplits).length > 0;
    if (hasSplits) {
      for (const k of selKeys) {
        if (tableObj.cellSplits[k]) return true;
        // 서브셀 키 형식: `${r}_${c}_${subR}_${subC}`
        const parts = k.split('_');
        if (parts.length >= 4) {
          const parentKey = `${parts[0]}_${parts[1]}`;
          if (tableObj.cellSplits[parentKey]) return true;
        }
      }
    }

    return tblCanMerge(tblModelFromObj(tableObj), selKeys);
  }

  // 선택된 영역이 셀 분할 대상이 될 수 있는지 검사 (선택된 셀이 하나라도 있으면 분할 가능)
  function canSplitSelectedCells(tableObj) {
    if (!tableObj || !tableObj.isTable) return false;
    const selKeys = tableObj.selectedCells || [];
    return selKeys.length > 0;
  }

  // 모델 계산 결과(격자, 병합, 서식, 선택 상태)를 표 객체에 반영
  function applyTableModelResult(tableObj, result) {
    tblAssignModel(tableObj, result.model);
    tableObj.selectedCells = result.selection.selectedCells;
    tableObj.selectedCell = result.selection.selectedCell;
    tableObj.anchorCell = result.selection.selectedCell;
  }

  function mergeSelectedCells(tableObj) {
    if (!tableObj || !tableObj.isTable) return;
    const selKeys = tableObj.selectedCells || [];
    if (selKeys.length === 0) return;

    // 1. 분할된 서브셀 병합 처리: 선택된 키 중 cellSplits에 속한 것이 있는지 확인
    let mergedSplit = false;
    if (tableObj.cellSplits) {
      const parentKeysToMerge = new Set();
      selKeys.forEach(k => {
        if (tableObj.cellSplits[k]) parentKeysToMerge.add(k);
        const parts = k.split('_');
        if (parts.length >= 4) {
          const pk = `${parts[0]}_${parts[1]}`;
          if (tableObj.cellSplits[pk]) parentKeysToMerge.add(pk);
        }
      });

      if (parentKeysToMerge.size > 0) {
        parentKeysToMerge.forEach(pk => {
          const [pr, pc] = pk.split('_').map(Number);
          const sp = tableObj.cellSplits[pk];
          const texts = [];
          if (tableObj.subCellData) {
            for (let i = 0; i < (sp.rows || 1); i++) {
              for (let j = 0; j < (sp.cols || 1); j++) {
                const subKey = `${pk}_${i}_${j}`;
                const t = String(tableObj.subCellData[subKey] || '').trim();
                if (t && !texts.includes(t)) texts.push(t);
                delete tableObj.subCellData[subKey];
              }
            }
          }
          if (!tableObj.tableData[pr]) tableObj.tableData[pr] = [];
          tableObj.tableData[pr][pc] = texts.join(' ') || (tableObj.tableData[pr][pc] || '');
          delete tableObj.cellSplits[pk];
        });

        const firstParent = Array.from(parentKeysToMerge)[0];
        const [fpr, fpc] = firstParent.split('_').map(Number);
        tableObj.selectedCell = { r: fpr, c: fpc, isSubCell: false, key: firstParent };
        tableObj.selectedCells = [firstParent];
        rebuildTableGroup(tableObj);
        saveCurrentSlideState();
        recordHistory();
        showToast('분할되었던 셀이 하나로 병합되었습니다.');
        return;
      }
    }

    // 2. 일반 메인 직사각형 셀 병합
    const result = canMergeSelectedCells(tableObj)
      ? tblMerge(tblModelFromObj(tableObj), selKeys)
      : null;
    if (!result) {
      showToast('인접한 연속된 직사각형 형태의 셀들만 병합할 수 있습니다 (떨어져 있는 셀은 불가).');
      return;
    }
    applyTableModelResult(tableObj, result);
    rebuildTableGroup(tableObj);
    saveCurrentSlideState();
    recordHistory();
    showToast('선택한 셀이 하나로 병합되었습니다.');
  }

  function splitSelectedCells(tableObj) {
    if (!canSplitSelectedCells(tableObj)) {
      showToast('선택한 영역에 분리할 수 있는 셀이 없습니다.');
      return;
    }

    // 모달 팝업을 띄워 사용자가 지정한 [몇 행, 몇 열]로 분할을 수행하도록 일원화
    window.openSplitCellModal(tableObj);
  }

  // 선택한 셀을 "그 셀의 고유 범위 안에서만" 정확히 n분의 1로 균등 분할한다!
  // 표 전체의 rows/cols나 주변 셀의 높이/너비는 단 1px도 건드리지 않으므로 주변 셀에 영향이 절대 없다.
  function partitionSingleCell(tableObj, doRow, rowCount, doCol, colCount) {
    if (!tableObj || !tableObj.isTable) return;
    if (!doRow && !doCol) {
      showToast('분할할 행 또는 열을 최소 하나 이상 선택해주세요.');
      return;
    }

    const targetRows = doRow ? Math.max(2, Math.min(10, parseInt(rowCount, 10) || 2)) : 1;
    const targetCols = doCol ? Math.max(2, Math.min(10, parseInt(colCount, 10) || 2)) : 1;

    const sel = tableObj.selectedCell || { r: 0, c: 0 };
    // 병합된 마스터 셀 기준
    const mInfo = getMergeInfo(tableObj.merges, sel.r, sel.c);
    const masterR = mInfo ? mInfo.merge.r : sel.r;
    const masterC = mInfo ? mInfo.merge.c : sel.c;
    const cellKey = `${masterR}_${masterC}`;

    if (!tableObj.cellSplits) tableObj.cellSplits = {};
    if (!tableObj.subCellData) tableObj.subCellData = {};

    // 기존 텍스트 보존
    let existingText = (tableObj.tableData && tableObj.tableData[masterR])
      ? (tableObj.tableData[masterR][masterC] || '')
      : '';
    if (tableObj.cellSplits[cellKey]) {
      // 기존에 분할되어 있던 셀이면 서브셀 텍스트들을 모아서 보존
      const oldSp = tableObj.cellSplits[cellKey];
      const oldTexts = [];
      for (let i = 0; i < (oldSp.rows || 1); i++) {
        for (let j = 0; j < (oldSp.cols || 1); j++) {
          const sk = `${cellKey}_${i}_${j}`;
          const val = String(tableObj.subCellData[sk] || '').trim();
          if (val && !oldTexts.includes(val)) oldTexts.push(val);
          delete tableObj.subCellData[sk];
        }
      }
      if (oldTexts.length > 0) existingText = oldTexts.join(' ');
    }

    // 정확히 n분의 1 균등 분할 비율 설정!
    tableObj.cellSplits[cellKey] = {
      rows: targetRows,
      cols: targetCols,
      rowRatios: Array(targetRows).fill(1 / targetRows),
      colRatios: Array(targetCols).fill(1 / targetCols)
    };

    // (0, 0) 서브셀에 기존 텍스트 부여
    tableObj.subCellData[`${cellKey}_0_0`] = existingText;
    for (let i = 0; i < targetRows; i++) {
      for (let j = 0; j < targetCols; j++) {
        const sk = `${cellKey}_${i}_${j}`;
        if (tableObj.subCellData[sk] === undefined) tableObj.subCellData[sk] = '';
      }
    }

    tableObj.selectedCell = {
      r: masterR,
      c: masterC,
      isSubCell: true,
      subR: 0,
      subC: 0,
      key: `${cellKey}_0_0`,
      parentKey: cellKey
    };
    tableObj.selectedCells = [`${cellKey}_0_0`];

    rebuildTableGroup(tableObj);
    saveCurrentSlideState();
    recordHistory();

    const desc = [];
    if (targetRows >= 2) desc.push(`${targetRows}행`);
    if (targetCols >= 2) desc.push(`${targetCols}열`);
    showToast(`선택한 셀이 ${desc.join(' × ')}로 균등 분할되었습니다.`);
  }

  function shiftTablePropertiesForColSplit(obj, targetC, addCols) {
    const propNames = ['cellFills', 'cellColors', 'cellBorderColors', 'cellBorderWidths', 'cellFonts', 'cellFontSizes', 'cellBolds', 'cellItalics', 'cellUnderlines', 'cellAligns'];
    propNames.forEach(prop => {
      if (!obj[prop]) return;
      const oldMap = obj[prop];
      const newMap = {};
      Object.keys(oldMap).forEach(key => {
        const parts = key.split('_');
        const r = parseInt(parts[0], 10);
        let c = parseInt(parts[1], 10);
        if (c > targetC) {
          newMap[`${r}_${c + addCols}`] = oldMap[key];
        } else {
          newMap[key] = oldMap[key];
        }
      });
      obj[prop] = newMap;
    });
  }

  function shiftTablePropertiesForRowSplit(obj, targetR, addRows) {
    const propNames = ['cellFills', 'cellColors', 'cellBorderColors', 'cellBorderWidths', 'cellFonts', 'cellFontSizes', 'cellBolds', 'cellItalics', 'cellUnderlines', 'cellAligns'];
    propNames.forEach(prop => {
      if (!obj[prop]) return;
      const oldMap = obj[prop];
      const newMap = {};
      Object.keys(oldMap).forEach(key => {
        const parts = key.split('_');
        let r = parseInt(parts[0], 10);
        const c = parseInt(parts[1], 10);
        if (r > targetR) {
          newMap[`${r + addRows}_${c}`] = oldMap[key];
        } else {
          newMap[key] = oldMap[key];
        }
      });
      obj[prop] = newMap;
    });
  }

  window.openSplitCellModal = function (tableObj) {
    if (!tableObj) tableObj = canvas ? canvas.getActiveObject() : null;
    if (!tableObj || !tableObj.isTable) return;
    const modal = document.getElementById('splitCellModalOverlay');
    if (!modal) return;
    const rowCheck = document.getElementById('modalSplitRowCheck');
    const colCheck = document.getElementById('modalSplitColCheck');
    const rowInput = document.getElementById('modalSplitRowCount');
    const colInput = document.getElementById('modalSplitColCount');

    const selCell = tableObj.selectedCell || { r: 0, c: 0 };
    const mInfo = getMergeInfo(tableObj.merges, selCell.r, selCell.c);
    const curRowSpan = mInfo ? (mInfo.merge.rowspan || 1) : 1;
    const curColSpan = mInfo ? (mInfo.merge.colspan || 1) : 1;

    if (rowCheck) rowCheck.checked = (curRowSpan > 1 || curColSpan <= 1);
    if (colCheck) colCheck.checked = (curColSpan > 1 || curRowSpan <= 1);
    if (rowInput) rowInput.value = Math.max(2, curRowSpan);
    if (colInput) colInput.value = Math.max(2, curColSpan);

    modal.style.display = 'flex';
    if (rowInput) {
      rowInput.focus();
      rowInput.select();
    }
  };

  window.closeSplitCellModal = function (e) {
    if (e && e.target && e.target.id !== 'splitCellModalOverlay' && !e.target.classList.contains('modal-close-btn') && e.target.tagName !== 'BUTTON') {
      return;
    }
    const modal = document.getElementById('splitCellModalOverlay');
    if (modal) modal.style.display = 'none';
  };

  window.confirmSplitCellModal = function () {
    const obj = canvas ? canvas.getActiveObject() : null;
    if (!obj || !obj.isTable) {
      window.closeSplitCellModal();
      return;
    }
    const rowCheck = document.getElementById('modalSplitRowCheck');
    const colCheck = document.getElementById('modalSplitColCheck');
    const rowInput = document.getElementById('modalSplitRowCount');
    const colInput = document.getElementById('modalSplitColCount');

    const doRow = !!(rowCheck && rowCheck.checked);
    const doCol = !!(colCheck && colCheck.checked);
    const rowCount = rowInput ? parseInt(rowInput.value, 10) : 2;
    const colCount = colInput ? parseInt(colInput.value, 10) : 2;

    if (!doRow && !doCol) {
      showToast('행 또는 열 중 최소 하나 이상을 체크해 주세요.');
      return;
    }

    window.closeSplitCellModal();
    partitionSingleCell(obj, doRow, rowCount, doCol, colCount);
  };

  window.executeCellSplitFromUI = function () {
    const obj = canvas ? canvas.getActiveObject() : null;
    if (!obj || !obj.isTable) return;
    const rowCheck = document.getElementById('flyoutSplitRowCheck');
    const colCheck = document.getElementById('flyoutSplitColCheck');
    const rowInput = document.getElementById('flyoutSplitRowCount');
    const colInput = document.getElementById('flyoutSplitColCount');

    const doRow = !!(rowCheck && rowCheck.checked);
    const doCol = !!(colCheck && colCheck.checked);
    const rowCount = rowInput ? parseInt(rowInput.value, 10) : 2;
    const colCount = colInput ? parseInt(colInput.value, 10) : 2;

    if (!doRow && !doCol) {
      showToast('행 또는 열 중 최소 하나 이상을 체크해 주세요.');
      return;
    }

    partitionSingleCell(obj, doRow, rowCount, doCol, colCount);
  };

  function createFabricTableGroup(data) {
    const rows = data.rows || 3;
    const cols = data.cols || 3;
    const left = data.left !== undefined ? data.left : 400;
    const top = data.top !== undefined ? data.top : 280;
    const totalW = data.width || Math.min(cols * 220, 1000);
    const totalH = data.height || (rows * 56);

    const cellSplits = data.cellSplits ? JSON.parse(JSON.stringify(data.cellSplits)) : {};
    const subCellData = data.subCellData ? JSON.parse(JSON.stringify(data.subCellData)) : {};

    // 열별 너비(colWidths) 및 행별 높이(rowHeights) 독립 관리
    const colWidths = (data.colWidths && data.colWidths.length === cols)
      ? [...data.colWidths]
      : Array(cols).fill(totalW / cols);
    const rowHeights = (data.rowHeights && data.rowHeights.length === rows)
      ? [...data.rowHeights]
      : Array(rows).fill(totalH / rows);

    // 다중 선택 셀 목록 (Ctrl+클릭 및 전체 선택 대응)
    const selectedCells = Array.isArray(data.selectedCells) && data.selectedCells.length > 0
      ? [...data.selectedCells]
      : (data.selectedCell ? [`${data.selectedCell.r}_${data.selectedCell.c}`] : ['0_0']);

    // 셀 병합 정보 복원 [{ r, c, rowspan, colspan }]
    const merges = Array.isArray(data.merges)
      ? data.merges.map(m => ({ r: m.r, c: m.c, rowspan: m.rowspan || 1, colspan: m.colspan || 1 }))
      : [];

    const tableData = data.tableData || generateDefaultTableData(rows, cols);
    const cellFills = data.cellFills || {};
    const cellColors = data.cellColors || {};
    const cellBorderColors = data.cellBorderColors || {};
    const cellBorderWidths = data.cellBorderWidths || {};
    const cellFonts = data.cellFonts || {};
    const cellFontSizes = data.cellFontSizes || {};
    const cellBolds = data.cellBolds || {};
    const cellItalics = data.cellItalics || {};
    const cellUnderlines = data.cellUnderlines || {};
    const cellAligns = data.cellAligns || {};
    const tableFontFamily = data.tableFontFamily || '맑은 고딕';
    const elements = [];

    // 각 열의 x좌표 및 각 행의 y좌표 누적합 사전 계산
    const colX = [0];
    for (let c = 0; c < cols; c++) colX.push(colX[c] + colWidths[c]);
    const rowY = [0];
    for (let r = 0; r < rows; r++) rowY.push(rowY[r] + rowHeights[r]);

    const actualTotalW = colX[cols];
    const actualTotalH = rowY[rows];

    const highlightElements = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const mInfo = getMergeInfo(merges, r, c);
        // 병합되어 마스터 셀 아래/오른쪽에 가려진 셀은 개별 배경/텍스트를 그리지 않음
        if (mInfo && !mInfo.isMaster) {
          continue;
        }

        const isMergedMaster = mInfo && mInfo.isMaster;
        const rowspan = isMergedMaster ? mInfo.merge.rowspan : 1;
        const colspan = isMergedMaster ? mInfo.merge.colspan : 1;

        const cellLeft = colX[c];
        const cellTop = rowY[r];
        const cellW = colX[c + colspan] - colX[c];
        const cellH = rowY[r + rowspan] - rowY[r];
        const isHeader = (r === 0);
        const cellKey = `${r}_${c}`;

        const fill = (cellFills[cellKey] !== undefined) ? cellFills[cellKey] : (isHeader ? '#1E293B' : (r % 2 === 1 ? '#FFFFFF' : '#F8FAFC'));
        const textColor = cellColors[cellKey] || (isHeader ? '#FFFFFF' : '#334155');
        const strokeColor = (cellBorderColors[cellKey] !== undefined) ? cellBorderColors[cellKey] : '#CBD5E1';
        const strokeWidthPt = (cellBorderWidths[cellKey] !== undefined) ? cellBorderWidths[cellKey] : 1;
        const fontFamily = cellFonts[cellKey] || tableFontFamily;
        const fontSize = cellFontSizes[cellKey] || (isHeader ? 16 : 14);
        const isBold = (cellBolds[cellKey] !== undefined) ? cellBolds[cellKey] : isHeader;
        const isItalic = !!cellItalics[cellKey];
        const isUnderline = !!cellUnderlines[cellKey];
        const align = cellAligns[cellKey] || 'center';
        const val = (tableData[r] && tableData[r][c] !== undefined) ? String(tableData[r][c]) : (isHeader ? `항목 ${c + 1}` : `내용`);

        // 분할 이력(cellSplits)이 있는 셀인 경우, 그 셀의 고유 사각형 안에서만 독립 n등분 서브셀 렌더링!
        const sp = cellSplits && cellSplits[cellKey];
        if (sp && ((sp.rows || 1) > 1 || (sp.cols || 1) > 1)) {
          const sR = sp.rows || 1;
          const sC = sp.cols || 1;
          const rr = (sp.rowRatios && sp.rowRatios.length === sR) ? sp.rowRatios : Array(sR).fill(1 / sR);
          const cr = (sp.colRatios && sp.colRatios.length === sC) ? sp.colRatios : Array(sC).fill(1 / sC);

          let curY = cellTop;
          for (let i = 0; i < sR; i++) {
            const subH = cellH * rr[i];
            let curX = cellLeft;
            for (let j = 0; j < sC; j++) {
              const subW = cellW * cr[j];
              const subKey = `${cellKey}_${i}_${j}`;

              const subRect = new fabric.Rect({
                left: curX,
                top: curY,
                width: subW,
                height: subH,
                fill: fill,
                stroke: strokeColor,
                strokeWidth: Math.max(0, strokeWidthPt * PX_PER_PT)
              });
              subRect.isCellRect = true;
              subRect.cellKey = subKey;
              subRect.parentCellKey = cellKey;
              subRect.isSubCell = true;
              subRect.subR = i;
              subRect.subC = j;
              elements.push(subRect);

              const subVal = (subCellData && subCellData[subKey] !== undefined)
                ? String(subCellData[subKey])
                : (i === 0 && j === 0 ? val : '');

              let textLeft = curX + subW / 2;
              let originX = 'center';
              if (align === 'left') {
                textLeft = curX + 12;
                originX = 'left';
              } else if (align === 'right') {
                textLeft = curX + subW - 12;
                originX = 'right';
              }

              const subText = new fabric.Text(subVal, {
                left: textLeft,
                top: curY + subH / 2,
                originX: originX,
                originY: 'center',
                fontSize: fontSize,
                fontWeight: isBold ? 'bold' : 'normal',
                fontStyle: isItalic ? 'italic' : 'normal',
                underline: isUnderline,
                fill: textColor,
                fontFamily: fontFamily,
                textAlign: align
              });
              subText.isCellText = true;
              subText.cellKey = subKey;
              subText.isSubCell = true;
              subText.subR = i;
              subText.subC = j;
              elements.push(subText);

              const isSubSelected = selectedCells.includes(subKey) || selectedCells.includes(cellKey);
              const subHl = new fabric.Rect({
                left: curX,
                top: curY,
                width: subW,
                height: subH,
                fill: isSubSelected ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
                stroke: isSubSelected ? '#0284C7' : 'transparent',
                strokeWidth: 2.5,
                selectable: false,
                evented: false,
                isCellHighlight: true,
                cellKey: subKey,
                coverKeys: [subKey],
                visible: true,
                opacity: isSubSelected ? 1 : 0
              });
              highlightElements.push(subHl);

              curX += subW;
            }
            curY += subH;
          }
        } else {
          // 분할되지 않은 일반 단일/병합 셀 렌더링
          const rect = new fabric.Rect({
            left: cellLeft,
            top: cellTop,
            width: cellW,
            height: cellH,
            fill: fill,
            stroke: strokeColor,
            strokeWidth: Math.max(0, strokeWidthPt * PX_PER_PT)
          });
          rect.isCellRect = true;
          rect.cellKey = cellKey;
          elements.push(rect);

          let textLeft = cellLeft + cellW / 2;
          let originX = 'center';
          if (align === 'left') {
            textLeft = cellLeft + 12;
            originX = 'left';
          } else if (align === 'right') {
            textLeft = cellLeft + cellW - 12;
            originX = 'right';
          }

          const text = new fabric.Text(val, {
            left: textLeft,
            top: cellTop + cellH / 2,
            originX: originX,
            originY: 'center',
            fontSize: fontSize,
            fontWeight: isBold ? 'bold' : 'normal',
            fontStyle: isItalic ? 'italic' : 'normal',
            underline: isUnderline,
            fill: textColor,
            fontFamily: fontFamily,
            textAlign: align
          });
          text.isCellText = true;
          text.cellKey = cellKey;
          elements.push(text);

          // 마스터 셀이 커버하는 모든 셀 키 목록
          const coverKeys = [];
          for (let mr = r; mr < r + rowspan; mr++) {
            for (let mc = c; mc < c + colspan; mc++) {
              coverKeys.push(`${mr}_${mc}`);
            }
          }
          const isSelected = coverKeys.some(k => selectedCells.includes(k));

          const hl = new fabric.Rect({
            left: cellLeft,
            top: cellTop,
            width: cellW,
            height: cellH,
            fill: isSelected ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
            stroke: isSelected ? '#0284C7' : 'transparent',
            strokeWidth: 2.5,
            selectable: false,
            evented: false,
            isCellHighlight: true,
            cellKey: cellKey,
            coverKeys: coverKeys,
            visible: true,
            opacity: isSelected ? 1 : 0
          });
          highlightElements.push(hl);
        }
      }
    }

    // 하이라이트는 텍스트와 배경 위에 오도록 마지막에 추가
    highlightElements.forEach(hl => elements.push(hl));

    const group = new fabric.Group(elements, {
      left: left,
      top: top,
      width: actualTotalW,
      height: actualTotalH,
      angle: data.angle || 0,
      opacity: data.opacity !== undefined ? data.opacity : 1,
      id: data.id || `el-table-${Date.now()}`
    });
    group.isTable = true;
    group.tableRows = rows;
    group.tableCols = cols;
    group.colWidths = colWidths;
    group.rowHeights = rowHeights;
    group.tableData = tableData;
    group.merges = merges;
    group.cellSplits = cellSplits;
    group.subCellData = subCellData;
    group.cellFills = cellFills;
    group.cellColors = cellColors;
    group.cellBorderColors = cellBorderColors;
    group.cellBorderWidths = cellBorderWidths;
    group.cellFonts = cellFonts;
    group.cellFontSizes = cellFontSizes;
    group.cellBolds = cellBolds;
    group.cellItalics = cellItalics;
    group.cellUnderlines = cellUnderlines;
    group.cellAligns = cellAligns;
    group.tableFontFamily = tableFontFamily;
    group.selectedCells = selectedCells;
    group.selectedCell = data.selectedCell || (selectedCells[0] ? { r: parseInt(selectedCells[0].split('_')[0], 10), c: parseInt(selectedCells[0].split('_')[1], 10) } : { r: 0, c: 0 });
    return group;
  }

  function updateTableHighlights(tableGroup) {
    if (!tableGroup || !tableGroup.isTable || !tableGroup.getObjects) return;
    const selKeys = tableGroup.selectedCells || [];
    tableGroup.getObjects().forEach(child => {
      if (child.isCellHighlight) {
        const keys = child.coverKeys || [child.cellKey];
        const active = keys.some(k => selKeys.includes(k));
        child.set({
          visible: true,
          opacity: active ? 1 : 0,
          fill: active ? 'rgba(56, 189, 248, 0.25)' : 'transparent',
          stroke: active ? '#0284C7' : 'transparent',
          dirty: true
        });
      }
    });
    tableGroup.dirty = true;
    if (canvas) {
      canvas.requestRenderAll();
      canvas.renderAll();
    }
  }

  function getTableCellFromPointer(tableObj, pointer) {
    if (!tableObj || !tableObj.isTable) return { r: 0, c: 0, key: '0_0', isSubCell: false };
    const scaleX = tableObj.scaleX || 1;
    const scaleY = tableObj.scaleY || 1;
    const relX = (pointer.x - tableObj.left) / scaleX;
    const relY = (pointer.y - tableObj.top) / scaleY;

    const cols = tableObj.tableCols || 3;
    const rows = tableObj.tableRows || 3;
    const colWidths = (tableObj.colWidths && tableObj.colWidths.length === cols)
      ? tableObj.colWidths
      : Array(cols).fill((tableObj.width || 1000) / cols);
    const rowHeights = (tableObj.rowHeights && tableObj.rowHeights.length === rows)
      ? tableObj.rowHeights
      : Array(rows).fill((tableObj.height || (rows * 56)) / rows);

    let accumW = 0, foundC = cols - 1;
    for (let c = 0; c < cols; c++) {
      accumW += colWidths[c];
      if (relX <= accumW) {
        foundC = c;
        break;
      }
    }

    let accumH = 0, foundR = rows - 1;
    for (let r = 0; r < rows; r++) {
      accumH += rowHeights[r];
      if (relY <= accumH) {
        foundR = r;
        break;
      }
    }

    const clampedR = Math.max(0, Math.min(rows - 1, foundR));
    const clampedC = Math.max(0, Math.min(cols - 1, foundC));

    // 병합된 셀 안을 가리키면 마스터 셀을 대표 좌표로 사용
    const mInfo = getMergeInfo(tableObj.merges, clampedR, clampedC);
    const masterR = mInfo ? mInfo.merge.r : clampedR;
    const masterC = mInfo ? mInfo.merge.c : clampedC;
    const cellKey = `${masterR}_${masterC}`;

    // 서브셀(cellSplits)이 있는 셀인 경우, 서브셀 좌표 판정!
    const sp = tableObj.cellSplits && tableObj.cellSplits[cellKey];
    if (sp && ((sp.rows || 1) > 1 || (sp.cols || 1) > 1)) {
      const sR = sp.rows || 1;
      const sC = sp.cols || 1;
      const rr = (sp.rowRatios && sp.rowRatios.length === sR) ? sp.rowRatios : Array(sR).fill(1 / sR);
      const cr = (sp.colRatios && sp.colRatios.length === sC) ? sp.colRatios : Array(sC).fill(1 / sC);

      const rowspan = mInfo ? (mInfo.merge.rowspan || 1) : 1;
      const colspan = mInfo ? (mInfo.merge.colspan || 1) : 1;

      let cellLeft = 0;
      for (let ci = 0; ci < masterC; ci++) cellLeft += colWidths[ci];
      let cellTop = 0;
      for (let ri = 0; ri < masterR; ri++) cellTop += rowHeights[ri];

      let cellW = 0;
      for (let ci = masterC; ci < masterC + colspan; ci++) cellW += colWidths[ci];
      let cellH = 0;
      for (let ri = masterR; ri < masterR + rowspan; ri++) cellH += rowHeights[ri];

      const inX = Math.max(0, Math.min(cellW, relX - cellLeft));
      const inY = Math.max(0, Math.min(cellH, relY - cellTop));

      let curY = 0, subR = sR - 1;
      for (let i = 0; i < sR; i++) {
        curY += cellH * rr[i];
        if (inY <= curY) { subR = i; break; }
      }

      let curX = 0, subC = sC - 1;
      for (let j = 0; j < sC; j++) {
        curX += cellW * cr[j];
        if (inX <= curX) { subC = j; break; }
      }

      return {
        r: masterR,
        c: masterC,
        isSubCell: true,
        subR: subR,
        subC: subC,
        key: `${cellKey}_${subR}_${subC}`,
        parentKey: cellKey
      };
    }

    return {
      r: masterR,
      c: masterC,
      key: cellKey,
      isSubCell: false
    };
  }

  function openTableCellEditor(tableObj, cellOrR, c) {
    const editor = document.getElementById('tableCellEditor');
    if (!editor || !tableObj || !tableObj.isTable) return;

    const r = (typeof cellOrR === 'object' && cellOrR !== null) ? cellOrR.r : (cellOrR !== undefined ? cellOrR : 0);
    const col = (typeof cellOrR === 'object' && cellOrR !== null) ? cellOrR.c : (c !== undefined ? c : 0);
    const isSub = (typeof cellOrR === 'object' && cellOrR !== null && cellOrR.isSubCell);
    const subKey = isSub ? cellOrR.key : null;
    const subR = isSub ? cellOrR.subR : 0;
    const subC = isSub ? cellOrR.subC : 0;

    // 병합 영역 확인하여 마스터 셀 기준으로 크기/위치 산출
    const mInfo = getMergeInfo(tableObj.merges, r, col);
    const masterR = mInfo ? mInfo.merge.r : r;
    const masterC = mInfo ? mInfo.merge.c : col;
    const cellKey = `${masterR}_${masterC}`;
    const rowspan = mInfo ? (mInfo.merge.rowspan || 1) : 1;
    const colspan = mInfo ? (mInfo.merge.colspan || 1) : 1;

    const scaleX = tableObj.scaleX || 1;
    const scaleY = tableObj.scaleY || 1;

    const cols = tableObj.tableCols || 3;
    const rows = tableObj.tableRows || 3;
    const colWidths = (tableObj.colWidths && tableObj.colWidths.length === cols)
      ? tableObj.colWidths
      : Array(cols).fill((tableObj.width || 1000) / cols);
    const rowHeights = (tableObj.rowHeights && tableObj.rowHeights.length === rows)
      ? tableObj.rowHeights
      : Array(rows).fill((tableObj.height || (rows * 56)) / rows);

    let accumLeft = 0;
    for (let ci = 0; ci < masterC; ci++) accumLeft += colWidths[ci];
    let accumTop = 0;
    for (let ri = 0; ri < masterR; ri++) accumTop += rowHeights[ri];

    let cellW = 0;
    for (let ci = masterC; ci < masterC + colspan; ci++) cellW += colWidths[ci];
    let cellH = 0;
    for (let ri = masterR; ri < masterR + rowspan; ri++) cellH += rowHeights[ri];

    let targetLeft = accumLeft;
    let targetTop = accumTop;
    let targetW = cellW;
    let targetH = cellH;

    if (isSub && tableObj.cellSplits && tableObj.cellSplits[cellKey]) {
      const sp = tableObj.cellSplits[cellKey];
      const sR = sp.rows || 1;
      const sC = sp.cols || 1;
      const rr = (sp.rowRatios && sp.rowRatios.length === sR) ? sp.rowRatios : Array(sR).fill(1 / sR);
      const cr = (sp.colRatios && sp.colRatios.length === sC) ? sp.colRatios : Array(sC).fill(1 / sC);

      let subTopOffset = 0;
      for (let i = 0; i < subR; i++) subTopOffset += cellH * rr[i];
      let subLeftOffset = 0;
      for (let j = 0; j < subC; j++) subLeftOffset += cellW * cr[j];

      targetTop = accumTop + subTopOffset;
      targetLeft = accumLeft + subLeftOffset;
      targetW = cellW * cr[subC];
      targetH = cellH * rr[subR];
    }

    const absLeft = (tableObj.left + targetLeft * scaleX) * canvasScale;
    const absTop = (tableObj.top + targetTop * scaleY) * canvasScale;
    const absW = (targetW * scaleX) * canvasScale;
    const absH = (targetH * scaleY) * canvasScale;

    editor.style.left = absLeft + 'px';
    editor.style.top = absTop + 'px';
    editor.style.width = Math.max(absW, 40) + 'px';
    editor.style.height = Math.max(absH, 28) + 'px';
    editor.style.display = 'block';

    let currentVal = '';
    if (isSub && subKey) {
      currentVal = (tableObj.subCellData && tableObj.subCellData[subKey] !== undefined) ? tableObj.subCellData[subKey] : '';
    } else {
      currentVal = (tableObj.tableData[masterR] && tableObj.tableData[masterR][masterC] !== undefined) ? tableObj.tableData[masterR][masterC] : '';
    }
    editor.value = currentVal;
    editor.focus();
    editor.select();

    let isDone = false;
    function finishEdit() {
      if (isDone || editor.style.display === 'none') return;
      isDone = true;
      const newVal = editor.value;
      editor.style.display = 'none';
      if (isSub && subKey) {
        if (!tableObj.subCellData) tableObj.subCellData = {};
        tableObj.subCellData[subKey] = newVal;
      } else {
        if (!tableObj.tableData[masterR]) tableObj.tableData[masterR] = [];
        tableObj.tableData[masterR][masterC] = newVal;
      }
      rebuildTableGroup(tableObj);
      saveCurrentSlideState();
      editor.removeEventListener('blur', finishEdit);
      editor.removeEventListener('keydown', onKeyDown);
    }

    function onKeyDown(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        finishEdit();
      } else if (e.key === 'Escape') {
        isDone = true;
        editor.style.display = 'none';
        editor.removeEventListener('blur', finishEdit);
        editor.removeEventListener('keydown', onKeyDown);
      }
    }

    editor.addEventListener('blur', finishEdit);
    editor.addEventListener('keydown', onKeyDown);
  }

  function rebuildTableGroup(tableGroup) {
    if (!tableGroup || !tableGroup.isTable) return null;
    const activeInput = document.activeElement;
    const isInputFocused = activeInput && (activeInput.tagName === 'INPUT' || activeInput.tagName === 'TEXTAREA');
    const inputStart = isInputFocused && activeInput.selectionStart !== undefined ? activeInput.selectionStart : null;
    const inputEnd = isInputFocused && activeInput.selectionEnd !== undefined ? activeInput.selectionEnd : null;

    const objs = canvas.getObjects();
    let idx = objs.indexOf(tableGroup);

    // 전달된 객체가 이미 지워졌다면 같은 ID를 가진 객체 검색하여 중복 잔상 원천 차단
    if (idx === -1 && tableGroup.id) {
      const existing = objs.find(o => o.id === tableGroup.id && o.isTable);
      if (existing) {
        idx = objs.indexOf(existing);
        tableGroup = existing;
      }
    }

    // 캔버스에 존재하지 않는 표라면 중복 생성(잔상) 방지를 위해 즉시 종료
    if (idx === -1) {
      return null;
    }

    const newGroup = createFabricTableGroup({
      id: tableGroup.id,
      left: tableGroup.left,
      top: tableGroup.top,
      width: (tableGroup.width || 1000) * (tableGroup.scaleX || 1),
      height: (tableGroup.height || (tableGroup.tableRows * 56)) * (tableGroup.scaleY || 1),
      rows: tableGroup.tableRows,
      cols: tableGroup.tableCols,
      colWidths: tableGroup.colWidths ? tableGroup.colWidths.map(w => w * (tableGroup.scaleX || 1)) : undefined,
      rowHeights: tableGroup.rowHeights ? tableGroup.rowHeights.map(h => h * (tableGroup.scaleY || 1)) : undefined,
      tableData: tableGroup.tableData,
      merges: tableGroup.merges,
      cellSplits: tableGroup.cellSplits,
      subCellData: tableGroup.subCellData,
      cellFills: tableGroup.cellFills,
      cellColors: tableGroup.cellColors,
      cellBorderColors: tableGroup.cellBorderColors,
      cellBorderWidths: tableGroup.cellBorderWidths,
      cellFonts: tableGroup.cellFonts,
      cellFontSizes: tableGroup.cellFontSizes,
      cellBolds: tableGroup.cellBolds,
      cellItalics: tableGroup.cellItalics,
      cellUnderlines: tableGroup.cellUnderlines,
      cellAligns: tableGroup.cellAligns,
      tableFontFamily: tableGroup.tableFontFamily,
      selectedCells: tableGroup.selectedCells,
      selectedCell: tableGroup.selectedCell,
      opacity: tableGroup.opacity !== undefined ? tableGroup.opacity : 1,
      angle: tableGroup.angle
    });

    canvas.remove(tableGroup);
    canvas.insertAt(newGroup, idx);
    canvas.setActiveObject(newGroup);
    canvas.renderAll();
    updateInspector(newGroup);

    if (isInputFocused && document.body.contains(activeInput)) {
      activeInput.focus();
      if (inputStart !== null && activeInput.setSelectionRange) {
        try { activeInput.setSelectionRange(inputStart, inputEnd); } catch (e) {}
      }
    }
    return newGroup;
  }

  function createFabricVideoGroup(data) {
    const left = data.left !== undefined ? data.left : 450;
    const top = data.top !== undefined ? data.top : 260;
    const totalW = data.width || 640;
    const totalH = data.height || 360;
    const title = data.videoTitle || '소개 동영상.mp4';
    const duration = data.duration || '03:45';

    const elements = [];

    // 배경 카드
    const bg = new fabric.Rect({
      left: 0,
      top: 0,
      width: totalW,
      height: totalH,
      fill: '#0F172A',
      stroke: '#334155',
      strokeWidth: 2,
      rx: 12,
      ry: 12
    });
    elements.push(bg);

    // 내부 스크린
    const innerScreen = new fabric.Rect({
      left: 14,
      top: 14,
      width: totalW - 28,
      height: totalH - 68,
      fill: '#1E293B',
      rx: 8,
      ry: 8
    });
    elements.push(innerScreen);

    // 재생 원형 버튼
    const playCircle = new fabric.Circle({
      left: totalW / 2,
      top: (totalH - 68) / 2 + 14,
      originX: 'center',
      originY: 'center',
      radius: 32,
      fill: '#2563EB',
      stroke: '#38BDF8',
      strokeWidth: 2
    });
    elements.push(playCircle);

    // 재생 삼각 아이콘
    const playTriangle = new fabric.Triangle({
      left: totalW / 2 + 3,
      top: (totalH - 68) / 2 + 14,
      originX: 'center',
      originY: 'center',
      width: 22,
      height: 24,
      angle: 90,
      fill: '#FFFFFF'
    });
    elements.push(playTriangle);

    // 하단 제목
    const titleText = new fabric.Text(`🎬 ${title}`, {
      left: 20,
      top: totalH - 38,
      fontSize: 16,
      fontWeight: 'bold',
      fill: '#F8FAFC',
      fontFamily: '맑은 고딕'
    });
    elements.push(titleText);

    // 우측 재생시간 태그
    const durText = new fabric.Text(`▶ ${duration}`, {
      left: totalW - 24,
      top: totalH - 38,
      originX: 'right',
      fontSize: 14,
      fill: '#38BDF8',
      fontFamily: '맑은 고딕'
    });
    elements.push(durText);

    const group = new fabric.Group(elements, {
      left: left,
      top: top,
      width: totalW,
      height: totalH,
      id: data.id || `el-video-${Date.now()}`
    });
    group.isVideo = true;
    group.videoTitle = title;
    group.videoDuration = duration;
    group.videoSrc = data.videoSrc || null;
    group.posterSrc = data.posterSrc || null;
    return group;
  }

  function createFabricObjectFromData(data, callback) {
    if (data.type === 'table') {
      const tbl = createFabricTableGroup(data);
      callback(tbl);
      return;
    }

    if (data.type === 'video') {
      const vid = createFabricVideoGroup(data);
      callback(vid);
      return;
    }

    const common = {
      left: data.left || 0,
      top: data.top || 0,
      width: data.width,
      height: data.height,
      fill: data.fill || '#000000',
      opacity: data.opacity !== undefined ? data.opacity : 1,
      angle: data.angle || 0,
      id: data.id,
      role: data.role || null,
      stroke: data.stroke || null,
      strokeWidth: (data.strokeWidth || 0) * PX_PER_PT,
      strokeWidthPt: data.strokeWidth !== undefined ? data.strokeWidth : 0,
      strokeUniform: true // 스트로크 두께가 객체 크기/너비에 누적 합산되지 않도록 고정
    };

    if (data.type === 'text') {
      const fontSize = data.fontSize || 32;
      const lines = (data.text || '').split('\n');
      const maxLineLen = Math.max(...lines.map(l => l.length), 1);

      // 슬라이드 도화지(1920) 우측 경계를 벗어나지 않도록 클램핑
      const maxAllowedWidth = Math.max(80, CANVAS_WIDTH - (data.left || 0) - 50);

      let finalWidth;
      if (data.width && typeof data.width === 'number' && data.width > 0) {
        finalWidth = data.width; // 명시된 너비는 그대로 존중한다 (잘라내면 저장 시 데이터가 바뀐다)
      } else {
        const estimatedWidth = Math.ceil(maxLineLen * fontSize * 1.15) + 40;
        finalWidth = Math.min(estimatedWidth, maxAllowedWidth);
      }

      const tb = new fabric.Textbox(data.text || '텍스트', {
        ...common,
        stroke: null,
        strokeWidth: 0,
        backgroundColor: data.backgroundColor || 'transparent',
        width: finalWidth,
        scaleX: 1,
        scaleY: 1,
        fontSize: fontSize,
        fontFamily: data.fontFamily || '맑은 고딕',
        fontWeight: data.fontWeight || 'normal',
        fontStyle: data.fontStyle || 'normal',
        underline: !!data.underline,
        textAlign: data.align || 'left',
        splitByGrapheme: true,
        styles: data.styles || {}
      });
      tb.boxStroke = data.stroke || null;
      tb.boxStrokeWidth = (data.strokeWidth || 0) * PX_PER_PT;
      tb.strokeWidthPt = data.strokeWidth !== undefined ? data.strokeWidth : 0;
      tb.set({
        width: finalWidth,
        scaleX: 1,
        scaleY: 1
      });
      tb.setCoords();
      setupTextboxBehavior(tb);
      callback(tb);
    } else if (data.type === 'rect') {
      const obj = new fabric.Rect({
        ...common,
        strokeUniform: true,
        rx: data.rx || 0,
        ry: data.ry || 0
      });
      callback(obj);
    } else if (data.type === 'circle') {
      const obj = new fabric.Circle({
        ...common,
        strokeUniform: true,
        radius: (data.width || 100) / 2
      });
      if (data.height && data.width && data.height !== data.width) {
        obj.set('scaleY', data.height / data.width);
      }
      callback(obj);
    } else if (data.type === 'triangle') {
      const obj = new fabric.Triangle({
        ...common,
        strokeUniform: true,
        width: data.width || 200,
        height: data.height || 180
      });
      callback(obj);
    } else if (data.type === 'line') {
      const x1 = data.x1 !== undefined ? data.x1 : common.left;
      const y1 = data.y1 !== undefined ? data.y1 : common.top;
      const x2 = data.x2 !== undefined ? data.x2 : (common.left + (data.width || 300));
      const y2 = data.y2 !== undefined ? data.y2 : common.top;
      const lineWidthPt = data.strokeWidth !== undefined ? data.strokeWidth : 2;
      const obj = new fabric.Line([x1, y1, x2, y2], {
        stroke: data.stroke || '#2563EB',
        strokeWidth: lineWidthPt * PX_PER_PT,
        strokeLineCap: 'round',
        opacity: common.opacity,
        id: data.id
      });
      obj.strokeWidthPt = lineWidthPt;
      callback(obj);
    } else if (data.type === 'arrow') {
      const obj = new fabric.Path('M 0 35 L 140 35 L 140 0 L 240 50 L 140 100 L 140 65 L 0 65 Z', {
        ...common,
        width: 240,
        height: 100,
        scaleX: (data.width || 240) / 240,
        scaleY: (data.height || 100) / 100
      });
      obj.shapeSubtype = 'arrow';
      callback(obj);
    } else if (data.type === 'star') {
      const obj = new fabric.Polygon([
        {x: 100, y: 10}, {x: 125, y: 75}, {x: 195, y: 75},
        {x: 138, y: 115}, {x: 160, y: 180}, {x: 100, y: 140},
        {x: 40, y: 180}, {x: 62, y: 115}, {x: 5, y: 75}, {x: 75, y: 75}
      ], {
        ...common,
        scaleX: (data.width || 190) / 190,
        scaleY: (data.height || 170) / 170,
        fill: data.fill || '#FACC15'
      });
      obj.shapeSubtype = 'star';
      callback(obj);
    } else if (data.type === 'callout') {
      const obj = new fabric.Path('M 20 0 L 220 0 C 230 0 240 10 240 20 L 240 120 C 240 130 230 140 220 140 L 80 140 L 40 180 L 50 140 L 20 140 C 10 140 0 130 0 120 L 0 20 C 0 10 10 0 20 0 Z', {
        ...common,
        width: 240,
        height: 180,
        scaleX: (data.width || 240) / 240,
        scaleY: (data.height || 180) / 180,
        fill: data.fill || '#3B82F6'
      });
      obj.shapeSubtype = 'callout';
      callback(obj);
    } else if (data.type === 'group' && Array.isArray(data.objects)) {
      const kids = new Array(data.objects.length);
      let kidsLeft = data.objects.length;
      const buildGroup = () => {
        callback(new fabric.Group(kids.filter(Boolean), {
          left: data.left, top: data.top, angle: data.angle || 0,
          scaleX: data.scaleX || 1, scaleY: data.scaleY || 1,
          opacity: data.opacity !== undefined ? data.opacity : 1, id: data.id
        }));
      };
      if (kidsLeft === 0) { buildGroup(); return; }
      data.objects.forEach((child, i) => createFabricObjectFromData(child, o => {
        kids[i] = o;
        if (--kidsLeft === 0) buildGroup();
      }));
    } else if (data.type === 'image' && data.src) {
      fabric.Image.fromURL(data.src, function (img, isError) {
        if (isError || !img) { callback(null); return; }
        // width/height에 표시 크기를 넣으면 원본이 잘리므로, 원본 크기는 두고 배율로 복원한다
        img.set({
          left: common.left, top: common.top, angle: common.angle, opacity: common.opacity, id: common.id,
          scaleX: (data.width || img.width) / img.width,
          scaleY: (data.height || img.height) / img.height
        });
        callback(img);
      });
    } else {
      callback(null); // 알 수 없는 타입도 콜백을 호출해 로드가 멈추지 않게 한다
    }
  }

  // 다중 선택(ActiveSelection) 안의 개체는 left/top이 선택 영역 중심 기준 상대값이므로 캔버스 절대값으로 환산한다
  function getAbsoluteGeometry(obj) {
    if (!obj.group || obj.group.type !== 'activeSelection') {
      return { left: obj.left, top: obj.top, angle: obj.angle || 0, scaleX: obj.scaleX || 1, scaleY: obj.scaleY || 1 };
    }
    const t = fabric.util.qrDecompose(obj.calcTransformMatrix());
    const sw = obj.strokeUniform ? (obj.strokeWidth || 0) : 0;
    const w = obj.width * t.scaleX + sw;
    const h = obj.height * t.scaleY + sw;
    const rad = fabric.util.degreesToRadians(t.angle);
    return {
      left: t.translateX - (w / 2) * Math.cos(rad) + (h / 2) * Math.sin(rad),
      top: t.translateY - (w / 2) * Math.sin(rad) - (h / 2) * Math.cos(rad),
      angle: t.angle, scaleX: t.scaleX, scaleY: t.scaleY
    };
  }

  function exportFabricObjectToData(obj, index) {
    const geo = getAbsoluteGeometry(obj);
    if (obj.isTable) {
      const scaleX = obj.scaleX || 1;
      const scaleY = obj.scaleY || 1;
      const scaledW = Math.round(obj.getScaledWidth());
      const scaledH = Math.round(obj.getScaledHeight());
      const rows = obj.tableRows || 3;
      const cols = obj.tableCols || 3;

      let colWidths = [];
      if (obj.colWidths && obj.colWidths.length === cols) {
        colWidths = obj.colWidths.map(w => Math.round(w * scaleX));
      } else {
        colWidths = Array(cols).fill(Math.round(scaledW / cols));
      }

      let rowHeights = [];
      if (obj.rowHeights && obj.rowHeights.length === rows) {
        rowHeights = obj.rowHeights.map(h => Math.round(h * scaleY));
      } else {
        rowHeights = Array(rows).fill(Math.round(scaledH / rows));
      }

      return {
        id: obj.id || `el-table-${index + 1}`,
        type: 'table',
        left: Math.round(geo.left),
        top: Math.round(geo.top),
        width: scaledW,
        height: scaledH,
        rows: rows,
        cols: cols,
        colWidths: colWidths,
        rowHeights: rowHeights,
        selectedCells: obj.selectedCells || [],
        merges: obj.merges || [],
        cellSplits: obj.cellSplits || {},
        subCellData: obj.subCellData || {},
        tableData: obj.tableData || generateDefaultTableData(rows, cols),
        cellFills: obj.cellFills || {},
        cellColors: obj.cellColors || {},
        cellBorderColors: obj.cellBorderColors || {},
        cellBorderWidths: obj.cellBorderWidths || {},
        cellFonts: obj.cellFonts || {},
        cellFontSizes: obj.cellFontSizes || {},
        cellBolds: obj.cellBolds || {},
        cellItalics: obj.cellItalics || {},
        cellUnderlines: obj.cellUnderlines || {},
        cellAligns: obj.cellAligns || {},
        tableFontFamily: obj.tableFontFamily || '맑은 고딕',
        opacity: obj.opacity !== undefined ? obj.opacity : 1,
        angle: Math.round(obj.angle || 0)
      };
    }

    if (obj.isVideo) {
      return {
        id: obj.id || `el-video-${index + 1}`,
        type: 'video',
        left: Math.round(geo.left),
        top: Math.round(geo.top),
        width: Math.round(obj.getScaledWidth()),
        height: Math.round(obj.getScaledHeight()),
        videoTitle: obj.videoTitle || '소개 동영상.mp4',
        duration: obj.videoDuration || '03:45',
        videoSrc: obj.videoSrc || null,
        posterSrc: obj.posterSrc || null,
        opacity: obj.opacity !== undefined ? obj.opacity : 1,
        angle: Math.round(obj.angle || 0)
      };
    }

    if (obj.type === 'group') {
      return {
        id: obj.id || `el-group-${index + 1}`,
        type: 'group',
        left: Math.round(geo.left),
        top: Math.round(geo.top),
        width: Math.round(obj.width || 0), // 그룹 자체 크기(배율 적용 전). PPTX 내보내기 때 자식 좌표를 펼치는 데 쓴다
        height: Math.round(obj.height || 0),
        scaleX: geo.scaleX,
        scaleY: geo.scaleY,
        opacity: obj.opacity !== undefined ? obj.opacity : 1,
        angle: Math.round(geo.angle),
        objects: obj.getObjects().map((child, cIdx) => exportFabricObjectToData(child, cIdx))
      };
    }

    const type = obj.type === 'textbox' || obj.type === 'text' ? 'text' :
                 obj.type === 'rect' ? 'rect' :
                 obj.type === 'circle' ? 'circle' :
                 obj.type === 'triangle' ? 'triangle' :
                 obj.type === 'line' ? 'line' :
                 obj.shapeSubtype === 'arrow' ? 'arrow' :
                 obj.shapeSubtype === 'star' ? 'star' :
                 obj.shapeSubtype === 'callout' ? 'callout' :
                 obj.type === 'image' ? 'image' : 'shape';

    let strokeVal = obj.stroke || null;
    let strokeWidthVal = obj.strokeWidthPt !== undefined
      ? obj.strokeWidthPt
      : (obj.strokeWidth ? Math.round((obj.strokeWidth * PT_PER_PX) * 100) / 100 : 0);

    if (type === 'text') {
      strokeVal = (obj.boxStroke && obj.boxStroke !== 'transparent') ? obj.boxStroke : null;
      strokeWidthVal = obj.strokeWidthPt !== undefined
        ? obj.strokeWidthPt
        : (obj.boxStrokeWidth ? Math.round((obj.boxStrokeWidth * PT_PER_PX) * 100) / 100 : 0);
    }

    // 스트로크 두께가 객체의 width/height에 누적 중복 합산되지 않도록 순수한 너비와 높이를 정확히 산출
    let pureW = Math.round((obj.width || 0) * geo.scaleX);
    let pureH = Math.round((obj.height || 0) * geo.scaleY);
    if (type === 'circle') {
      pureW = Math.round(((obj.radius || 50) * 2) * geo.scaleX);
      pureH = Math.round(((obj.radius || 50) * 2) * geo.scaleY); // 타원(비균등 배율) 보존
    } else if (type === 'arrow') {
      pureW = Math.round(240 * geo.scaleX);
      pureH = Math.round(100 * geo.scaleY);
    } else if (type === 'star') {
      pureW = Math.round(190 * geo.scaleX);
      pureH = Math.round(170 * geo.scaleY);
    } else if (type === 'callout') {
      pureW = Math.round(240 * geo.scaleX);
      pureH = Math.round(180 * geo.scaleY);
    }

    let finalLeft = geo.left;
    let finalTop = geo.top;

    const data = {
      id: obj.id || `el-${index + 1}`,
      type: type,
      left: Math.round(finalLeft),
      top: Math.round(finalTop),
      width: pureW,
      height: pureH,
      fill: typeof obj.fill === 'string' ? obj.fill : '#2563EB',
      stroke: strokeVal,
      strokeWidth: strokeWidthVal,
      opacity: obj.opacity !== undefined ? obj.opacity : 1,
      angle: Math.round(geo.angle)
    };
    if (obj.role) data.role = obj.role;

    if (type === 'line') {
      // Fabric은 이동·크기 변경 시 x1..y2를 갱신하지 않으므로 실제 끝점을 다시 계산한다.
      // 선은 stroke/2만큼 안쪽에 그려지므로 다시 만들 때 같은 위치가 되도록 보정한다.
      const lp = obj.calcLinePoints();
      const lm = (obj.group && obj.group.type === 'activeSelection') ? obj.calcTransformMatrix() : obj.calcTransformMatrix(true);
      const p1 = fabric.util.transformPoint({ x: lp.x1, y: lp.y1 }, lm);
      const p2 = fabric.util.transformPoint({ x: lp.x2, y: lp.y2 }, lm);
      const half = (obj.strokeWidth || 0) / 2;
      data.x1 = Math.round(p1.x - half);
      data.y1 = Math.round(p1.y - half);
      data.x2 = Math.round(p2.x - half);
      data.y2 = Math.round(p2.y - half);
      data.angle = 0;
    }

    if (type === 'text') {
      data.text = obj.text;
      data.fontSize = Math.round(obj.fontSize);
      data.fontFamily = obj.fontFamily;
      data.fontWeight = obj.fontWeight;
      data.fontStyle = obj.fontStyle;
      data.underline = obj.underline;
      data.align = obj.textAlign;
      data.styles = obj.styles || {};
      data.backgroundColor = obj.backgroundColor || null;
    } else if (type === 'rect') {
      data.rx = obj.rx || 0;
      data.ry = obj.ry || 0;
    } else if (type === 'image') {
      data.src = obj.getSrc ? obj.getSrc() : (obj._element ? obj._element.src : (obj.src || ''));
    }
    return data;
  }

  // ================= 12. 객체 선택 & 빠른 서식 바 =================
  function getTableTargetKeys(obj) {
    if (!obj || !obj.isTable) return [];
    if (Array.isArray(obj.selectedCells) && obj.selectedCells.length > 0) {
      return obj.selectedCells;
    }
    if (obj.selectedCell) {
      return [`${obj.selectedCell.r}_${obj.selectedCell.c}`];
    }
    return ['0_0'];
  }

  function enableFormatControls(enableTextFormats) {
    const fontSearch = document.getElementById('fontSearchInput');
    const fontSelect = document.getElementById('fontFamilySelect');
    const sizeInput = document.getElementById('fontSizeInput');
    const btnBold = document.getElementById('btnBold');
    const btnItalic = document.getElementById('btnItalic');
    const btnUnderline = document.getElementById('btnUnderline');
    const textColorTrigger = document.getElementById('textColorTrigger');

    [fontSearch, fontSelect, sizeInput, btnBold, btnItalic, btnUnderline, textColorTrigger].forEach(el => {
      if (el) {
        el.style.opacity = enableTextFormats ? '1' : '0.35';
        el.style.pointerEvents = enableTextFormats ? 'auto' : 'none';
      }
    });
  }

  function onObjectSelected(e) {
    const obj = e.selected ? e.selected[0] : canvas.getActiveObject();
    if (!obj) return;

    updateInspector(obj);

    const formatRow = document.getElementById('formatRow');
    if (obj.type === 'textbox' || obj.type === 'text') {
      formatRow.classList.remove('disabled');
      enableFormatControls(true);
      setFontSelectValue(obj.fontFamily || '맑은 고딕');
      document.getElementById('fontSizeInput').value = Math.round(obj.fontSize);
      document.getElementById('btnBold').classList.toggle('active', obj.fontWeight === 'bold');
      document.getElementById('btnItalic').classList.toggle('active', obj.fontStyle === 'italic');
      document.getElementById('btnUnderline').classList.toggle('active', !!obj.underline);
      updateColorBarVisual(document.getElementById('textColorBar'), obj.fill || '#FFFFFF');
    } else if (obj.isTable) {
      // 표 선택 시에도 상단 서식 바 전체 활성화 및 현재 선택 셀 서식 동기화
      formatRow.classList.remove('disabled');
      enableFormatControls(true);
      const cell = obj.selectedCell || { r: 0, c: 0 };
      const key = `${cell.r}_${cell.c}`;
      const font = (obj.cellFonts && obj.cellFonts[key]) || obj.tableFontFamily || '맑은 고딕';
      const size = (obj.cellFontSizes && obj.cellFontSizes[key]) || (cell.r === 0 ? 16 : 14);
      const isBold = (obj.cellBolds && obj.cellBolds[key] !== undefined) ? obj.cellBolds[key] : (cell.r === 0);
      const isItalic = !!(obj.cellItalics && obj.cellItalics[key]);
      const isUnder = !!(obj.cellUnderlines && obj.cellUnderlines[key]);
      const color = (obj.cellColors && obj.cellColors[key]) || (cell.r === 0 ? '#FFFFFF' : '#334155');

      setFontSelectValue(font);
      document.getElementById('fontSizeInput').value = size;
      document.getElementById('btnBold').classList.toggle('active', isBold);
      document.getElementById('btnItalic').classList.toggle('active', isItalic);
      document.getElementById('btnUnderline').classList.toggle('active', isUnder);
      updateColorBarVisual(document.getElementById('textColorBar'), color);
    } else {
      // 일반 도형/이미지/비디오 등: 텍스트 서식 바 비활성화
      formatRow.classList.add('disabled');
      enableFormatControls(false);
    }
    updateSlideOverflowGuides();
    notifySessionState();
  }

  function onObjectCleared() {
    const formatRow = document.getElementById('formatRow');
    if (formatRow) formatRow.classList.add('disabled');
    enableFormatControls(false);
    clearInspector();
    updateSlideOverflowGuides();
    notifySessionState();
  }

  // ================= 슬라이드 영역 밖 개체 마우스 드래그 이동 / 리사이징 / 회전 및 60fps 오버레이 동기화 =================
  let isOverflowDragging = false;

  // 핸들의 회전 각도 및 코너 위치에 따른 최적 리사이즈/회전 커서 스타일 반환
  function getHandleCursor(activeObj, cornerKey) {
    if (!activeObj) return 'crosshair';
    const control = activeObj.controls ? activeObj.controls[cornerKey] : null;
    if (control && typeof control.cursorStyleHandler === 'function') {
      try {
        const cur = control.cursorStyleHandler({}, control, activeObj);
        if (cur) return cur;
      } catch (e) {}
    }
    // 기본 회전 각도 0도 기준 폴백
    if (cornerKey === 'mtr') return 'crosshair';
    if (cornerKey === 'tl' || cornerKey === 'br') return 'nwse-resize';
    if (cornerKey === 'tr' || cornerKey === 'bl') return 'nesw-resize';
    if (cornerKey === 'ml' || cornerKey === 'mr') return 'ew-resize';
    if (cornerKey === 'mt' || cornerKey === 'mb') return 'ns-resize';
    return 'crosshair';
  }

  // 1. 슬라이드 밖 개체 면통 및 테두리 실선 드래그 이동 (Move)
  function startOverflowDrag(e, activeObj) {
    if (!activeObj || !canvas) return;
    if (e.button !== 0) return; // 마우스 좌클릭만 처리
    e.preventDefault();
    e.stopPropagation();

    isOverflowDragging = true;
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startLeft = activeObj.left;
    const startTop = activeObj.top;
    const zoom = (canvas && canvas.getZoom()) ? canvas.getZoom() : (canvasScale || 1);

    document.body.style.cursor = 'move';
    document.body.style.userSelect = 'none';

    let hasMoved = false;

    function onMouseMove(moveEvent) {
      moveEvent.preventDefault();
      const dx = (moveEvent.clientX - startClientX) / zoom;
      const dy = (moveEvent.clientY - startClientY) / zoom;

      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        hasMoved = true;
      }

      activeObj.set({
        left: Math.round(startLeft + dx),
        top: Math.round(startTop + dy)
      });
      activeObj.setCoords();
      canvas.requestRenderAll();
      updateInspector();
      updateSlideOverflowPositions(activeObj);
    }

    function onMouseUp(upEvent) {
      isOverflowDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (hasMoved) {
        activeObj.setCoords();
        canvas.requestRenderAll();
        updateInspector();
        updateSlideOverflowGuides();
        saveCurrentSlideState();
        recordHistory();
        notifySlideModified();
      } else {
        updateSlideOverflowGuides();
      }
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // 2. 슬라이드 밖 파란 편집점(핸들 8개 + 회전 핸들 1개) 리사이징 및 회전 세션 (Resize / Rotate)
  function startOverflowHandleTransform(e, activeObj, cornerKey) {
    if (!activeObj || !canvas) return;
    if (e.button !== 0) return; // 마우스 좌클릭만 처리
    e.preventDefault();
    e.stopPropagation();

    isOverflowDragging = true;

    // 활성 객체 보장
    if (canvas.getActiveObject() !== activeObj) {
      canvas.setActiveObject(activeObj);
    }

    // Fabric 네이티브 transform 세션 초기화
    activeObj.__corner = cornerKey;
    if (typeof canvas._setupCurrentTransform === 'function') {
      canvas._setupCurrentTransform(e, activeObj, true);
    }

    const cursorStyle = getHandleCursor(activeObj, cornerKey);
    document.body.style.cursor = cursorStyle;
    document.body.style.userSelect = 'none';

    let hasTransformed = false;

    function onMouseMove(moveEvent) {
      moveEvent.preventDefault();
      hasTransformed = true;

      // Fabric의 네이티브 _transformObject 실행 (크기 조절/회전/Shift 스냅/TextBox 폭 조절 모두 자동 동작!)
      if (canvas._currentTransform) {
        canvas._transformObject(moveEvent);
        canvas.requestRenderAll();
        updateInspector();
        updateSlideOverflowPositions(activeObj);
      }
    }

    function onMouseUp(upEvent) {
      isOverflowDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (canvas._currentTransform) {
        canvas._finalizeCurrentTransform(upEvent);
        canvas._currentTransform = null;
      }
      activeObj.__corner = 0;

      activeObj.setCoords();
      canvas.requestRenderAll();
      updateInspector();
      updateSlideOverflowGuides();

      if (hasTransformed) {
        saveCurrentSlideState();
        recordHistory();
        notifySlideModified();
      }
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  // 드래그 중 오버레이 요소의 좌표만 실시간 초고속 갱신 (DOM 재생성 없이 부드러운 60fps 보장)
  function updateSlideOverflowPositions(activeObj) {
    try {
      const overlay = document.getElementById('slideOverflowOverlay');
      if (!overlay || overlay.style.display === 'none') return;

      activeObj.setCoords();
      const coords = activeObj.oCoords;
      if (!coords) return;

      const tl = coords.tl, tr = coords.tr, br = coords.br, bl = coords.bl, mt = coords.mt, mtr = coords.mtr;
      const poly = overlay.querySelector('.native-mirror-poly');
      if (poly && tl && tr && br && bl) {
        poly.setAttribute('points', `${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`);
      }

      const line = overlay.querySelector('.native-mirror-line');
      if (line && mt && mtr) {
        line.setAttribute('x1', mt.x);
        line.setAttribute('y1', mt.y);
        line.setAttribute('x2', mtr.x);
        line.setAttribute('y2', mtr.y);
      }

      const dots = overlay.querySelectorAll('.native-mirror-corner');
      dots.forEach(dot => {
        const handleKey = dot.getAttribute('data-handle');
        if (handleKey && coords[handleKey]) {
          dot.style.left = `${Math.round(coords[handleKey].x)}px`;
          dot.style.top = `${Math.round(coords[handleKey].y)}px`;
        }
      });
    } catch (e) {
      console.warn('updateSlideOverflowPositions failed:', e);
    }
  }

  // 슬라이드 영역(1920x1080) 밖으로 나간 개체의 파란색 편집점(핸들 8개 + 회전 핸들) 및 테두리 실선 네이티브 연장 렌더링
  function updateSlideOverflowGuides() {
    if (isOverflowDragging) return;
    try {
      let overlay = document.getElementById('slideOverflowOverlay');
      const activeObj = canvas ? canvas.getActiveObject() : null;

      if (!activeObj || !canvas) {
        if (overlay) overlay.style.display = 'none';
        return;
      }

      const paper = document.querySelector('.canvas-paper');
      if (!paper) return;

      if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'slideOverflowOverlay';
        overlay.className = 'slide-overflow-overlay';
        paper.appendChild(overlay);
      }

      // 최신 좌표 산출
      activeObj.setCoords();
      const coords = activeObj.oCoords;
      if (!coords) {
        overlay.style.display = 'none';
        return;
      }

      const canvasW = canvas.getWidth();
      const canvasH = canvas.getHeight();

      // 핸들 목록 (Fabric 기본 8개 모서리/변 + 1개 회전 핸들)
      const handleKeys = ['tl', 'tr', 'br', 'bl', 'ml', 'mt', 'mr', 'mb', 'mtr'];

      // 슬라이드 경계(0 ~ canvasW, 0 ~ canvasH) 밖으로 나간 좌표가 하나라도 있는지 검사 (상/하/좌/우 4방향 모두 검사)
      let hasOverflow = false;
      for (const k of handleKeys) {
        const pt = coords[k];
        if (pt && (pt.x < -1 || pt.x > canvasW + 1 || pt.y < -1 || pt.y > canvasH + 1)) {
          hasOverflow = true;
          break;
        }
      }

      // 슬라이드 안에 온전히 다 있으면 오버레이 숨김
      if (!hasOverflow) {
        overlay.style.display = 'none';
        overlay.innerHTML = '';
        return;
      }

      overlay.style.display = 'block';
      overlay.innerHTML = '';

      // 1. 네이티브 선택 테두리 실선(Selection Borders) 및 슬라이드 밖 개체 몸통 드래그 이동 렌더링 (SVG)
      const tl = coords.tl, tr = coords.tr, br = coords.br, bl = coords.bl, mt = coords.mt, mtr = coords.mtr;
      if (tl && tr && br && bl) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'native-mirror-svg');

        // 슬라이드 외부만 클리핑하는 evenodd clipPath 정의 (슬라이드 내부는 100% 투과하여 기존 캔버스 조작 보존)
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
        const clipId = 'outsideSlideClip_' + Date.now();
        clipPath.setAttribute('id', clipId);
        clipPath.setAttribute('clip-rule', 'evenodd');

        const outerRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        outerRect.setAttribute('x', '-50000');
        outerRect.setAttribute('y', '-50000');
        outerRect.setAttribute('width', '100000');
        outerRect.setAttribute('height', '100000');

        const innerRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        innerRect.setAttribute('x', '0');
        innerRect.setAttribute('y', '0');
        innerRect.setAttribute('width', canvasW);
        innerRect.setAttribute('height', canvasH);

        clipPath.appendChild(outerRect);
        clipPath.appendChild(innerRect);
        defs.appendChild(clipPath);
        svg.appendChild(defs);

        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('clip-path', `url(#${clipId})`);
        group.setAttribute('class', 'native-mirror-outside-group');

        // 테두리 4각형 및 면통 영역 (슬라이드 밖 개체 몸통 잡고 드래그하여 이동)
        const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        poly.setAttribute('class', 'native-mirror-poly');
        poly.setAttribute('points', `${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`);
        poly.setAttribute('title', '드래그하여 이동');
        poly.addEventListener('mousedown', function (e) {
          startOverflowDrag(e, activeObj);
        });
        group.appendChild(poly);

        // 회전 핸들 연결선 (mt -> mtr)
        if (mt && mtr) {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('class', 'native-mirror-line');
          line.setAttribute('x1', mt.x);
          line.setAttribute('y1', mt.y);
          line.setAttribute('x2', mtr.x);
          line.setAttribute('y2', mtr.y);
          line.addEventListener('mousedown', function (e) {
            startOverflowDrag(e, activeObj);
          });
          group.appendChild(line);
        }

        svg.appendChild(group);
        overlay.appendChild(svg);
      }

      // 2. 캔버스 밖으로 나가서 Fabric이 그리지 못한 파란 원형 편집점들 렌더링 (리사이징 및 회전 전용 핸들러 부착)
      handleKeys.forEach(k => {
        const pt = coords[k];
        if (!pt) return;

        // 슬라이드 경계(0~W, 0~H) 바깥에 위치하거나 회전 핸들이면 렌더링
        const isOutside = (pt.x < 1 || pt.x > canvasW - 1 || pt.y < 1 || pt.y > canvasH - 1);
        if (isOutside || k === 'mtr') {
          const dot = document.createElement('div');
          dot.className = 'native-mirror-corner';
          dot.setAttribute('data-handle', k);
          dot.style.left = `${Math.round(pt.x)}px`;
          dot.style.top = `${Math.round(pt.y)}px`;

          const cur = getHandleCursor(activeObj, k);
          dot.style.cursor = cur;

          if (k === 'mtr') {
            dot.title = '드래그하여 회전 (Shift: 45° 단위 스냅)';
          } else {
            dot.title = '드래그하여 크기 조절';
          }

          dot.addEventListener('mousedown', function (e) {
            startOverflowHandleTransform(e, activeObj, k);
          });
          overlay.appendChild(dot);
        }
      });
    } catch (e) {
      console.warn('updateSlideOverflowGuides failed:', e);
    }
  }

  // ================= 13. 서식 조작 (글자별 styles 오버라이드까지 완벽 동기화하는 실시간 서식 엔진) =================
  // 텍스트 개체(Textbox/Text)의 속성을 안전하고 확실하게 실시간 적용 (개별 styles 오버라이드까지 완벽 동기화)
  function applyTextPropToObject(textObj, prop, value) {
    if (!textObj) return;

    if (textObj.isEditing && textObj.selectionStart !== textObj.selectionEnd) {
      // 텍스트 편집 중 블록 선택된 글자들에만 부분 적용
      const styleObj = {};
      styleObj[prop] = value;
      textObj.setSelectionStyles(styleObj);
    } else {
      // 텍스트 상자 전체: 개체 기본 속성 변경 + styles 내부의 모든 글자 개별 속성까지 일괄 동기화!
      textObj.set(prop, value);
      if (textObj.styles) {
        for (const line in textObj.styles) {
          for (const char in textObj.styles[line]) {
            if (textObj.styles[line][char]) {
              textObj.styles[line][char][prop] = value;
            }
          }
        }
      }
    }

    // Fabric 내부 캐시 비트맵 및 문자 메트릭 강제 초기화 후 텍스트 박스 크기/위치 즉시 재계산
    textObj.__charBounds = [];
    if (typeof textObj._clearCache === 'function') textObj._clearCache();
    if (typeof textObj.initDimensions === 'function') textObj.initDimensions();
    if (textObj.isEditing && typeof textObj.updateTextareaPosition === 'function') {
      textObj.updateTextareaPosition();
    }
    textObj.setCoords();
    textObj.dirty = true;
  }

  // 다중 선택(ActiveSelection) 안의 텍스트 개체에 서식을 일괄 적용한다. 처리했으면 true.
  function applyToSelectionTexts(obj, fn) {
    if (!obj || obj.type !== 'activeSelection') return false;
    const targets = obj.getObjects().filter(o => o.type === 'textbox' || o.type === 'text');
    if (targets.length === 0) return false;
    targets.forEach(t => fn(t));
    obj.dirty = true;
    if (obj.addWithUpdate) obj.addWithUpdate(); // 글자 크기 변경으로 달라진 선택 영역 경계 갱신
    canvas.renderAll();
    saveCurrentSlideState();
    updateSlideOverflowGuides();
    return true;
  }

  window.changeFontFamily = function (font) {
    if (!font) return;
    const obj = canvas ? canvas.getActiveObject() : null;
    if (applyToSelectionTexts(obj, t => applyTextPropToObject(t, 'fontFamily', font))) return;

    if (obj && (obj.type === 'textbox' || obj.type === 'text')) {
      applyTextPropToObject(obj, 'fontFamily', font);
      canvas.renderAll();
      saveCurrentSlideState();
      updateSlideOverflowGuides();
    } else if (obj && obj.isTable) {
      const targetKeys = getTableTargetKeys(obj);
      if (!obj.cellFonts) obj.cellFonts = {};
      targetKeys.forEach(k => {
        obj.cellFonts[k] = font;
      });
      if (obj.getObjects) {
        obj.getObjects().forEach(child => {
          if (child.isCellText && targetKeys.includes(child.cellKey)) {
            applyTextPropToObject(child, 'fontFamily', font);
          }
        });
        obj.dirty = true;
        canvas.renderAll();
      }
      saveCurrentSlideState();
      updateSlideOverflowGuides();
    }
  };

  window.changeFontSize = function (val, isFinal = false) {
    const obj = canvas ? canvas.getActiveObject() : null;
    const parsedSize = parseInt(val, 10);
    // 타이핑 중 빈칸이거나 유효하지 않은 경우 최종(blur/enter) 시점에만 기본값 처리
    if (isNaN(parsedSize)) {
      if (!isFinal) return;
    }
    const newSize = Math.max(8, Math.min(144, isNaN(parsedSize) ? 24 : parsedSize));

    if (applyToSelectionTexts(obj, t => applyTextPropToObject(t, 'fontSize', newSize))) return;

    if (obj && (obj.type === 'textbox' || obj.type === 'text')) {
      applyTextPropToObject(obj, 'fontSize', newSize);
      canvas.renderAll();
      saveCurrentSlideState();
      updateSlideOverflowGuides();
    } else if (obj && obj.isTable) {
      const targetKeys = getTableTargetKeys(obj);
      if (!obj.cellFontSizes) obj.cellFontSizes = {};
      targetKeys.forEach(k => {
        obj.cellFontSizes[k] = newSize;
      });

      // 표 셀 텍스트 직접 갱신으로 선택 풀림 및 깜빡임 없이 즉각 반영
      if (obj.getObjects) {
        obj.getObjects().forEach(child => {
          if (child.isCellText && targetKeys.includes(child.cellKey)) {
            applyTextPropToObject(child, 'fontSize', newSize);
          }
        });
        obj.dirty = true;
        canvas.renderAll();
      }
      saveCurrentSlideState();
      updateSlideOverflowGuides();
    }
  };

  window.stepFontSize = function (delta) {
    const input = document.getElementById('fontSizeInput');
    let current = input ? parseInt(input.value, 10) : 24;
    if (isNaN(current)) current = 24;
    const next = Math.max(8, Math.min(144, current + delta));
    if (input) input.value = next;
    window.changeFontSize(next, true);
  };

  window.toggleBold = function () {
    const obj = canvas ? canvas.getActiveObject() : null;
    if (applyToSelectionTexts(obj, t => {
      const isBold = t.fontWeight === 'bold';
      applyTextPropToObject(t, 'fontWeight', isBold ? 'normal' : 'bold');
    })) return;

    if (obj && (obj.type === 'textbox' || obj.type === 'text')) {
      const isBold = obj.fontWeight === 'bold';
      applyTextPropToObject(obj, 'fontWeight', isBold ? 'normal' : 'bold');
      const btn = document.getElementById('btnBold');
      if (btn) btn.classList.toggle('active', !isBold);
      canvas.renderAll();
      saveCurrentSlideState();
      updateSlideOverflowGuides();
    } else if (obj && obj.isTable) {
      const targetKeys = getTableTargetKeys(obj);
      if (!obj.cellBolds) obj.cellBolds = {};
      const firstKey = targetKeys[0] || '0_0';
      const currentBold = (obj.cellBolds[firstKey] !== undefined) ? obj.cellBolds[firstKey] : (parseInt(firstKey.split('_')[0], 10) === 0);
      const nextBold = !currentBold;
      targetKeys.forEach(k => {
        obj.cellBolds[k] = nextBold;
      });
      const btn = document.getElementById('btnBold');
      if (btn) btn.classList.toggle('active', nextBold);
      if (obj.getObjects) {
        obj.getObjects().forEach(child => {
          if (child.isCellText && targetKeys.includes(child.cellKey)) {
            applyTextPropToObject(child, 'fontWeight', nextBold ? 'bold' : 'normal');
          }
        });
        obj.dirty = true;
        canvas.requestRenderAll();
      }
      saveCurrentSlideState();
      updateSlideOverflowGuides();
    }
  };

  window.toggleItalic = function () {
    const obj = canvas ? canvas.getActiveObject() : null;
    if (applyToSelectionTexts(obj, t => {
      const isItalic = t.fontStyle === 'italic';
      applyTextPropToObject(t, 'fontStyle', isItalic ? 'normal' : 'italic');
    })) return;

    if (obj && (obj.type === 'textbox' || obj.type === 'text')) {
      const isItalic = obj.fontStyle === 'italic';
      applyTextPropToObject(obj, 'fontStyle', isItalic ? 'normal' : 'italic');
      const btn = document.getElementById('btnItalic');
      if (btn) btn.classList.toggle('active', !isItalic);
      canvas.renderAll();
      saveCurrentSlideState();
      updateSlideOverflowGuides();
    } else if (obj && obj.isTable) {
      const targetKeys = getTableTargetKeys(obj);
      if (!obj.cellItalics) obj.cellItalics = {};
      const firstKey = targetKeys[0] || '0_0';
      const currentItalic = !!obj.cellItalics[firstKey];
      const nextItalic = !currentItalic;
      targetKeys.forEach(k => {
        obj.cellItalics[k] = nextItalic;
      });
      const btn = document.getElementById('btnItalic');
      if (btn) btn.classList.toggle('active', nextItalic);
      if (obj.getObjects) {
        obj.getObjects().forEach(child => {
          if (child.isCellText && targetKeys.includes(child.cellKey)) {
            applyTextPropToObject(child, 'fontStyle', nextItalic ? 'italic' : 'normal');
          }
        });
        obj.dirty = true;
        canvas.requestRenderAll();
      }
      saveCurrentSlideState();
      updateSlideOverflowGuides();
    }
  };

  window.toggleUnderline = function () {
    const obj = canvas ? canvas.getActiveObject() : null;
    if (applyToSelectionTexts(obj, t => {
      const isUnder = !!t.underline;
      applyTextPropToObject(t, 'underline', !isUnder);
    })) return;

    if (obj && (obj.type === 'textbox' || obj.type === 'text')) {
      const isUnder = !!obj.underline;
      applyTextPropToObject(obj, 'underline', !isUnder);
      const btn = document.getElementById('btnUnderline');
      if (btn) btn.classList.toggle('active', !isUnder);
      canvas.renderAll();
      saveCurrentSlideState();
      updateSlideOverflowGuides();
    } else if (obj && obj.isTable) {
      const targetKeys = getTableTargetKeys(obj);
      if (!obj.cellUnderlines) obj.cellUnderlines = {};
      const firstKey = targetKeys[0] || '0_0';
      const currentUnder = !!obj.cellUnderlines[firstKey];
      const nextUnder = !currentUnder;
      targetKeys.forEach(k => {
        obj.cellUnderlines[k] = nextUnder;
      });
      const btn = document.getElementById('btnUnderline');
      if (btn) btn.classList.toggle('active', nextUnder);
      if (obj.getObjects) {
        obj.getObjects().forEach(child => {
          if (child.isCellText && targetKeys.includes(child.cellKey)) {
            applyTextPropToObject(child, 'underline', nextUnder);
          }
        });
        obj.dirty = true;
        canvas.requestRenderAll();
      }
      saveCurrentSlideState();
      updateSlideOverflowGuides();
    }
  };

  window.setTextAlign = function (align) {
    const obj = canvas.getActiveObject();
    if (applyToSelectionTexts(obj, ts => ts.forEach(o => o.set('textAlign', align)))) return;
    if (obj && (obj.type === 'textbox' || obj.type === 'text')) {
      obj.set('textAlign', align);
      canvas.renderAll();
      saveCurrentSlideState();
    } else if (obj && obj.isTable) {
      const targetKeys = getTableTargetKeys(obj);
      if (!obj.cellAligns) obj.cellAligns = {};
      targetKeys.forEach(k => {
        obj.cellAligns[k] = align;
      });
      // 셀 텍스트의 위치(origin)가 정렬에 따라 달라지므로 재빌드해야 화면에 바로 반영된다
      rebuildTableGroup(obj);
      saveCurrentSlideState();
    }
  };

  // 배경색에 따라 어둡거나 밝은 기본 글자색 지능형 자동 지정
  window.insertText = function () {
    const currentSlide = deckData.slides[currentSlideIndex];
    const isDarkBg = currentSlide && currentSlide.background && currentSlide.background.toLowerCase() === '#0f172a';
    const textColor = isDarkBg ? '#FFFFFF' : '#0F172A';

    const tb = new fabric.Textbox('새로운 내용을 입력하세요.', {
      left: 300,
      top: 300,
      width: 800,
      fontSize: 32,
      fontWeight: 'normal',
      fill: textColor,
      fontFamily: '맑은 고딕',
      textAlign: 'left',
      stroke: null,
      strokeWidth: 0,
      backgroundColor: 'transparent'
    });
    tb.boxStroke = null;
    tb.boxStrokeWidth = 0;
    tb.strokeWidthPt = 0;
    setupTextboxBehavior(tb);
    canvas.add(tb);
    canvas.setActiveObject(tb);
    canvas.renderAll();
    saveCurrentSlideState();
    showToast('텍스트 상자가 추가되었습니다.');
  };

  window.insertShape = function (shapeType) {
    let shape;
    if (shapeType === 'rect') {
      shape = new fabric.Rect({
        left: 400, top: 300, width: 300, height: 200,
        fill: '#3B82F6', stroke: null, strokeWidth: 0, rx: 0, ry: 0
      });
    } else if (shapeType === 'roundedRect') {
      shape = new fabric.Rect({
        left: 400, top: 300, width: 320, height: 200,
        fill: '#2563EB', stroke: null, strokeWidth: 0, rx: 16, ry: 16
      });
    } else if (shapeType === 'circle') {
      shape = new fabric.Circle({
        left: 400, top: 300, radius: 100,
        fill: '#0D9488', stroke: null, strokeWidth: 0
      });
    } else if (shapeType === 'triangle') {
      shape = new fabric.Triangle({
        left: 400, top: 300, width: 220, height: 180,
        fill: '#F59E0B', stroke: null, strokeWidth: 0
      });
    } else if (shapeType === 'line') {
      shape = new fabric.Line([300, 300, 700, 300], {
        stroke: '#2563EB', strokeWidth: 6, strokeLineCap: 'round'
      });
    } else if (shapeType === 'arrow') {
      shape = new fabric.Path('M 0 35 L 140 35 L 140 0 L 240 50 L 140 100 L 140 65 L 0 65 Z', {
        left: 400, top: 300,
        fill: '#3B82F6', stroke: null, strokeWidth: 0
      });
      shape.shapeSubtype = 'arrow';
    } else if (shapeType === 'star') {
      shape = new fabric.Polygon([
        {x: 100, y: 10}, {x: 125, y: 75}, {x: 195, y: 75},
        {x: 138, y: 115}, {x: 160, y: 180}, {x: 100, y: 140},
        {x: 40, y: 180}, {x: 62, y: 115}, {x: 5, y: 75}, {x: 75, y: 75}
      ], {
        left: 400, top: 300,
        fill: '#FACC15', stroke: null, strokeWidth: 0
      });
      shape.shapeSubtype = 'star';
    } else if (shapeType === 'callout') {
      shape = new fabric.Path('M 20 0 L 220 0 C 230 0 240 10 240 20 L 240 120 C 240 130 230 140 220 140 L 80 140 L 40 180 L 50 140 L 20 140 C 10 140 0 130 0 120 L 0 20 C 0 10 10 0 20 0 Z', {
        left: 400, top: 300,
        fill: '#3B82F6', stroke: null, strokeWidth: 0
      });
      shape.shapeSubtype = 'callout';
    }
    if (shape) {
      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.renderAll();
      saveCurrentSlideState();
      showToast('도형이 추가되었습니다.');
    }
  };

  // ================= 표 삽입 =================
  window.insertTable = function (rows = 3, cols = 3) {
    const tableGroup = createFabricTableGroup({
      rows: rows,
      cols: cols,
      left: 400,
      top: 300,
      width: Math.min(cols * 220, 1000),
      height: rows * 64
    });
    canvas.add(tableGroup);
    canvas.setActiveObject(tableGroup);
    canvas.renderAll();
    saveCurrentSlideState();
    showToast(`${rows}행 ${cols}열 표가 추가되었습니다.`);
  };

  window.insertCustomTable = function () {
    const rowsInput = document.getElementById('tblRowsInput');
    const colsInput = document.getElementById('tblColsInput');
    const rows = Math.max(1, Math.min(10, parseInt(rowsInput ? rowsInput.value : 3, 10) || 3));
    const cols = Math.max(1, Math.min(8, parseInt(colsInput ? colsInput.value : 3, 10) || 3));
    window.insertTable(rows, cols);
  };

  // ================= 비디오 미디어 삽입 =================
  window.insertVideoFile = function (fileInput) {
    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      const fileSizeMB = Math.round(file.size / (1024 * 1024) * 10) / 10;
      const durationStr = fileSizeMB > 0 ? `${fileSizeMB}MB 동영상` : '동영상 파일';
      const reader = new FileReader();
      reader.onload = function (e) {
        const videoSrc = e.target.result;
        const videoGroup = createFabricVideoGroup({
          left: 450,
          top: 280,
          width: 640,
          height: 360,
          videoTitle: file.name,
          duration: durationStr,
          videoSrc: videoSrc
        });
        canvas.add(videoGroup);
        canvas.setActiveObject(videoGroup);
        canvas.renderAll();
        saveCurrentSlideState();
        showToast(`'${file.name}' 비디오가 삽입되었습니다.`);
      };
      reader.readAsDataURL(file);
    }
  };

  window.insertSampleVideo = function () {
    const videoGroup = createFabricVideoGroup({
      left: 450,
      top: 280,
      width: 640,
      height: 360,
      videoTitle: 'AI 융합 수업 시연 영상 (Demo.mp4)',
      duration: '03:45'
    });
    canvas.add(videoGroup);
    canvas.setActiveObject(videoGroup);
    canvas.renderAll();
    saveCurrentSlideState();
    showToast('16:9 비디오 카드가 삽입되었습니다.');
  };

  window.insertImageFile = function (fileInput) {
    if (fileInput.files && fileInput.files[0]) {
      const file = fileInput.files[0];
      const reader = new FileReader();
      reader.onload = function (e) {
        const rawDataUrl = e.target.result;
        // 고용량 원본(수십 MB)을 캔버스를 통해 최대 1920x1080 해상도로 안전 리사이즈 및 용량 99% 압축
        const tempImg = new Image();
        tempImg.onload = function () {
          const MAX_DIM = 1920;
          let w = tempImg.width;
          let h = tempImg.height;
          if (w > MAX_DIM || h > MAX_DIM) {
            if (w > h) {
              h = Math.round((h * MAX_DIM) / w);
              w = MAX_DIM;
            } else {
              w = Math.round((w * MAX_DIM) / h);
              h = MAX_DIM;
            }
          }
          const offCanvas = document.createElement('canvas');
          offCanvas.width = w;
          offCanvas.height = h;
          const ctx = offCanvas.getContext('2d');
          ctx.drawImage(tempImg, 0, 0, w, h);
          const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg';
          const optimizedDataUrl = isJpeg
            ? offCanvas.toDataURL('image/jpeg', 0.82)
            : offCanvas.toDataURL('image/png');

          fabric.Image.fromURL(optimizedDataUrl, function (img) {
            img.scaleToWidth(Math.min(600, w));
            img.set({ left: 300, top: 250 });
            img.src = optimizedDataUrl;
            canvas.add(img);
            canvas.setActiveObject(img);
            canvas.renderAll();
            saveCurrentSlideState();
            showToast('이미지가 최적화되어 슬라이드에 삽입되었습니다.');
          });
        };
        tempImg.src = rawDataUrl;
      };
      reader.readAsDataURL(file);
      fileInput.value = '';
    }
  };

  // ================= 14. 상단 통합 인스펙터 & 위치/크기/배경/테두리 제어 =================
  function updateUnifiedBgBar() {
    const bar = document.getElementById('unifiedBgBar');
    const label = document.getElementById('unifiedBgLabel');
    if (!bar) return;

    const obj = canvas ? canvas.getActiveObject() : null;
    if (!obj) {
      // 아무것도 선택되지 않은 경우 -> 현재 슬라이드 배경색
      const curSlide = deckData.slides[currentSlideIndex];
      const bg = (curSlide && curSlide.background) || '#0F172A';
      updateColorBarVisual(bar, bg);
      if (label) label.textContent = '배경색 ▼';
    } else if (obj.isTable) {
      // 표 선택 시 -> 현재 선택된 셀의 배경색
      if (!obj.selectedCell) obj.selectedCell = { r: 0, c: 0 };
      const { r, c } = obj.selectedCell;
      const key = `${r}_${c}`;
      const isHeader = (r === 0);
      const bg = (obj.cellFills && obj.cellFills[key] !== undefined)
        ? obj.cellFills[key]
        : (isHeader ? '#1E293B' : (r % 2 === 1 ? '#FFFFFF' : '#F8FAFC'));
      updateColorBarVisual(bar, bg);
      if (label) label.textContent = '배경색 ▼';
    } else if (obj.type === 'textbox' || obj.type === 'text') {
      const bg = obj.backgroundColor || 'transparent';
      updateColorBarVisual(bar, bg);
      if (label) label.textContent = '배경색 ▼';
    } else {
      // 일반 도형/기타 개체
      const bg = typeof obj.fill === 'string' ? obj.fill : '#2563EB';
      updateColorBarVisual(bar, bg);
      if (label) label.textContent = '배경색 ▼';
    }
  }

  window.handleUnifiedBgClick = function (e) {
    if (e) e.stopPropagation();
    const obj = canvas ? canvas.getActiveObject() : null;
    if (!obj) {
      // 개체 미선택 시: 슬라이드 전체 배경색 설정 팝오버 열기
      window.toggleColorPopover('slideBg', e);
    } else {
      // 개체 또는 표 셀 선택 시: 개체/셀 배경색 설정 팝오버 열기
      window.toggleColorPopover('topFill', e);
    }
  };

  window.changePropPos = function (axis, val, isFinal) {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    const num = parseFloat(val);
    if (isNaN(num)) return;
    if (axis === 'x') obj.set('left', num);
    if (axis === 'y') obj.set('top', num);
    obj.setCoords();
    canvas.renderAll();
    if (isFinal) {
      saveCurrentSlideState();
      recordHistory();
    }
  };

  window.changePropSize = function (dim, val, isFinal) {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) return;

    if (obj.isTable) {
      if (dim === 'w') {
        const curW = obj.width * (obj.scaleX || 1);
        if (curW > 0) obj.scaleX = (obj.scaleX || 1) * (num / curW);
      } else if (dim === 'h') {
        const curH = obj.height * (obj.scaleY || 1);
        if (curH > 0) obj.scaleY = (obj.scaleY || 1) * (num / curH);
      }
    } else if (obj.type === 'textbox' || obj.type === 'text') {
      if (dim === 'w') {
        obj.set('width', num);
        obj.scaleX = 1;
      }
    } else {
      if (dim === 'w') {
        if (obj.width) obj.set('scaleX', num / obj.width);
        else obj.set('width', num);
      } else if (dim === 'h') {
        if (obj.height) obj.set('scaleY', num / obj.height);
        else obj.set('height', num);
      }
    }
    obj.setCoords();
    canvas.renderAll();
    if (isFinal) {
      saveCurrentSlideState();
      recordHistory();
    }
  };

  function updateInspector(obj) {
    obj = obj || canvas.getActiveObject();
    if (!obj) return;

    const px = document.getElementById('propX');
    const py = document.getElementById('propY');
    const pw = document.getElementById('propW');
    const ph = document.getElementById('propH');
    const po = document.getElementById('propOpacity');
    const ps = document.getElementById('propStrokeWidth');

    if (px) px.value = Math.round(obj.left);
    if (py) py.value = Math.round(obj.top);
    // stroke를 뺀 순수 크기를 보여줘야 changePropSize(순수 크기를 설정)와 일치하고 export 값과도 같다
    if (pw) pw.value = Math.round(obj.width * (obj.scaleX || 1));
    if (ph) ph.value = Math.round(obj.height * (obj.scaleY || 1));
    if (po) po.value = Math.round((obj.opacity !== undefined ? obj.opacity : 1) * 100);

    // 테두리 색상 및 굵기 동기화 (도형, 텍스트 상자 및 표 셀, PPT 표준 pt 단위)
    if (obj.isTable) {
      const { r, c } = obj.selectedCell || { r: 0, c: 0 };
      const key = `${r}_${c}`;
      const bColor = (obj.cellBorderColors && obj.cellBorderColors[key]) || '#CBD5E1';
      const bWidthPt = (obj.cellBorderWidths && obj.cellBorderWidths[key] !== undefined) ? obj.cellBorderWidths[key] : 1;
      if (ps) ps.value = bWidthPt;
      updateColorBarVisual(document.getElementById('strokeColorBar'), bColor);
    } else if (obj.type === 'textbox' || obj.type === 'text') {
      const bColor = (obj.boxStroke && obj.boxStroke !== 'transparent') ? obj.boxStroke : '#000000';
      const bWidthPt = obj.strokeWidthPt !== undefined
        ? obj.strokeWidthPt
        : (obj.boxStrokeWidth ? Math.round((obj.boxStrokeWidth * PT_PER_PX) * 100) / 100 : 0);
      if (ps) ps.value = bWidthPt;
      updateColorBarVisual(document.getElementById('strokeColorBar'), (obj.boxStroke && obj.boxStroke !== 'transparent') ? obj.boxStroke : '#CBD5E1');
    } else {
      const strokeColor = (obj.stroke && obj.stroke !== 'transparent') ? obj.stroke : '#000000';
      const strokePt = obj.strokeWidthPt !== undefined
        ? obj.strokeWidthPt
        : (obj.strokeWidth ? Math.round((obj.strokeWidth * PT_PER_PX) * 100) / 100 : 0);
      if (ps) ps.value = strokePt;
      updateColorBarVisual(document.getElementById('strokeColorBar'), (obj.stroke && obj.stroke !== 'transparent') ? obj.stroke : '#CBD5E1');
    }

    // 표 전용 속성 동기화 (우클릭 서브 패널 연동)
    if (obj.isTable) {
      if (!obj.selectedCell) obj.selectedCell = { r: 0, c: 0 };
      const sel = obj.selectedCell;
      const { r, c } = sel;
      const cellCoordEl = document.getElementById('selectedCellCoord');
      if (cellCoordEl) {
        const totalCount = obj.tableRows * obj.tableCols;
        const selectedCount = (obj.selectedCells && obj.selectedCells.length) || 1;
        if (selectedCount === totalCount) {
          cellCoordEl.textContent = `전체 셀 (${obj.tableRows}×${obj.tableCols})`;
        } else if (selectedCount > 1) {
          cellCoordEl.textContent = `${r + 1}행 ${c + 1}열 외 ${selectedCount - 1}개 (총 ${selectedCount}개)`;
        } else {
          cellCoordEl.textContent = `${r + 1}행 ${c + 1}열`;
        }
      }
      const cellInputEl = document.getElementById('tableCellInput');
      if (cellInputEl) {
        let val = '';
        if (obj.selectedCell && obj.selectedCell.isSubCell && obj.subCellData) {
          val = obj.subCellData[obj.selectedCell.key] || '';
        } else {
          val = (obj.tableData[r] && obj.tableData[r][c] !== undefined) ? obj.tableData[r][c] : '';
        }
        cellInputEl.value = val;
      }
      if (window.updateTableDpadUI) window.updateTableDpadUI();
    }

    updateUnifiedBgBar();
  }

  function clearInspector() {
    const px = document.getElementById('propX');
    const py = document.getElementById('propY');
    const pw = document.getElementById('propW');
    const ph = document.getElementById('propH');
    const po = document.getElementById('propOpacity');
    const ps = document.getElementById('propStrokeWidth');

    if (px) px.value = '';
    if (py) py.value = '';
    if (pw) pw.value = '';
    if (ph) ph.value = '';
    if (po) po.value = 100;
    if (ps) ps.value = 1;

    updateColorBarVisual(document.getElementById('strokeColorBar'), '#CBD5E1');

    const ctxTblWrapper = document.getElementById('ctxTableSettingsWrapper');
    if (ctxTblWrapper) ctxTblWrapper.style.display = 'none';

    updateUnifiedBgBar();
  }

  // ================= 표 셀 텍스트, 전체 선택 및 정밀 2x2 행/열 관리 =================
  window.selectAllTableCells = function () {
    const obj = canvas.getActiveObject();
    if (!obj || !obj.isTable) return;
    const allKeys = [];
    for (let r = 0; r < obj.tableRows; r++) {
      for (let c = 0; c < obj.tableCols; c++) {
        allKeys.push(`${r}_${c}`);
      }
    }
    obj.selectedCells = allKeys;
    updateTableHighlights(obj);
    updateInspector(obj);
    showToast(`표의 모든 셀(${obj.tableRows}×${obj.tableCols})이 선택되었습니다.`);
  };

  window.updateSelectedCellText = function (val) {
    const obj = canvas.getActiveObject();
    if (obj && obj.isTable && obj.selectedCell) {
      if (obj.selectedCell.isSubCell) {
        if (!obj.subCellData) obj.subCellData = {};
        obj.subCellData[obj.selectedCell.key] = val;
      } else {
        const { r, c } = obj.selectedCell;
        if (!obj.tableData[r]) obj.tableData[r] = [];
        obj.tableData[r][c] = val;
      }
      rebuildTableGroup(obj);
      saveCurrentSlideState();
    }
  };

  // 행/열 라디오 상태에 따른 2x2 UI 버튼 상태 갱신
  window.updateTableDpadUI = function () {
    const targetType = document.querySelector('input[name="tblTargetType"]:checked')?.value || 'row';
    const actionType = document.querySelector('input[name="tblActionType"]:checked')?.value || 'insert';
    const tblBtnUp = document.getElementById('tblBtnUp');
    const tblBtnDown = document.getElementById('tblBtnDown');
    const tblBtnLeft = document.getElementById('tblBtnLeft');
    const tblBtnRight = document.getElementById('tblBtnRight');

    if (!tblBtnUp || !tblBtnDown || !tblBtnLeft || !tblBtnRight) return;

    // 버튼 글자는 [위/아래/왼쪽/오른쪽]으로 고정
    tblBtnUp.textContent = '⬆️ 위';
    tblBtnDown.textContent = '⬇️ 아래';
    tblBtnLeft.textContent = '⬅️ 왼쪽';
    tblBtnRight.textContent = '➡️ 오른쪽';

    const obj = canvas ? canvas.getActiveObject() : null;
    const isTbl = obj && obj.isTable;
    const cell = isTbl ? (obj.selectedCell || { r: 0, c: 0 }) : { r: 0, c: 0 };
    const r = cell.r;
    const c = cell.c;
    const totalR = isTbl ? obj.tableRows : 3;
    const totalC = isTbl ? obj.tableCols : 3;

    if (targetType === 'row') {
      tblBtnLeft.disabled = true;
      tblBtnRight.disabled = true;
      if (actionType === 'insert') {
        tblBtnUp.disabled = false;
        tblBtnDown.disabled = false;
      } else {
        // 가장자리에 더 이상 행이 없으면 삭제 버튼 비활성화 (최소 1행 유지)
        tblBtnUp.disabled = (totalR <= 1 || r === 0);
        tblBtnDown.disabled = (totalR <= 1 || r >= totalR - 1);
      }
    } else {
      tblBtnUp.disabled = true;
      tblBtnDown.disabled = true;
      if (actionType === 'insert') {
        tblBtnLeft.disabled = false;
        tblBtnRight.disabled = false;
      } else {
        // 가장자리에 더 이상 열이 없으면 삭제 버튼 비활성화 (최소 1열 유지)
        tblBtnLeft.disabled = (totalC <= 1 || c === 0);
        tblBtnRight.disabled = (totalC <= 1 || c >= totalC - 1);
      }
    }
  };

  // 2x2 직관적인 행/열 작업 핸들러 (선택 셀 기준 정확한 위/아래/왼쪽/오른쪽 삽입 및 삭제)
  window.onTableAction = function (direction) {
    const obj = canvas.getActiveObject();
    if (!obj || !obj.isTable) return;
    const cell = obj.selectedCell || { r: 0, c: 0 };
    const targetType = document.querySelector('input[name="tblTargetType"]:checked')?.value || 'row';
    const actionType = document.querySelector('input[name="tblActionType"]:checked')?.value || 'insert';

    if (actionType === 'delete') {
      if (targetType === 'row') {
        if (direction === 'up' && cell.r > 0) {
          deleteRowAt(obj, cell.r - 1);
          cell.r = Math.max(0, cell.r - 1);
          obj.selectedCell = cell;
          obj.selectedCells = [`${cell.r}_${cell.c}`];
        } else if (direction === 'down' && cell.r < obj.tableRows - 1) {
          deleteRowAt(obj, cell.r + 1);
        }
      } else if (targetType === 'col') {
        if (direction === 'left' && cell.c > 0) {
          deleteColAt(obj, cell.c - 1);
          cell.c = Math.max(0, cell.c - 1);
          obj.selectedCell = cell;
          obj.selectedCells = [`${cell.r}_${cell.c}`];
        } else if (direction === 'right' && cell.c < obj.tableCols - 1) {
          deleteColAt(obj, cell.c + 1);
        }
      }
    } else {
      // 삽입 모드
      if (targetType === 'row') {
        if (direction === 'up') {
          insertRowAt(obj, cell.r); // 선택 행 위쪽에 삽입
        } else if (direction === 'down') {
          insertRowAt(obj, cell.r + 1); // 선택 행 아래쪽에 삽입
        }
      } else if (targetType === 'col') {
        if (direction === 'left') {
          insertColAt(obj, cell.c); // 선택 열 왼쪽에 삽입
        } else if (direction === 'right') {
          insertColAt(obj, cell.c + 1); // 선택 열 오른쪽에 삽입
        }
      }
    }
    window.updateTableDpadUI();
  };

  // 하위 호환성 유지용 alias
  window.onDpadClick = window.onTableAction;

  function shiftTableMerges(tableObj, type, index, delta) {
    if (!Array.isArray(tableObj.merges) || tableObj.merges.length === 0) return;
    const isRow = (type === 'row');
    const newMerges = [];

    for (let i = 0; i < tableObj.merges.length; i++) {
      const m = { ...tableObj.merges[i] };
      const start = isRow ? m.r : m.c;
      const span = isRow ? (m.rowspan || 1) : (m.colspan || 1);
      const end = start + span - 1;

      if (delta > 0) {
        // 삽입
        if (start >= index) {
          if (isRow) m.r += delta; else m.c += delta;
          newMerges.push(m);
        } else if (start < index && end >= index) {
          // 병합 영역 내부에서 삽입 -> span 늘어남
          if (isRow) m.rowspan += delta; else m.colspan += delta;
          newMerges.push(m);
        } else {
          newMerges.push(m);
        }
      } else {
        // 삭제 (delta === -1)
        if (end < index) {
          newMerges.push(m);
        } else if (start > index) {
          if (isRow) m.r -= 1; else m.c -= 1;
          newMerges.push(m);
        } else if (start === index && span === 1) {
          // 1칸짜리 병합이 삭제됨 -> 제거
        } else if (start === index && span > 1) {
          // 시작 셀이 삭제됨 -> 시작 위치는 그대로, span 1 감소
          if (isRow) m.rowspan -= 1; else m.colspan -= 1;
          if ((isRow ? m.rowspan : m.colspan) > 1 || (isRow ? m.colspan : m.rowspan) > 1) {
            newMerges.push(m);
          }
        } else if (start < index && end >= index) {
          // 중간 또는 끝 셀이 삭제됨 -> span 1 감소
          if (isRow) m.rowspan -= 1; else m.colspan -= 1;
          if ((isRow ? m.rowspan : m.colspan) > 1 || (isRow ? m.colspan : m.rowspan) > 1) {
            newMerges.push(m);
          }
        }
      }
    }
    tableObj.merges = newMerges;
  }

  function insertRowAt(obj, insertIndex) {
    insertIndex = Math.max(0, Math.min(obj.tableRows, insertIndex));
    const newRow = [];
    for (let c = 0; c < obj.tableCols; c++) {
      newRow.push(insertIndex === 0 ? `항목 ${c + 1}` : `내용`);
    }
    obj.tableData.splice(insertIndex, 0, newRow);
    obj.tableRows += 1;

    // 행 높이 배열 동기화
    if (!obj.rowHeights) obj.rowHeights = Array(obj.tableRows - 1).fill(56);
    const avgH = obj.rowHeights.length > 0 ? (obj.rowHeights.reduce((a, b) => a + b, 0) / obj.rowHeights.length) : 56;
    obj.rowHeights.splice(insertIndex, 0, Math.round(avgH));
    obj.height = obj.rowHeights.reduce((a, b) => a + b, 0);

    shiftTablePropertyRows(obj, insertIndex, 1);
    shiftTableMerges(obj, 'row', insertIndex, 1);
    obj.selectedCell = { r: insertIndex, c: obj.selectedCell ? obj.selectedCell.c : 0 };
    obj.selectedCells = [`${obj.selectedCell.r}_${obj.selectedCell.c}`];
    rebuildTableGroup(obj);
    saveCurrentSlideState();
    showToast(`새 행이 삽입되었습니다 (${insertIndex + 1}행, 총 ${obj.tableRows}행)`);
  }

  function deleteRowAt(obj, deleteIndex) {
    if (obj.tableRows <= 1) {
      showToast('더 이상 행을 삭제할 수 없습니다 (최소 1행 유지).');
      return;
    }
    deleteIndex = Math.max(0, Math.min(obj.tableRows - 1, deleteIndex));
    obj.tableData.splice(deleteIndex, 1);
    obj.tableRows -= 1;

    if (obj.rowHeights && obj.rowHeights.length > deleteIndex) {
      obj.rowHeights.splice(deleteIndex, 1);
      obj.height = obj.rowHeights.reduce((a, b) => a + b, 0);
    }

    shiftTablePropertyRows(obj, deleteIndex, -1);
    shiftTableMerges(obj, 'row', deleteIndex, -1);
    if (obj.selectedCell) {
      obj.selectedCell.r = Math.min(obj.selectedCell.r, obj.tableRows - 1);
    }
    obj.selectedCells = [`${obj.selectedCell.r}_${obj.selectedCell.c}`];
    rebuildTableGroup(obj);
    saveCurrentSlideState();
    showToast(`선택한 행이 삭제되었습니다 (총 ${obj.tableRows}행)`);
  }

  function insertColAt(obj, insertIndex) {
    insertIndex = Math.max(0, Math.min(obj.tableCols, insertIndex));
    for (let r = 0; r < obj.tableRows; r++) {
      if (!obj.tableData[r]) obj.tableData[r] = [];
      obj.tableData[r].splice(insertIndex, 0, r === 0 ? `항목` : `내용`);
    }
    obj.tableCols += 1;

    // 열 너비 배열 동기화
    if (!obj.colWidths) obj.colWidths = Array(obj.tableCols - 1).fill(160);
    const avgW = obj.colWidths.length > 0 ? (obj.colWidths.reduce((a, b) => a + b, 0) / obj.colWidths.length) : 160;
    obj.colWidths.splice(insertIndex, 0, Math.round(avgW));
    obj.width = obj.colWidths.reduce((a, b) => a + b, 0);

    shiftTablePropertyCols(obj, insertIndex, 1);
    shiftTableMerges(obj, 'col', insertIndex, 1);
    obj.selectedCell = { r: obj.selectedCell ? obj.selectedCell.r : 0, c: insertIndex };
    obj.selectedCells = [`${obj.selectedCell.r}_${obj.selectedCell.c}`];
    rebuildTableGroup(obj);
    saveCurrentSlideState();
    showToast(`새 열이 삽입되었습니다 (${insertIndex + 1}열, 총 ${obj.tableCols}열)`);
  }

  function deleteColAt(obj, deleteIndex) {
    if (obj.tableCols <= 1) {
      showToast('더 이상 열을 삭제할 수 없습니다 (최소 1열 유지).');
      return;
    }
    deleteIndex = Math.max(0, Math.min(obj.tableCols - 1, deleteIndex));
    for (let r = 0; r < obj.tableRows; r++) {
      if (obj.tableData[r]) {
        obj.tableData[r].splice(deleteIndex, 1);
      }
    }
    obj.tableCols -= 1;

    if (obj.colWidths && obj.colWidths.length > deleteIndex) {
      obj.colWidths.splice(deleteIndex, 1);
      obj.width = obj.colWidths.reduce((a, b) => a + b, 0);
    }

    shiftTablePropertyCols(obj, deleteIndex, -1);
    shiftTableMerges(obj, 'col', deleteIndex, -1);
    if (obj.selectedCell) {
      obj.selectedCell.c = Math.min(obj.selectedCell.c, obj.tableCols - 1);
    }
    obj.selectedCells = [`${obj.selectedCell.r}_${obj.selectedCell.c}`];
    rebuildTableGroup(obj);
    saveCurrentSlideState();
    showToast(`선택한 열이 삭제되었습니다 (총 ${obj.tableCols}열)`);
  }

  function shiftTablePropertyRows(obj, targetIndex, delta) {
    const propNames = ['cellFills', 'cellColors', 'cellBorderColors', 'cellBorderWidths', 'cellFonts', 'cellFontSizes', 'cellBolds', 'cellItalics', 'cellUnderlines', 'cellAligns'];
    const prevSelR = obj.selectedCell ? obj.selectedCell.r : 0;
    const prevSelC = obj.selectedCell ? obj.selectedCell.c : 0;
    const refR = delta > 0 ? (targetIndex > 0 ? targetIndex - 1 : 1) : -1;

    propNames.forEach(prop => {
      // 글씨 크기나 서식의 경우 기존 설정이 없더라도 필요 시 객체 생성
      if (!obj[prop] && delta <= 0) return;
      if (!obj[prop] && (prop === 'cellFontSizes' || prop === 'cellFonts' || prop === 'cellColors' || prop === 'cellAligns')) {
        obj[prop] = {};
      }
      if (!obj[prop]) return;

      const oldMap = obj[prop];
      const newMap = {};
      Object.keys(oldMap).forEach(key => {
        const parts = key.split('_');
        let r = parseInt(parts[0], 10);
        const c = parseInt(parts[1], 10);
        if (delta > 0) {
          if (r >= targetIndex) r += delta;
          newMap[`${r}_${c}`] = oldMap[key];
        } else if (delta < 0) {
          if (r === targetIndex) return;
          if (r > targetIndex) r += delta;
          newMap[`${r}_${c}`] = oldMap[key];
        }
      });

      // 새 행 삽입 시: 각 열별로 인접 기준 행(refR)의 서식(글씨 크기 등) 자동 상속
      if (delta > 0 && refR >= 0) {
        for (let c = 0; c < obj.tableCols; c++) {
          const newKey = `${targetIndex}_${c}`;
          // 1. 기준 행의 동일 열 셀 서식
          let inherited = newMap[`${refR}_${c}`];
          // 2. 없으면 이전 선택 셀의 서식
          if (inherited === undefined) {
            inherited = oldMap[`${prevSelR}_${prevSelC}`];
          }
          // 3. 없으면 기준 행의 첫 번째 정의된 서식
          if (inherited === undefined) {
            for (let oc = 0; oc < obj.tableCols; oc++) {
              if (newMap[`${refR}_${oc}`] !== undefined) {
                inherited = newMap[`${refR}_${oc}`];
                break;
              }
            }
          }
          // 4. 글씨 크기/글꼴/색상/정렬의 경우 표 전체 대표값 상속
          if (inherited === undefined && (prop === 'cellFontSizes' || prop === 'cellFonts' || prop === 'cellColors' || prop === 'cellAligns')) {
            const vals = Object.values(oldMap);
            if (vals.length > 0) {
              inherited = vals[0];
            }
          }

          if (inherited !== undefined) {
            newMap[newKey] = inherited;
          }
        }
      }

      obj[prop] = newMap;
    });
  }

  function shiftTablePropertyCols(obj, targetIndex, delta) {
    const propNames = ['cellFills', 'cellColors', 'cellBorderColors', 'cellBorderWidths', 'cellFonts', 'cellFontSizes', 'cellBolds', 'cellItalics', 'cellUnderlines', 'cellAligns'];
    const prevSelR = obj.selectedCell ? obj.selectedCell.r : 0;
    const prevSelC = obj.selectedCell ? obj.selectedCell.c : 0;
    const refC = delta > 0 ? (targetIndex > 0 ? targetIndex - 1 : 1) : -1;

    propNames.forEach(prop => {
      if (!obj[prop] && delta <= 0) return;
      if (!obj[prop] && (prop === 'cellFontSizes' || prop === 'cellFonts' || prop === 'cellColors' || prop === 'cellAligns')) {
        obj[prop] = {};
      }
      if (!obj[prop]) return;

      const oldMap = obj[prop];
      const newMap = {};
      Object.keys(oldMap).forEach(key => {
        const parts = key.split('_');
        const r = parseInt(parts[0], 10);
        let c = parseInt(parts[1], 10);
        if (delta > 0) {
          if (c >= targetIndex) c += delta;
          newMap[`${r}_${c}`] = oldMap[key];
        } else if (delta < 0) {
          if (c === targetIndex) return;
          if (c > targetIndex) c += delta;
          newMap[`${r}_${c}`] = oldMap[key];
        }
      });

      // 새 열 삽입 시: 각 행별로 인접 기준 열(refC)의 서식(글씨 크기 등) 자동 상속
      if (delta > 0 && refC >= 0) {
        for (let r = 0; r < obj.tableRows; r++) {
          const newKey = `${r}_${targetIndex}`;
          // 1. 동일 행의 기준 열 셀 서식
          let inherited = newMap[`${r}_${refC}`];
          // 2. 없으면 이전 선택 셀의 서식
          if (inherited === undefined) {
            inherited = oldMap[`${prevSelR}_${prevSelC}`];
          }
          // 3. 없으면 기준 열의 첫 번째 정의된 서식
          if (inherited === undefined) {
            for (let or = 0; or < obj.tableRows; or++) {
              if (newMap[`${or}_${refC}`] !== undefined) {
                inherited = newMap[`${or}_${refC}`];
                break;
              }
            }
          }
          // 4. 글씨 크기/글꼴/색상/정렬의 경우 표 전체 대표값 상속
          if (inherited === undefined && (prop === 'cellFontSizes' || prop === 'cellFonts' || prop === 'cellColors' || prop === 'cellAligns')) {
            const vals = Object.values(oldMap);
            if (vals.length > 0) {
              inherited = vals[0];
            }
          }

          if (inherited !== undefined) {
            newMap[newKey] = inherited;
          }
        }
      }

      obj[prop] = newMap;
    });
  }

  window.changeOpacity = function (val) {
    const obj = canvas.getActiveObject();
    if (obj && String(val).trim() !== '') {
      const opacityVal = Math.max(0, Math.min(100, parseInt(val, 10) || 0));
      obj.set('opacity', opacityVal / 100);
      canvas.renderAll();
      saveCurrentSlideState();
      recordHistory();
    }
  };

  window.changeFill = function (color) {
    const obj = canvas.getActiveObject();
    if (obj) {
      if (obj.type === 'activeSelection') {
        obj.getObjects().forEach(o => {
          if (o.type === 'textbox' || o.type === 'text') o.set('backgroundColor', color);
          else if (!o.isTable && !o.isVideo && o.type !== 'group' && o.type !== 'image') o.set('fill', color);
        });
        obj.dirty = true;
        canvas.renderAll();
      } else if (obj.isTable) {
        if (!obj.cellFills) obj.cellFills = {};
        const targetKeys = getTableTargetKeys(obj);
        targetKeys.forEach(k => {
          obj.cellFills[k] = color;
        });
        rebuildTableGroup(obj);
      } else {
        obj.set('fill', color);
        canvas.renderAll();
      }
      updateUnifiedBgBar();
      saveCurrentSlideState();
      recordHistory();
    }
  };

  // 도형, 텍스트 상자 및 표 셀 테두리 색상 실시간 설정
  window.changeStrokeColor = function (color) {
    const activeObj = canvas.getActiveObject();
    if (!activeObj) return;

    const applyColorToObj = (target) => {
      if (target.isTable) {
        if (!target.cellBorderColors) target.cellBorderColors = {};
        const targetKeys = getTableTargetKeys(target);
        targetKeys.forEach(k => {
          target.cellBorderColors[k] = color;
        });
        rebuildTableGroup(target);
      } else if (target.type === 'textbox' || target.type === 'text') {
        target.boxStroke = color;
        if (!target.boxStrokeWidth || target.boxStrokeWidth === 0) {
          target.boxStrokeWidth = 1 * PX_PER_PT;
          target.strokeWidthPt = 1;
          const sw = document.getElementById('propStrokeWidth');
          if (sw) sw.value = 1;
        }
        target.set({ stroke: null, strokeWidth: 0 }); // 글자 획 외곽선은 투명 유지
        target.dirty = true;
      } else {
        target.set('stroke', color);
        target.set('strokeUniform', true);
        if (!target.strokeWidth || target.strokeWidth === 0) {
          target.set('strokeWidth', 1 * PX_PER_PT);
          target.strokeWidthPt = 1;
          const sw = document.getElementById('propStrokeWidth');
          if (sw) sw.value = 1;
        }
        target.dirty = true;
      }
      target.setCoords();
    };

    if (activeObj.type === 'activeSelection') {
      activeObj.getObjects().forEach(applyColorToObj);
      activeObj.dirty = true;
    } else {
      applyColorToObj(activeObj);
    }

    updateColorBarVisual(document.getElementById('strokeColorBar'), color);
    canvas.renderAll(); // 실시간 즉각 강제 렌더링
    saveCurrentSlideState();
    recordHistory();
  };

  // 도형, 텍스트 상자 및 표 셀 테두리 굵기(pt) 실시간 설정 - 파워포인트 표준 pt 단위 일원화
  window.changeStrokeWidth = function (val) {
    const activeObj = canvas.getActiveObject();
    if (!activeObj) return;
    const widthPt = parseFloat(val);
    const validPt = isNaN(widthPt) ? 0 : Math.max(0, widthPt);

    const applyWidthToObj = (target) => {
      target.strokeWidthPt = validPt;
      if (target.isTable) {
        if (!target.cellBorderWidths) target.cellBorderWidths = {};
        const targetKeys = getTableTargetKeys(target);
        targetKeys.forEach(k => {
          target.cellBorderWidths[k] = validPt;
        });
        rebuildTableGroup(target);
      } else if (target.type === 'textbox' || target.type === 'text') {
        target.boxStrokeWidth = validPt * PX_PER_PT;
        if (validPt > 0 && (!target.boxStroke || target.boxStroke === 'transparent')) {
          target.boxStroke = '#334155';
          updateColorBarVisual(document.getElementById('strokeColorBar'), '#334155');
        }
        target.set({ stroke: null, strokeWidth: 0 }); // 글자 획 외곽선 오염 원천 방지
        target.dirty = true;
      } else {
        target.set({
          strokeWidth: validPt * PX_PER_PT,
          strokeUniform: true
        });
        if (validPt > 0 && (!target.stroke || target.stroke === 'transparent')) {
          target.set('stroke', '#334155');
          updateColorBarVisual(document.getElementById('strokeColorBar'), '#334155');
        }
        target.dirty = true;
      }
      target.setCoords();
    };

    if (activeObj.type === 'activeSelection') {
      activeObj.getObjects().forEach(applyWidthToObj);
      activeObj.dirty = true;
    } else {
      applyWidthToObj(activeObj);
    }

    canvas.renderAll(); // 실시간 즉각 강제 렌더링
    saveCurrentSlideState();
    recordHistory();
  };

  // ================= 15. 위로 / 아래로 직관적인 레이어 순서 =================
  window.bringForward = function () {
    const obj = canvas.getActiveObject();
    if (obj) {
      obj.bringForward();
      canvas.renderAll();
      saveCurrentSlideState();
      showToast('위로 올렸습니다.');
    }
  };

  window.sendBackward = function () {
    const obj = canvas.getActiveObject();
    if (obj) {
      obj.sendBackwards();
      canvas.renderAll();
      saveCurrentSlideState();
      showToast('아래로 내렸습니다.');
    }
  };

  window.bringToFront = function () {
    const obj = canvas.getActiveObject();
    if (obj) {
      obj.bringToFront();
      canvas.renderAll();
      saveCurrentSlideState();
      showToast('맨 위로 올렸습니다.');
    }
  };

  window.sendToBack = function () {
    const obj = canvas.getActiveObject();
    if (obj) {
      obj.sendToBack();
      canvas.renderAll();
      saveCurrentSlideState();
      showToast('맨 아래로 내렸습니다.');
    }
  };

  window.deleteSelected = function () {
    const activeObj = canvas.getActiveObject();
    if (!activeObj) return;

    if (activeObj.type === 'activeSelection') {
      const objects = activeObj.getObjects().slice();
      canvas.discardActiveObject();
      objects.forEach(obj => {
        canvas.remove(obj);
      });
    } else {
      canvas.remove(activeObj);
      canvas.discardActiveObject();
    }
    canvas.renderAll();
    saveCurrentSlideState();
    recordHistory();
    clearInspector();
    showToast('선택한 개체가 삭제되었습니다 (Del)');
  };

  // ================= 16. 실제 슬라이드 축소 화면 썸네일 시스템 =================
  function generateSlideThumbnailFromData(slide) {
    if (!slide) return null;
    const mini = document.createElement('canvas');
    mini.width = 640;
    mini.height = 360;
    const ctx = mini.getContext('2d');
    const scale = 640 / CANVAS_WIDTH; // 1920 기준 1/3 고해상도 축소 드로잉

    // 1. 슬라이드 배경색
    ctx.fillStyle = slide.background || '#FFFFFF';
    ctx.fillRect(0, 0, mini.width, mini.height);

    // 2. 요소 축소 드로잉
    (slide.elements || []).forEach(el => {
      const x = (el.left || 0) * scale;
      const y = (el.top || 0) * scale;
      const w = (el.width || 100) * scale;
      const h = (el.height || 60) * scale;

      ctx.save();
      ctx.globalAlpha = el.opacity !== undefined ? el.opacity : 1;

      if (el.type === 'rect') {
        ctx.fillStyle = el.fill && el.fill !== 'transparent' ? el.fill : 'transparent';
        if (el.rx > 0) {
          const r = Math.min(el.rx * scale, w / 2, h / 2);
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(x, y, w, h, r);
          } else {
            ctx.rect(x, y, w, h);
          }
          ctx.fill();
        } else {
          ctx.fillRect(x, y, w, h);
        }
        if (el.stroke && el.strokeWidth) {
          ctx.strokeStyle = el.stroke;
          ctx.lineWidth = Math.max(1, el.strokeWidth * scale);
          ctx.stroke();
        }
      } else if (el.type === 'circle') {
        ctx.fillStyle = el.fill && el.fill !== 'transparent' ? el.fill : 'transparent';
        ctx.beginPath();
        ctx.arc(x + w / 2, y + h / 2, w / 2, 0, Math.PI * 2);
        ctx.fill();
        if (el.stroke && el.strokeWidth) {
          ctx.strokeStyle = el.stroke;
          ctx.lineWidth = Math.max(1, el.strokeWidth * scale);
          ctx.stroke();
        }
      } else if (el.type === 'triangle') {
        ctx.fillStyle = el.fill && el.fill !== 'transparent' ? el.fill : 'transparent';
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        ctx.fill();
        if (el.stroke && el.strokeWidth) {
          ctx.strokeStyle = el.stroke;
          ctx.lineWidth = Math.max(1, el.strokeWidth * scale);
          ctx.stroke();
        }
      } else if (el.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y);
        ctx.strokeStyle = el.stroke || '#2563EB';
        ctx.lineWidth = Math.max(1, (el.strokeWidth || 4) * scale);
        ctx.stroke();
      } else if (el.type === 'arrow') {
        ctx.fillStyle = el.fill && el.fill !== 'transparent' ? el.fill : 'transparent';
        ctx.beginPath();
        ctx.moveTo(x, y + h * 0.35);
        ctx.lineTo(x + w * 0.6, y + h * 0.35);
        ctx.lineTo(x + w * 0.6, y);
        ctx.lineTo(x + w, y + h * 0.5);
        ctx.lineTo(x + w * 0.6, y + h);
        ctx.lineTo(x + w * 0.6, y + h * 0.65);
        ctx.lineTo(x, y + h * 0.65);
        ctx.closePath();
        ctx.fill();
      } else if (el.type === 'text') {
        const fontSizeMini = Math.max(4, Math.round((el.fontSize || 24) * scale));
        ctx.font = `${el.fontWeight === 'bold' ? 'bold ' : ''}${fontSizeMini}px ${el.fontFamily || 'Pretendard'}, sans-serif`;
        ctx.fillStyle = el.fill || '#0F172A';
        ctx.textBaseline = 'top';

        const lines = (el.text || '').split('\n');
        const lineHeight = fontSizeMini * 1.25;
        lines.forEach((line, lIdx) => {
          ctx.fillText(line, x, y + lIdx * lineHeight);
        });
      }
      ctx.restore();
    });

    return mini.toDataURL('image/png');
  }

  function generateAllThumbnails() {
    deckData.slides.forEach(s => {
      if (!s.thumbnail) {
        s.thumbnail = generateSlideThumbnailFromData(s);
      }
    });
    renderSlideList();
  }

  function updateCurrentSlideThumbnail() {
    if (!canvas || currentSlideIndex < 0 || !deckData.slides[currentSlideIndex]) return;
    try {
      const thumb = captureCanvasPng(640); // 줌 배율과 무관하게 일정한 크기
      deckData.slides[currentSlideIndex].thumbnail = thumb;
      const thumbEl = document.getElementById(`slideThumb-${currentSlideIndex}`);
      if (thumbEl) {
        thumbEl.innerHTML = `<img src="${thumb}" class="slide-thumb-img" alt="슬라이드 ${currentSlideIndex + 1} 미리보기">`;
      }
    } catch (e) {}
  }

  function renderSlideList() {
    const listEl = document.getElementById('slideList');
    if (!listEl) return;
    listEl.innerHTML = '';

    deckData.slides.forEach((s, idx) => {
      const item = document.createElement('div');
      item.className = `slide-item ${idx === currentSlideIndex ? 'active' : ''}`;
      item.draggable = true;
      item.setAttribute('data-index', idx);
      item.title = '드래그하여 슬라이드 순서를 이동할 수 있습니다.';

      item.onclick = () => {
        switchSlide(idx);
      };

      // HTML5 드래그 앤 드롭 슬라이드 순서 이동
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', String(idx));
        e.dataTransfer.effectAllowed = 'move';
        item.classList.add('dragging');
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        document.querySelectorAll('.slide-item').forEach(el => el.classList.remove('drag-over'));
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        item.classList.add('drag-over');
      });

      item.addEventListener('dragleave', () => {
        item.classList.remove('drag-over');
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.classList.remove('drag-over');
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const toIdx = idx;
        if (isNaN(fromIdx) || fromIdx === toIdx) return;

        saveCurrentSlideState();
        const [movedSlide] = deckData.slides.splice(fromIdx, 1);
        deckData.slides.splice(toIdx, 0, movedSlide);

        if (currentSlideIndex === fromIdx) {
          currentSlideIndex = toIdx;
        } else if (fromIdx < currentSlideIndex && toIdx >= currentSlideIndex) {
          currentSlideIndex--;
        } else if (fromIdx > currentSlideIndex && toIdx <= currentSlideIndex) {
          currentSlideIndex++;
        }

        renderSlideList();
        loadSlide(currentSlideIndex);
        showToast(`슬라이드 순서가 변경되었습니다 (${fromIdx + 1}번 ➔ ${toIdx + 1}번)`);
      });

      const thumbImgSrc = s.thumbnail || generateSlideThumbnailFromData(s);
      s.thumbnail = thumbImgSrc;

      // 드래그로 순서 이동하므로 ▲/▼ 버튼 대신 깔끔한 복제(📋)와 삭제(-) 버튼 유지
      item.innerHTML = `
        <div class="slide-item-header">
          <span class="slide-number">슬라이드 ${idx + 1}</span>
          <div class="slide-header-actions">
            <button class="slide-action-btn" onclick="window.duplicateSlide(${idx}, event)" title="슬라이드 복제">📋</button>
            <button class="slide-del-btn" onclick="window.deleteSlide(${idx}, event)" title="슬라이드 삭제">❌</button>
          </div>
        </div>
        <div class="slide-thumb" id="slideThumb-${idx}">
          <img src="${thumbImgSrc}" class="slide-thumb-img" alt="슬라이드 ${idx + 1} 미리보기">
        </div>
      `;
      item.tabIndex = 0;
      item.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'PageUp') {
          e.preventDefault();
          if (idx > 0) switchSlide(idx - 1);
        } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
          e.preventDefault();
          if (idx < deckData.slides.length - 1) switchSlide(idx + 1);
        }
      });
      listEl.appendChild(item);
    });

    const addBottomBtn = document.createElement('button');
    addBottomBtn.className = 'add-slide-bottom-btn';
    addBottomBtn.innerHTML = '<span>➕ 슬라이드 추가</span>';
    addBottomBtn.onclick = () => window.addNewSlide();
    listEl.appendChild(addBottomBtn);
  }

  function updateSlideListActive() {
    const items = document.querySelectorAll('.slide-item');
    items.forEach((item, idx) => {
      const isActive = (idx === currentSlideIndex);
      item.classList.toggle('active', isActive);
      if (isActive) {
        // 활성화된 슬라이드 썸네일로 부드럽게 스크롤 동기화
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    });
  }

  window.duplicateSlide = function (idx, e) {
    if (e) e.stopPropagation();
    saveCurrentSlideState();
    const target = deckData.slides[idx];
    if (!target) return;
    const cloned = JSON.parse(JSON.stringify(target));
    cloned.id = `slide-${Date.now()}`;
    cloned.title = `${target.title || '슬라이드'} (복제)`;
    cloned.thumbnail = generateSlideThumbnailFromData(cloned);
    deckData.slides.splice(idx + 1, 0, cloned);
    renderSlideList();
    loadSlide(idx + 1);
    showToast(`슬라이드 ${idx + 1}이(가) 복제되었습니다.`);
  };

  window.moveSlideUp = function (idx, e) {
    if (e) e.stopPropagation();
    if (idx <= 0) return;
    saveCurrentSlideState();
    const temp = deckData.slides[idx];
    deckData.slides[idx] = deckData.slides[idx - 1];
    deckData.slides[idx - 1] = temp;
    currentSlideIndex = idx - 1;
    renderSlideList();
    loadSlide(currentSlideIndex);
    showToast('슬라이드를 위로 이동했습니다.');
  };

  window.moveSlideDown = function (idx, e) {
    if (e) e.stopPropagation();
    if (idx >= deckData.slides.length - 1) return;
    saveCurrentSlideState();
    const temp = deckData.slides[idx];
    deckData.slides[idx] = deckData.slides[idx + 1];
    deckData.slides[idx + 1] = temp;
    currentSlideIndex = idx + 1;
    renderSlideList();
    loadSlide(currentSlideIndex);
    showToast('슬라이드를 아래로 이동했습니다.');
  };

  // 새 슬라이드 생성 시 넉넉한 가로폭(width: 1520)을 기본 탑재하여 글자 잘림 방지
  window.addNewSlide = function () {
    saveCurrentSlideState();
    const newId = `slide-${deckData.slides.length + 1}`;
    const newSlide = {
      id: newId,
      title: `슬라이드 ${deckData.slides.length + 1}`,
      background: '#FFFFFF',
      elements: [
        {
          id: `el-title-${Date.now()}`,
          type: "text",
          text: "새 슬라이드 제목",
          left: 150,
          top: 100,
          width: 1520,
          height: 70,
          fontSize: 44,
          fontWeight: "bold",
          fill: "#0F172A",
          fontFamily: "맑은 고딕"
        }
      ]
    };
    newSlide.thumbnail = generateSlideThumbnailFromData(newSlide);
    const insertIdx = (typeof currentSlideIndex === 'number' && currentSlideIndex >= 0 && currentSlideIndex < deckData.slides.length)
      ? currentSlideIndex + 1
      : deckData.slides.length;
    deckData.slides.splice(insertIdx, 0, newSlide);
    renderSlideList();
    loadSlide(insertIdx);
    showToast(`새 슬라이드가 추가되었습니다 (${insertIdx + 1}번째 슬라이드)`);
  };

  window.deleteSlide = function (idx, e) {
    if (e) e.stopPropagation();
    if (deckData.slides.length <= 1) {
      showToast('최소 1개의 슬라이드는 유지되어야 합니다.');
      return;
    }
    deckData.slides.splice(idx, 1);
    if (idx < currentSlideIndex) currentSlideIndex--;
    if (currentSlideIndex >= deckData.slides.length) {
      currentSlideIndex = deckData.slides.length - 1;
    }
    renderSlideList();
    loadSlide(currentSlideIndex);
    notifySlideModified();
    showToast(`슬라이드 ${idx + 1}이(가) 삭제되었습니다.`);
  };

  window.updateProjectTitle = function (newTitle) {
    deckData.title = newTitle.trim() || 'Presentation';
    notifySlideModified(); // 제목만 바뀌므로 개체 재직렬화·썸네일 갱신은 필요 없다
  };

  // ================= 17. 색상 변환 및 PPTX 1:1 완벽 내보내기 =================
  function sanitizeColorToHex(colorStr, defaultColor = '000000') {
    if (!colorStr || colorStr === 'transparent') return defaultColor;
    colorStr = String(colorStr).trim().toLowerCase();

    // 3자리 Hex (#RGB) -> RRGGBB
    if (/^#([0-9a-f]{3})$/i.test(colorStr)) {
      const c = colorStr.substring(1);
      return (c[0] + c[0] + c[1] + c[1] + c[2] + c[2]).toUpperCase();
    }
    // 6자리 Hex (#RRGGBB) -> RRGGBB
    if (/^#([0-9a-f]{6})$/i.test(colorStr)) {
      return colorStr.substring(1, 7).toUpperCase();
    }
    // 8자리 Hex (#RRGGBBAA) -> RRGGBB
    if (/^#([0-9a-f]{8})$/i.test(colorStr)) {
      return colorStr.substring(1, 7).toUpperCase();
    }
    // rgb / rgba
    if (colorStr.startsWith('rgb')) {
      const parts = colorStr.match(/\d+/g);
      if (parts && parts.length >= 3) {
        const r = parseInt(parts[0], 10).toString(16).padStart(2, '0');
        const g = parseInt(parts[1], 10).toString(16).padStart(2, '0');
        const b = parseInt(parts[2], 10).toString(16).padStart(2, '0');
        return `${r}${g}${b}`.toUpperCase();
      }
    }
    // 명명된 기본 색상 지원
    const namedColors = {
      white: 'FFFFFF', black: '000000', red: 'EF4444', green: '22C55E', blue: '3B82F6',
      yellow: 'FACC15', orange: 'F97316', purple: 'A855F7', gray: '64748B', grey: '64748B',
      navy: '0F172A', teal: '0D9488'
    };
    if (namedColors[colorStr]) {
      return namedColors[colorStr];
    }
    return defaultColor;
  }

  window.exportToPPTX = function () {
    saveCurrentSlideState();
    showToast('파워포인트 파일(.pptx)을 생성하고 있습니다...');

    if (typeof PptxGenJS === 'undefined') {
      showToast('PptxGenJS 라이브러리가 로드되지 않아 내보낼 수 없습니다.');
      return;
    }

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';

    const PX_PER_INCH = 192;
    const PT_PER_PX = 72 / 192;

    // 그룹은 PPTX에 대응 개체가 없으므로 자식을 절대 좌표 개체로 펼친다 (자식 좌표는 그룹 중심 기준)
    function flattenGroupElements(el) {
      if (el.type !== 'group' || !Array.isArray(el.objects)) return [el];
      const sx = el.scaleX || 1;
      const sy = el.scaleY || 1;
      const cx = (el.left || 0) + (el.width || 0) * sx / 2;
      const cy = (el.top || 0) + (el.height || 0) * sy / 2;
      return el.objects.flatMap(c => flattenGroupElements({
        ...c,
        left: cx + (c.left || 0) * sx,
        top: cy + (c.top || 0) * sy,
        width: (c.width || 0) * sx,
        height: (c.height || 0) * sy,
        fontSize: c.fontSize ? c.fontSize * Math.min(sx, sy) : c.fontSize,
        x1: c.x1 !== undefined ? cx + c.x1 * sx : undefined,
        y1: c.y1 !== undefined ? cy + c.y1 * sy : undefined,
        x2: c.x2 !== undefined ? cx + c.x2 * sx : undefined,
        y2: c.y2 !== undefined ? cy + c.y2 * sy : undefined,
        opacity: (c.opacity !== undefined ? c.opacity : 1) * (el.opacity !== undefined ? el.opacity : 1)
      }));
    }

    try {
      deckData.slides.forEach(s => {
        const slide = pptx.addSlide();

        // 개체별 회전·투명도를 모든 도형/텍스트/이미지에 일괄 적용한다.
        // Fabric은 좌상단을 축으로 회전하고 PowerPoint는 중심을 축으로 회전하므로 위치를 보정한다.
        let curAngle = 0;
        let curOpacity = 1;
        const decorate = (o) => {
          const out = { ...o };
          if (curAngle) {
            const a = curAngle * Math.PI / 180;
            const cx = o.x + (o.w / 2) * Math.cos(a) - (o.h / 2) * Math.sin(a);
            const cy = o.y + (o.w / 2) * Math.sin(a) + (o.h / 2) * Math.cos(a);
            out.x = cx - o.w / 2;
            out.y = cy - o.h / 2;
            out.rotate = curAngle;
          }
          if (curOpacity < 1 && o.line && typeof o.line === 'object') {
            out.line = { ...o.line, transparency: Math.round((1 - curOpacity) * 100) };
          }
          return out;
        };
        const rawAddText = slide.addText.bind(slide);
        const rawAddShape = slide.addShape.bind(slide);
        const rawAddImage = slide.addImage.bind(slide);
        slide.addText = (t, o) => rawAddText(t, curOpacity < 1 ? { ...decorate(o), transparency: Math.round((1 - curOpacity) * 100) } : decorate(o));
        slide.addShape = (shape, o) => rawAddShape(shape, decorate(o));
        slide.addImage = (o) => rawAddImage(curOpacity < 1 ? { ...decorate(o), transparency: Math.round((1 - curOpacity) * 100) } : decorate(o));

      if (s.background) {
        slide.background = { color: sanitizeColorToHex(s.background, 'FFFFFF') };
      }

      (s.elements || []).flatMap(flattenGroupElements).forEach(el => {
        curAngle = (el.type === 'table' || el.type === 'video' || el.type === 'line') ? 0 : (el.angle || 0);
        curOpacity = el.opacity !== undefined ? el.opacity : 1;
        const leftPx = el.left || 0;
        const topPx = el.top || 0;
        const widthPx = el.width || 0;
        const heightPx = el.height || 0;

        const x = leftPx / PX_PER_INCH;
        const y = topPx / PX_PER_INCH;

        if (el.type === 'text') {
          const textLen = (el.text || '').length;
          const fontSizePx = el.fontSize || 24;
          // 1920px = 10in 슬라이드이므로 1px = 0.375pt. 편집창과 같은 비율로 내보내야 PPT에서 글자가 커지거나 줄바꿈이 달라지지 않는다.
          const fontSizePt = Math.max(1, Math.round(fontSizePx * PT_PER_PX * 100) / 100);
          const fontFace = el.fontFamily || '맑은 고딕';

          // 볼드(굵기) 판별: 'bold', 600 이상 가중치(700, 800 등) 모두 지원
          const isBoldWeight = (w) => w === 'bold' || w === '700' || w === 700 || w === '800' || w === 800 || (typeof w === 'number' && w >= 600);
          const isElementBold = isBoldWeight(el.fontWeight);

          // [가로 너비 1:1 완벽 보존]:
          // 편집창(Fabric)에 지정된 width가 있으면 그 값을 100% 최우선 신뢰하여 유지합니다.
          let finalWidthPx = widthPx;
          if (!finalWidthPx || finalWidthPx <= 0) {
            finalWidthPx = Math.min(Math.ceil(textLen * fontSizePx * 1.15) + 40, Math.max(80, CANVAS_WIDTH - leftPx));
          }

          const w = finalWidthPx / PX_PER_INCH;
          const h = Math.max((heightPx || Math.round(fontSizePx * 1.3)) / PX_PER_INCH, 0.35);

          // 유효한 인라인 문자 스타일(styles) 존재 여부 정밀 확인
          let hasActualStyles = false;
          if (el.styles && typeof el.styles === 'object') {
            for (const lineKey in el.styles) {
              const lineObj = el.styles[lineKey];
              if (lineObj && typeof lineObj === 'object' && Object.keys(lineObj).length > 0) {
                hasActualStyles = true;
                break;
              }
            }
          }

          const baseColorHex = sanitizeColorToHex(el.fill, '0F172A');

          // 텍스트 상자 외곽선(boxStroke) 또는 기본 stroke 테두리 굵기(pt) 계산
          const textBorderColor = el.boxStroke || el.stroke;
          const textBorderWidthPt = el.strokeWidthPt !== undefined
            ? el.strokeWidthPt
            : (el.boxStrokeWidth ? Math.round(el.boxStrokeWidth * PT_PER_PX * 100) / 100 : (el.strokeWidth ? Math.round(el.strokeWidth * PT_PER_PX * 100) / 100 : 0));
          const textLineOpt = textBorderColor && textBorderColor !== 'transparent' && textBorderWidthPt > 0
            ? { color: sanitizeColorToHex(textBorderColor, '000000'), width: Math.max(0.25, textBorderWidthPt) }
            : undefined;

          if (hasActualStyles) {
            // 부분 스타일이 있는 경우 TextRuns로 분할
            const textRuns = [];
            const lines = (el.text || '').split('\n');

            lines.forEach((lineText, lineIdx) => {
              if (lineIdx > 0) {
                textRuns.push({ text: '\n' });
              }
              const lineStyle = el.styles[lineIdx] || {};
              // 글자별 스타일(색, 굵기, 기울임, 밑줄, 크기, 글꼴)이 같은 구간끼리 하나의 run으로 묶는다
              const styleOf = (cs) => ({
                color: cs.fill ? sanitizeColorToHex(cs.fill, baseColorHex) : baseColorHex,
                bold: cs.fontWeight !== undefined ? isBoldWeight(cs.fontWeight) : isElementBold,
                italic: cs.fontStyle ? cs.fontStyle === 'italic' : el.fontStyle === 'italic',
                underline: cs.underline !== undefined ? !!cs.underline : !!el.underline,
                fontSize: cs.fontSize ? Math.max(1, Math.round(cs.fontSize * PT_PER_PX * 100) / 100) : fontSizePt,
                fontFace: cs.fontFamily || fontFace
              });
              let currentRunText = '';
              let currentStyle = null;

              for (let charIdx = 0; charIdx < lineText.length; charIdx++) {
                const char = lineText[charIdx];
                const st = styleOf(lineStyle[charIdx] || {});
                if (currentStyle && JSON.stringify(st) !== JSON.stringify(currentStyle)) {
                  textRuns.push({ text: currentRunText, options: currentStyle });
                  currentRunText = char;
                } else {
                  currentRunText += char;
                }
                currentStyle = st;
              }
              if (currentRunText) {
                textRuns.push({ text: currentRunText, options: currentStyle });
              }
            });

            slide.addText(textRuns, {
              x: x,
              y: y,
              w: w,
              h: h,
              fontSize: fontSizePt,
              fontFace: fontFace,
              align: el.align || 'left',
              valign: 'top',
              margin: 0,
              wrap: true,
              fill: el.backgroundColor && el.backgroundColor !== 'transparent' ? { color: sanitizeColorToHex(el.backgroundColor, 'FFFFFF') } : undefined,
              line: textLineOpt
            });
          } else {
            // 단일 스타일 텍스트: 글자색, 중앙정렬, 폰트, 굵기 완벽 반영
            slide.addText(el.text || '', {
              x: x,
              y: y,
              w: w,
              h: h,
              fontSize: fontSizePt,
              fontFace: fontFace,
              color: baseColorHex,
              bold: isElementBold,
              italic: el.fontStyle === 'italic',
              underline: !!el.underline,
              align: el.align || 'left',
              valign: 'top',
              margin: 0,
              wrap: true,
              fill: el.backgroundColor && el.backgroundColor !== 'transparent' ? { color: sanitizeColorToHex(el.backgroundColor, 'FFFFFF') } : undefined,
              line: textLineOpt
            });
          }

        } else if (el.type === 'rect') {
          const w = (el.width || 100) / PX_PER_INCH;
          const h = (el.height || 100) / PX_PER_INCH;
          const shapeType = el.rx > 0 ? pptx.shapes.ROUNDED_RECTANGLE : pptx.shapes.RECTANGLE;
          slide.addShape(shapeType, {
            x: x,
            y: y,
            w: w,
            h: h,
            fill: el.fill && el.fill !== 'transparent' ? { color: sanitizeColorToHex(el.fill, '3B82F6'), transparency: Math.round((1 - (el.opacity ?? 1)) * 100) } : undefined,
            line: el.stroke && (el.strokeWidth !== undefined ? el.strokeWidth > 0 : false) ? { color: sanitizeColorToHex(el.stroke, '000000'), width: Math.max(0.25, Math.round(el.strokeWidth * 100) / 100) } : undefined,
            rectRadius: el.rx ? Math.min(el.rx / PX_PER_INCH, Math.min(w, h) / 2) : undefined
          });
        } else if (el.type === 'circle') {
          const w = (el.width || 100) / PX_PER_INCH;
          const h = (el.height || 100) / PX_PER_INCH;
          slide.addShape(pptx.shapes.OVAL, {
            x: x,
            y: y,
            w: w,
            h: h,
            fill: el.fill && el.fill !== 'transparent' ? { color: sanitizeColorToHex(el.fill, '0D9488'), transparency: Math.round((1 - (el.opacity ?? 1)) * 100) } : undefined,
            line: el.stroke && (el.strokeWidth !== undefined ? el.strokeWidth > 0 : false) ? { color: sanitizeColorToHex(el.stroke, '000000'), width: Math.max(0.25, Math.round(el.strokeWidth * 100) / 100) } : undefined
          });
        } else if (el.type === 'triangle') {
          const w = (el.width || 220) / PX_PER_INCH;
          const h = (el.height || 180) / PX_PER_INCH;
          slide.addShape(pptx.shapes.TRIANGLE, {
            x: x,
            y: y,
            w: w,
            h: h,
            fill: el.fill && el.fill !== 'transparent' ? { color: sanitizeColorToHex(el.fill, 'F59E0B'), transparency: Math.round((1 - (el.opacity ?? 1)) * 100) } : undefined,
            line: el.stroke && (el.strokeWidth !== undefined ? el.strokeWidth > 0 : false) ? { color: sanitizeColorToHex(el.stroke, '000000'), width: Math.max(0.25, Math.round(el.strokeWidth * 100) / 100) } : undefined
          });
        } else if (el.type === 'line') {
          // 끝점 기반으로 변환해 대각선·세로선도 그대로 내보낸다. (캔버스는 선을 stroke/2만큼 안쪽에 그린다)
          const lineWidthPt = el.strokeWidth !== undefined ? el.strokeWidth : 2;
          const halfPx = (lineWidthPt * PX_PER_INCH / 72) / 2;
          const lx1 = (el.x1 !== undefined ? el.x1 : leftPx) + halfPx;
          const ly1 = (el.y1 !== undefined ? el.y1 : topPx) + halfPx;
          const lx2 = (el.x2 !== undefined ? el.x2 : leftPx + (widthPx || 300)) + halfPx;
          const ly2 = (el.y2 !== undefined ? el.y2 : topPx) + halfPx;
          slide.addShape(pptx.shapes.LINE, {
            x: Math.min(lx1, lx2) / PX_PER_INCH,
            y: Math.min(ly1, ly2) / PX_PER_INCH,
            w: Math.abs(lx2 - lx1) / PX_PER_INCH,
            h: Math.abs(ly2 - ly1) / PX_PER_INCH,
            flipV: (lx2 - lx1) * (ly2 - ly1) < 0,
            line: { color: sanitizeColorToHex(el.stroke || '#2563EB', '2563EB'), width: Math.max(0.25, Math.round(lineWidthPt * 100) / 100) }
          });
        } else if (el.type === 'arrow') {
          const w = (el.width || 240) / PX_PER_INCH;
          const h = (el.height || 100) / PX_PER_INCH;
          slide.addShape(pptx.shapes.RIGHT_ARROW, {
            x: x,
            y: y,
            w: w,
            h: h,
            fill: el.fill && el.fill !== 'transparent' ? { color: sanitizeColorToHex(el.fill, '3B82F6'), transparency: Math.round((1 - (el.opacity ?? 1)) * 100) } : undefined,
            line: el.stroke && (el.strokeWidth !== undefined ? el.strokeWidth > 0 : false) ? { color: sanitizeColorToHex(el.stroke, '000000'), width: Math.max(0.25, Math.round(el.strokeWidth * 100) / 100) } : undefined
          });
        } else if (el.type === 'star') {
          const w = (el.width || 200) / PX_PER_INCH;
          const h = (el.height || 200) / PX_PER_INCH;
          slide.addShape(pptx.shapes.STAR_5_POINT || pptx.shapes.RECTANGLE, {
            x: x,
            y: y,
            w: w,
            h: h,
            fill: el.fill && el.fill !== 'transparent' ? { color: sanitizeColorToHex(el.fill, 'FACC15'), transparency: Math.round((1 - (el.opacity ?? 1)) * 100) } : undefined,
            line: el.stroke && (el.strokeWidth !== undefined ? el.strokeWidth > 0 : false) ? { color: sanitizeColorToHex(el.stroke, '000000'), width: Math.max(0.25, Math.round(el.strokeWidth * 100) / 100) } : undefined
          });
        } else if (el.type === 'callout') {
          const w = (el.width || 240) / PX_PER_INCH;
          const h = (el.height || 140) / PX_PER_INCH;
          slide.addShape(pptx.shapes.RECTANGULAR_CALLOUT || pptx.shapes.ROUNDED_RECTANGLE, {
            x: x,
            y: y,
            w: w,
            h: h,
            fill: el.fill && el.fill !== 'transparent' ? { color: sanitizeColorToHex(el.fill, '3B82F6'), transparency: Math.round((1 - (el.opacity ?? 1)) * 100) } : undefined,
            line: el.stroke && (el.strokeWidth !== undefined ? el.strokeWidth > 0 : false) ? { color: sanitizeColorToHex(el.stroke, '000000'), width: Math.max(0.25, Math.round(el.strokeWidth * 100) / 100) } : undefined
          });
        } else if (el.type === 'image' && el.src) {
          const w = (el.width || 400) / PX_PER_INCH;
          const h = (el.height || 300) / PX_PER_INCH;
          slide.addImage({
            data: el.src,
            x: x,
            y: y,
            w: w,
            h: h
          });
        } else if (el.type === 'table') {
          const rowsCount = el.rows || el.tableRows || 3;
          const colsCount = el.cols || el.tableCols || 3;
          const tableRows = el.tableData || generateDefaultTableData(rowsCount, colsCount);

          // 편집기에서 설정한 colWidths와 rowHeights를 인치 단위로 1:1 정확하게 변환
          const colWidthsPx = (el.colWidths && el.colWidths.length === colsCount)
            ? el.colWidths
            : Array(colsCount).fill((widthPx || 800) / colsCount);
          const rowHeightsPx = (el.rowHeights && el.rowHeights.length === rowsCount)
            ? el.rowHeights
            : Array(rowsCount).fill((heightPx || 200) / rowsCount);

          const totalTableWidthPx = colWidthsPx.reduce((a, b) => a + b, 0);
          const totalTableHeightPx = rowHeightsPx.reduce((a, b) => a + b, 0);

          const w = totalTableWidthPx / PX_PER_INCH;
          const h = totalTableHeightPx / PX_PER_INCH;
          const colWInches = colWidthsPx.map(pw => pw / PX_PER_INCH);
          const rowHInches = rowHeightsPx.map(ph => ph / PX_PER_INCH);

          const pptxTableRows = [];
          for (let rIdx = 0; rIdx < tableRows.length; rIdx++) {
            const row = tableRows[rIdx];
            const pptxRow = [];
            const isHeader = (rIdx === 0);

            for (let cIdx = 0; cIdx < row.length; cIdx++) {
              const cellText = row[cIdx];
              const mInfo = getMergeInfo(el.merges, rIdx, cIdx);

              // 병합에 의해 가려진 셀(마스터 셀이 아닌 셀)은 PPTX 행렬에서 제외
              if (mInfo && !mInfo.isMaster) {
                continue;
              }

              const isMergedMaster = mInfo && mInfo.isMaster;
              const rowspan = isMergedMaster ? mInfo.merge.rowspan : undefined;
              const colspan = isMergedMaster ? mInfo.merge.colspan : undefined;

              const key = `${rIdx}_${cIdx}`;
              const defaultFill = isHeader ? '1E293B' : (rIdx % 2 === 1 ? 'FFFFFF' : 'F8FAFC');
              const defaultColor = isHeader ? 'FFFFFF' : '334155';
              const cellFillRaw = el.cellFills ? el.cellFills[key] : undefined;
              const cellFillIsTransparent = cellFillRaw === 'transparent';
              const cellFill = (cellFillRaw && !cellFillIsTransparent) ? sanitizeColorToHex(cellFillRaw, defaultFill) : defaultFill;
              const cellColor = (el.cellColors && el.cellColors[key]) ? sanitizeColorToHex(el.cellColors[key], defaultColor) : defaultColor;
              const cellBorderColor = (el.cellBorderColors && el.cellBorderColors[key]) ? sanitizeColorToHex(el.cellBorderColors[key], 'CBD5E1') : 'CBD5E1';
              const cellBorderWidth = (el.cellBorderWidths && el.cellBorderWidths[key] !== undefined) ? el.cellBorderWidths[key] : 1;

              const fontFace = (el.cellFonts && el.cellFonts[key]) || el.tableFontFamily || '맑은 고딕';
              const cellFontPx = (el.cellFontSizes && el.cellFontSizes[key]) || (isHeader ? 16 : 14); // 캔버스 기본값
              // 파워포인트 표 가독성 보정 (표 본문 최소 11pt, 헤더 최소 12pt 보장)
              const fontSizePt = Math.max(1, Math.round(cellFontPx * PT_PER_PX * 100) / 100);
              const isBold = (el.cellBolds && el.cellBolds[key] !== undefined) ? el.cellBolds[key] : isHeader;
              const isItalic = !!(el.cellItalics && el.cellItalics[key]);
              const isUnder = !!(el.cellUnderlines && el.cellUnderlines[key]);
              const align = (el.cellAligns && el.cellAligns[key]) || 'center';

              // 파워포인트 표준 pt 단위 1:1 직접 전달
              const borderPt = cellBorderWidth === 0
                ? 0
                : Math.max(0.25, cellBorderWidth);

              const cellOpts = {
                fill: cellFillIsTransparent ? { color: 'FFFFFF', transparency: 100 } : { color: cellFill },
                color: cellColor,
                bold: isBold,
                italic: isItalic,
                underline: isUnder,
                fontSize: fontSizePt,
                fontFace: fontFace,
                align: align,
                valign: 'middle',
                margin: [2, 6, 2, 6],
                border: borderPt === 0
                  ? { type: 'none' }
                  : { type: 'solid', pt: borderPt, color: cellBorderColor }
              };
              if (colspan && colspan > 1) cellOpts.colspan = colspan;
              if (rowspan && rowspan > 1) cellOpts.rowspan = rowspan;

              let finalCellText = String(cellText);
              if (el.cellSplits && el.cellSplits[key] && el.subCellData) {
                const sp = el.cellSplits[key];
                const subLines = [];
                for (let i = 0; i < (sp.rows || 1); i++) {
                  const rowParts = [];
                  for (let j = 0; j < (sp.cols || 1); j++) {
                    const sk = `${key}_${i}_${j}`;
                    const sv = el.subCellData[sk];
                    if (sv) rowParts.push(sv);
                  }
                  if (rowParts.length > 0) subLines.push(rowParts.join(' | '));
                }
                if (subLines.length > 0) finalCellText = subLines.join('\n');
              }

              pptxRow.push({
                text: finalCellText,
                options: cellOpts
              });
            }
            pptxTableRows.push(pptxRow);
          }

          slide.addTable(pptxTableRows, {
            x: x,
            y: y,
            w: w,
            h: h,
            colW: colWInches,
            rowH: rowHInches,
            autoPage: false
          });
        } else if (el.type === 'video') {
          const w = Math.max((widthPx || 640) / PX_PER_INCH, 2.5);
          const h = Math.max((heightPx || 360) / PX_PER_INCH, 1.4);

          let mediaInserted = false;
          // 실제 동영상 파일(base64 DataURL)이 있으면 PPTX 진짜 미디어 객체로 임베딩
          if (el.videoSrc && typeof slide.addMedia === 'function') {
            try {
              slide.addMedia({
                type: 'video',
                data: el.videoSrc,
                x: x,
                y: y,
                w: w,
                h: h
              });
              mediaInserted = true;
            } catch (err) {
              console.warn('PptxGenJS addMedia fallback 실행:', err);
            }
          }

          if (!mediaInserted) {
            // 단순 박스도형이 아닌, 실제 플레이어 UI와 제목/재생 버튼이 완벽히 렌더링된 비디오 카드
            slide.addShape(pptx.shapes.ROUNDED_RECTANGLE, {
              x: x,
              y: y,
              w: w,
              h: h,
              fill: { color: '0F172A' },
              line: { color: '38BDF8', width: 1.5 },
              rectRadius: 0.08
            });
            // 내부 스크린
            slide.addShape(pptx.shapes.RECTANGLE, {
              x: x + 0.1,
              y: y + 0.1,
              w: w - 0.2,
              h: h - 0.5,
              fill: { color: '1E293B' }
            });
            // 재생 원형 버튼
            const iconR = Math.min(w, h) * 0.22;
            slide.addShape(pptx.shapes.OVAL, {
              x: x + (w - iconR) / 2,
              y: y + (h - 0.5 - iconR) / 2 + 0.1,
              w: iconR,
              h: iconR,
              fill: { color: '2563EB' },
              line: { color: '38BDF8', width: 1 }
            });
            // 재생 화살표 아이콘
            slide.addShape(pptx.shapes.RIGHT_ARROW, {
              x: x + (w - iconR * 0.45) / 2 + 0.02,
              y: y + (h - 0.5 - iconR * 0.45) / 2 + 0.1,
              w: iconR * 0.45,
              h: iconR * 0.4,
              fill: { color: 'FFFFFF' }
            });
            // 하단 비디오 정보 텍스트
            slide.addText(`🎬 ${el.videoTitle || '동영상 미디어'} (${el.duration || '동영상 파일'})`, {
              x: x,
              y: y + h - 0.4,
              w: w,
              h: 0.35,
              fontSize: 11,
              fontFace: '맑은 고딕',
              color: 'F8FAFC',
              bold: true,
              align: 'center',
              valign: 'middle'
            });
          }
        }
      });
    });
  } catch (err) {
      console.error('PPTX 생성 중 오류 발생:', err);
      showToast('PPTX 생성 중 오류: ' + (err.message || err));
      return;
    }

    const rawTitle = (deckData.title || 'Presentation').trim();
    const safeTitle = rawTitle.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'Presentation';
    const fileName = `${safeTitle}.pptx`;

    if (vscode) {
      // VS Code Webview 환경: base64로 익스텐션 호스트에 전달하여 현재 작업 폴더에 직접 생성
      pptx.write({ outputType: 'base64' }).then(base64 => {
        vscode.postMessage({
          type: 'exportPPTX',
          base64: base64,
          fileName: fileName
        });
        showToast(`'${fileName}' 파일 생성을 요청했습니다!`);
      }).catch(err => {
        showToast('PPTX 생성 중 오류: ' + (err.message || err));
      });
    } else {
      pptx.writeFile({ fileName: fileName }).then(() => {
        showToast(`'${fileName}'이(가) 다운로드되었습니다!`);
      }).catch(err => {
        showToast('PPTX 다운로드 중 오류: ' + (err.message || err));
      });
    }
  };

  // ================= 18. 유틸리티 & 세션 상태 동기화 & 토스트 =================
  let toastTimer = null;
  function showToast(msg, duration = 2800) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, duration);
  }

  // 에이전트와 실시간 컨텍스트 동기화 (.slide-src/session_state.json 기록용)
  let sessionStateTimer = null;
  function notifySessionState() {
    if (!vscode || !deckData || !deckData.slides) return;
    if (sessionStateTimer) clearTimeout(sessionStateTimer);
    sessionStateTimer = setTimeout(() => {
      try {
        const slide = deckData.slides[currentSlideIndex] || {};
        const activeObj = canvas ? canvas.getActiveObject() : null;

        let selectedList = [];
        if (activeObj) {
          if (activeObj.type === 'activeSelection' && typeof activeObj.getObjects === 'function') {
            // [다중 개체 선택 지원]: 사용자가 Shift+클릭이나 드래그로 여러 개체를 동시에 잡은 경우
            const groupMatrix = activeObj.calcTransformMatrix ? activeObj.calcTransformMatrix() : null;
            selectedList = activeObj.getObjects().map((child, idx) => {
              let textSnippet = '';
              if (child.text) {
                textSnippet = String(child.text).substring(0, 60).replace(/\n/g, ' ');
              } else if (child.isTable && child.selectedCell) {
                textSnippet = `Table Cell [${child.selectedCell.r}, ${child.selectedCell.c}]`;
              }
              const childPt = groupMatrix
                ? fabric.util.transformPoint({ x: child.left, y: child.top }, groupMatrix)
                : { x: child.left, y: child.top };
              return {
                id: child.id || `selected-child-${idx + 1}`,
                type: child.type || (child.isTable ? 'table' : 'unknown'),
                role: child.role || null,
                text: textSnippet,
                left: Math.round(childPt.x || 0),
                top: Math.round(childPt.y || 0),
                width: Math.round(child.width * (child.scaleX || 1) * (activeObj.scaleX || 1)),
                height: Math.round(child.height * (child.scaleY || 1) * (activeObj.scaleY || 1))
              };
            });
          } else {
            // [단일 개체 선택]
            let textSnippet = '';
            if (activeObj.text) {
              textSnippet = String(activeObj.text).substring(0, 60).replace(/\n/g, ' ');
            } else if (activeObj.isTable && activeObj.selectedCell) {
              textSnippet = `Table Cell [${activeObj.selectedCell.r}, ${activeObj.selectedCell.c}]`;
            }
            selectedList = [{
              id: activeObj.id || null,
              type: activeObj.type || (activeObj.isTable ? 'table' : 'unknown'),
              role: activeObj.role || null,
              text: textSnippet,
              left: Math.round(activeObj.left || 0),
              top: Math.round(activeObj.top || 0),
              width: Math.round(activeObj.width * (activeObj.scaleX || 1)),
              height: Math.round(activeObj.height * (activeObj.scaleY || 1))
            }];
          }
        }

        let slideTitle = slide.title || '';
        if (!slideTitle && Array.isArray(slide.elements)) {
          const firstText = slide.elements.find(e => e.type === 'text' && (e.fontSize || 0) >= 28);
          if (firstText && firstText.text) {
            slideTitle = String(firstText.text).split('\n')[0].substring(0, 40);
          }
        }

        // 전체 슬라이드 요약 메타데이터 (에이전트가 특정 도형/타입이 있는 슬라이드를 즉시 탐색하도록 지원)
        const slidesSummary = deckData.slides.map((s, sIdx) => {
          const types = Array.from(new Set((s.elements || []).map(e => e.type || 'unknown')));
          let title = s.title || '';
          if (!title && Array.isArray(s.elements)) {
            const t = s.elements.find(e => e.type === 'text' && (e.fontSize || 0) >= 28);
            if (t && t.text) title = String(t.text).split('\n')[0].substring(0, 30);
          }
          return {
            slideNumber: sIdx + 1,
            title: title || `슬라이드 ${sIdx + 1}`,
            elementCount: (s.elements || []).length,
            elementTypes: types
          };
        });

        vscode.postMessage({
          type: 'sessionState',
          state: {
            activeSlideIndex: currentSlideIndex,
            activeSlideNumber: currentSlideIndex + 1,
            totalSlides: deckData.slides.length,
            slideTitle: slideTitle || `슬라이드 ${currentSlideIndex + 1}`,
            selectedCount: selectedList.length,
            selectedObject: selectedList[0] || null,
            selectedObjects: selectedList,
            slidesSummary: slidesSummary,
            updatedAt: new Date().toISOString()
          }
        });
      } catch (err) {}
    }, 120);
  }

  window.loadDeckData = function (data, isInitialLoad) {
    if (data && data.slides) {
      // [작업 취소 보장]: 에이전트가 외부에서 문서를 갱신하기 직전의 현재 슬라이드 상태를 undoStack에 기록!
      if (canvas && !isInitialLoad && deckData && deckData.slides && deckData.slides[currentSlideIndex]) {
        const currentSlide = deckData.slides[currentSlideIndex];
        const snapshot = JSON.stringify({
          background: currentSlide.background || '#FFFFFF',
          elements: currentSlide.elements || []
        });
        if (undoStack.length === 0 || undoStack[undoStack.length - 1] !== snapshot) {
          undoStack.push(snapshot);
        }
      }

      deckData = data;
      if (!canvas) {
        pendingDeckData = data;
        return;
      }
      const titleInput = document.getElementById('projectTitleInput');
      if (titleInput && deckData.title) {
        titleInput.value = deckData.title;
      }
      generateAllThumbnails();

      // 최초 로드 시에만 0번 슬라이드, 작업 중 동기화 시에는 현재 슬라이드 인덱스 유지!
      const targetIdx = isInitialLoad ? 0 : Math.min(Math.max(0, currentSlideIndex), deckData.slides.length - 1);
      loadSlide(targetIdx, false);

      // 에이전트가 수정한 새 슬라이드 상태도 undoStack에 push하여 사용자가 Ctrl+Z를 누르면 직전 상태로 돌아가게 함
      if (!isInitialLoad && deckData.slides[targetIdx]) {
        const newSlide = deckData.slides[targetIdx];
        const newSnapshot = JSON.stringify({
          background: newSlide.background || '#FFFFFF',
          elements: newSlide.elements || []
        });
        if (undoStack[undoStack.length - 1] !== newSnapshot) {
          undoStack.push(newSnapshot);
        }
        redoStack = [];
        updateUndoRedoButtons();
      }

      if (isInitialLoad) {
        showToast('슬라이드 문서를 불러왔습니다.');
      } else {
        showToast('에이전트의 수정사항이 반영되었습니다. (Ctrl+Z로 취소 가능)');
      }
      notifySessionState();
    }
  };

  // 실시간 자동 저장된 내용을 초기화하고 새 문서로 시작
  window.resetToDefaultDeck = function () {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    location.reload();
  };

  // VS Code Extension 양방향 통신 수신 (에이전트가 .slide.json 수정 시 즉시 캔버스 리렌더링)
  window.addEventListener('message', function (event) {
    const msg = event.data;
    if (!msg) return;
    if (msg.type === 'updateDoc' && msg.deck) {
      window.loadDeckData(msg.deck, !!msg.isInitialLoad);
    } else if (msg.type === 'gotoSlide') {
      const targetIdx = typeof msg.slideIndex === 'number'
        ? msg.slideIndex
        : (typeof msg.slideNumber === 'number' ? msg.slideNumber - 1 : 0);
      switchSlide(targetIdx);
      showToast(`에이전트가 ${targetIdx + 1}번 슬라이드를 열었습니다.`);
    } else if (msg.type === 'backupList') {
      hostBackups = Array.isArray(msg.items) ? msg.items : [];
      const modal = document.getElementById('historyModalOverlay');
      if (modal && modal.classList.contains('show')) renderHistoryList();
    } else if (msg.type === 'backupData') {
      const item = hostBackups.find(b => b.fileName === msg.fileName);
      applyRestoredDeck(msg.deck, item ? formatDateTime(new Date(item.timestamp)) : msg.fileName);
    } else if (msg.type === 'systemFontsScanned') {
      if (fontScanTimer) { clearTimeout(fontScanTimer); fontScanTimer = null; }
      if (Array.isArray(msg.fonts) && msg.fonts.length > 0) {
        handleScannedFonts(msg.fonts);
        // 에디터를 열 때의 자동 스캔은 조용히 처리하고, 버튼을 눌렀을 때만 알린다
        if (fontScanIsManual) showToast(`PC에서 ${allAvailableFonts.length}개의 폰트를 성공적으로 불러왔습니다! 🎉`, 3500);
      } else {
        reportFontScanFailure(msg.error ? msg.error : '이 PC에서 폰트 목록을 읽지 못했습니다.');
      }
      fontScanIsManual = false;
    }
  });

  // 모든 숫자 입력칸(input[type="number"])에 편리하고 미려한 커스텀 위/아래 버튼 세트 부착
  function setupCustomNumberSteppers() {
    const inputs = document.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
      if (input.parentElement && input.parentElement.classList.contains('num-stepper-box')) return;
      if (input.classList.contains('no-spinner') || input.getAttribute('data-no-stepper') === 'true') return;

      const wrapper = document.createElement('div');
      wrapper.className = 'num-stepper-box';
      if (input.id) wrapper.id = `stepper_${input.id}`;

      // 원래 인풋 스타일/클래스에 맞게 폭 설정
      if (input.classList.contains('size-input')) {
        wrapper.style.width = '64px';
      } else if (input.id === 'tblRowsInput' || input.id === 'tblColsInput') {
        wrapper.style.width = '48px';
      } else if (input.classList.contains('prop-compact-input')) {
        wrapper.style.width = (input.style.width || '58px');
      }

      input.parentNode.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      const btnsCol = document.createElement('div');
      btnsCol.className = 'num-stepper-btns';

      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'num-stepper-btn num-stepper-up';
      upBtn.tabIndex = -1;
      upBtn.innerHTML = '▲';
      upBtn.title = '값 증가';

      const downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'num-stepper-btn num-stepper-down';
      downBtn.tabIndex = -1;
      downBtn.innerHTML = '▼';
      downBtn.title = '값 감소';

      const changeVal = (delta) => {
        const step = parseFloat(input.step) || 1;
        const min = input.min !== '' ? parseFloat(input.min) : -Infinity;
        const max = input.max !== '' ? parseFloat(input.max) : Infinity;
        let cur = parseFloat(input.value);
        if (isNaN(cur)) cur = (delta > 0 ? (min !== -Infinity ? min : 0) : 0);
        let next = cur + delta * step;
        if (step < 1) {
          next = Math.round(next * 100) / 100;
        }
        next = Math.max(min, Math.min(max, next));
        input.value = next;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      };

      const bindHold = (btn, delta) => {
        let timer = null;
        let interval = null;
        const start = (e) => {
          e.preventDefault();
          e.stopPropagation();
          changeVal(delta);
          timer = setTimeout(() => {
            interval = setInterval(() => changeVal(delta), 70);
          }, 300);
        };
        const stop = () => {
          if (timer) clearTimeout(timer);
          if (interval) clearInterval(interval);
          timer = null;
          interval = null;
        };
        btn.addEventListener('mousedown', start);
        btn.addEventListener('mouseleave', stop);
        btn.addEventListener('mouseup', stop);
      };

      bindHold(upBtn, 1);
      bindHold(downBtn, -1);

      btnsCol.appendChild(upBtn);
      btnsCol.appendChild(downBtn);
      wrapper.appendChild(btnsCol);
    });
  }

  window.addEventListener('DOMContentLoaded', function () {
    initCanvas();
    setupCustomNumberSteppers();
    // 호스트에 준비 완료를 알리고 내 PC 폰트를 백그라운드 자동 스캔
    if (vscode) {
      vscode.postMessage({ type: 'ready' });
      requestSystemFonts(false);
    }
  });
})();
