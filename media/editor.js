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
  // [기현쌤 요청 반영]: 파워포인트 표준 포인트(pt) 단위 일원화 (16:9 10인치 기준 1pt = 192/72 = 2.6667px)
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
    const snapshot = JSON.stringify(deckData.slides[currentSlideIndex].elements || []);
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
    const prev = undoStack[undoStack.length - 1];
    
    deckData.slides[currentSlideIndex].elements = JSON.parse(prev);
    loadSlide(currentSlideIndex, false);
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
    const next = redoStack.pop();
    undoStack.push(next);

    deckData.slides[currentSlideIndex].elements = JSON.parse(next);
    loadSlide(currentSlideIndex, false);
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

  // [요청 반영 3]: 추천 폰트 전체 제거하고 '맑은 고딕'만 기본 유지 (나머지는 스캔으로 추가)
  let allAvailableFonts = [
    '맑은 고딕'
  ];

  // [기현쌤 요청 반영]: 브라우저 환경에서 F5 새로고침 시 초기화 방지를 위한 실시간 자동 저장 키
  const STORAGE_KEY = 'slideStudio_deckData_autosave';

  // [기현쌤 요청 반영]: 텍스트 상자 자체의 사각형 외곽 테두리(Shape Border) 렌더링 지원
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

    fabric.Object.prototype.transparentCorners = false;
    fabric.Object.prototype.cornerColor = '#3B82F6';
    fabric.Object.prototype.cornerStyle = 'circle';
    fabric.Object.prototype.cornerSize = 10;
    fabric.Object.prototype.borderColor = '#3B82F6';

    setupCanvasEvents();
    setupKeyboardShortcuts();
    setupContextMenu();
    setupSidebarResizer();
    setupColorPopovers();
    setupCtrlWheelZoom();
    populateFontSelect(allAvailableFonts);

    if (pendingDeckData) {
      deckData = pendingDeckData;
      pendingDeckData = null;
    } else {
      // [기현쌤 요청 반영]: F5 새로고침을 누르더라도 작업 내용이 날아가지 않도록 localStorage 자동 복원
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
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(deckData));
      } catch (e) {}
    });
  }

  // ================= 2. [요청 반영 4]: Ctrl + 마우스 휠 줌 (브라우저 기본 줌 원천 차단 및 에디터 줌) =================
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

  // ================= 3. [요청 반영 2, 5]: 폰트 검색 및 한글 명칭 스캔 =================
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
    if (filtered.length > 0) {
      const topFamily = typeof filtered[0] === 'string' ? filtered[0] : filtered[0].family;
      window.changeFontFamily(topFamily);
    }
  };

  window.scanLocalFonts = async function () {
    if ('queryLocalFonts' in window) {
      try {
        showToast('내 PC에 설치된 폰트를 스캔하고 있습니다...');
        const availableFonts = await window.queryLocalFonts();
        allAvailableFonts = Array.from(new Set(availableFonts.map(f => f.family)))
          .filter(name => !name.startsWith('@'))
          .sort((a, b) => {
            // 한글 매핑이 있는 폰트를 상단으로 정렬
            const aHasKo = !!FONT_KO_MAP[a.toLowerCase()];
            const bHasKo = !!FONT_KO_MAP[b.toLowerCase()];
            if (aHasKo && !bHasKo) return -1;
            if (!aHasKo && bHasKo) return 1;
            return a.localeCompare(b);
          });
        populateFontSelect(allAvailableFonts);
        showToast(`기현쌤 PC에서 ${allAvailableFonts.length}개의 폰트를 모두 불러왔습니다!`);
      } catch (err) {
        showToast('폰트 읽기 권한이 허용되지 않았습니다.');
      }
    } else {
      alert('현재 브라우저에서는 Local Font Access API를 지원하지 않습니다.\n대신 25종의 대표 시스템 폰트가 기본 제공됩니다.');
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

        if (tableResizeSession.type === 'col') {
          const deltaX = (pointer.x - tableResizeSession.startPointer.x) / (t.scaleX || 1);
          const newW = Math.max(35, Math.round(tableResizeSession.startDim + deltaX));
          tableResizeSession.pendingVal = newW;

          const guideX = pointer.x;
          const topY = t.top;
          const botY = t.top + t.getScaledHeight();
          tableResizeGuideLine.set({
            x1: guideX, y1: topY,
            x2: guideX, y2: botY
          });
          tableResizeGuideLine.bringToFront();
          canvas.requestRenderAll();
        } else if (tableResizeSession.type === 'row') {
          const deltaY = (pointer.y - tableResizeSession.startPointer.y) / (t.scaleY || 1);
          const newH = Math.max(24, Math.round(tableResizeSession.startDim + deltaY));
          tableResizeSession.pendingVal = newH;

          const guideY = pointer.y;
          const leftX = t.left;
          const rightX = t.left + t.getScaledWidth();
          tableResizeGuideLine.set({
            x1: leftX, y1: guideY,
            x2: rightX, y2: guideY
          });
          tableResizeGuideLine.bringToFront();
          canvas.requestRenderAll();
        }
        return;
      }

      // [기현쌤 요청 반영]: 표 경계선에 마우스 접근 시 col-resize, row-resize 화살표 커서 전환
      const target = canvas.getActiveObject() || opt.target;
      if (target && target.isTable && target.colWidths && target.rowHeights) {
        const pointer = canvas.getPointer(opt.e);
        const relX = (pointer.x - target.left) / (target.scaleX || 1);
        const relY = (pointer.y - target.top) / (target.scaleY || 1);

        if (relX >= -4 && relX <= target.width + 4 && relY >= -4 && relY <= target.height + 4) {
          // 세로 열 경계선 검사 (각 열 오른쪽 테두리)
          let curX = 0;
          let foundCol = -1;
          for (let c = 0; c < target.tableCols; c++) {
            curX += target.colWidths[c];
            if (Math.abs(relX - curX) <= 6 && relY >= 0 && relY <= target.height) {
              foundCol = c;
              break;
            }
          }

          // 가로 행 경계선 검사 (각 행 아래쪽 테두리)
          let curY = 0;
          let foundRow = -1;
          for (let r = 0; r < target.tableRows; r++) {
            curY += target.rowHeights[r];
            if (Math.abs(relY - curY) <= 6 && relX >= 0 && relX <= target.width) {
              foundRow = r;
              break;
            }
          }

          if (foundCol >= 0) {
            canvas.defaultCursor = 'col-resize';
            canvas.setCursor('col-resize');
            tableHoverSplit = { table: target, type: 'col', index: foundCol };
            return;
          } else if (foundRow >= 0) {
            canvas.defaultCursor = 'row-resize';
            canvas.setCursor('row-resize');
            tableHoverSplit = { table: target, type: 'row', index: foundRow };
            return;
          }
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
          canvas.renderAll();
        }
        showContextMenu(opt.e.clientX, opt.e.clientY);
        return;
      }
      hideContextMenu();
      hideAllColorPopovers();

      // [기현쌤 요청 반영]: 경계선 위에서 마우스 누르면 행/열 간격 리사이징 드래그 시작
      if (tableHoverSplit) {
        const pointer = canvas.getPointer(opt.e);
        const t = tableHoverSplit.table;
        tableResizeSession = {
          table: t,
          type: tableHoverSplit.type,
          index: tableHoverSplit.index,
          startPointer: pointer,
          startDim: tableHoverSplit.type === 'col' ? t.colWidths[tableHoverSplit.index] : t.rowHeights[tableHoverSplit.index]
        };
        t.lockMovementX = true;
        t.lockMovementY = true;
        return;
      }

      if (opt.target) {
        moveStartPos = { left: opt.target.left, top: opt.target.top };
        if (opt.target.isTable) {
          const pointer = canvas.getPointer(opt.e);
          const cell = getTableCellFromPointer(opt.target, pointer);
          const cellKey = `${cell.r}_${cell.c}`;

          // [기현쌤 요청 반영]: 일반 개체 선택과 일관되게 Shift 누르고 클릭 시 다중 선택 토글, 일반 클릭 시 단일 선택
          if (opt.e && opt.e.shiftKey) {
            if (!opt.target.selectedCells) opt.target.selectedCells = [];
            const idx = opt.target.selectedCells.indexOf(cellKey);
            if (idx >= 0) {
              if (opt.target.selectedCells.length > 1) {
                opt.target.selectedCells.splice(idx, 1);
              }
            } else {
              opt.target.selectedCells.push(cellKey);
            }
          } else {
            opt.target.selectedCells = [cellKey];
          }
          opt.target.selectedCell = cell;

          // [기현쌤 요청 반영]: mouse:down에서 객체를 rebuild하면 이동 및 모서리 크기 조절 세션이 끊기므로
          // 객체를 파괴하지 않고 하이라이트 상태만 즉시 갱신하여 표 전체 이동과 코너 리사이즈를 100% 보존합니다!
          updateTableHighlights(opt.target);
          updateInspector(opt.target);
        }
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

        // [기현쌤 요청 반영]: mouse:up 시점에 단 1회만 rebuild하여 드래그 중 객체 다중 생성 및 잔상 완벽 해결!
        if (tableResizeSession.pendingVal !== undefined) {
          if (tableResizeSession.type === 'col') {
            t.colWidths[tableResizeSession.index] = tableResizeSession.pendingVal;
            t.width = t.colWidths.reduce((a, b) => a + b, 0);
          } else if (tableResizeSession.type === 'row') {
            t.rowHeights[tableResizeSession.index] = tableResizeSession.pendingVal;
            t.height = t.rowHeights.reduce((a, b) => a + b, 0);
          }
          isTableResizingSplit = true;
          rebuildTableGroup(t);
          setTimeout(() => { isTableResizingSplit = false; }, 150);
        }

        tableResizeSession = null;
        saveCurrentSlideState();
        recordHistory();
        showToast('표의 행/열 간격이 조절되었습니다.');
      }
    });

    // 표 더블클릭 시 인라인 텍스트 편집기 오픈
    canvas.on('mouse:dblclick', function (opt) {
      const target = opt.target;
      if (target && target.isTable) {
        const pointer = canvas.getPointer(opt.e);
        const cell = getTableCellFromPointer(target, pointer);
        target.selectedCell = cell;
        openTableCellEditor(target, cell.r, cell.c);
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
        // [기현쌤 요청 반영]: 안내선 활성화 시 슬라이드 중앙(X: 960, Y: 540) 근처 접근 시 자석 스냅 지원
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
        // [기현쌤 요청 반영]: 표 크기 조절 시 내부 글자가 찌그러지지 않도록 역스케일 실시간 보정
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
    });

    canvas.on('selection:created', onObjectSelected);
    canvas.on('selection:updated', onObjectSelected);
    canvas.on('selection:cleared', onObjectCleared);

    canvas.on('object:modified', function (opt) {
      if (isTableResizingSplit) return;
      const target = opt ? opt.target : canvas.getActiveObject();
      if (target && target.isTable) {
        // [기현쌤 요청 반영]: 표 모서리 핸들 드래그(스케일 변경) 시에만 각 colWidths, rowHeights 동기화 및 rebuild
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
    });

    window.addEventListener('resize', applyCanvasZoom);
  }

  // ================= 5. 줌 컨트롤 (+, - 버튼) =================
  window.zoomIn = function () {
    canvasScale = Math.min(2.5, Math.round((canvasScale + 0.05) * 100) / 100);
    applyCanvasZoom();
  };

  window.zoomOut = function () {
    canvasScale = Math.max(0.15, Math.round((canvasScale - 0.05) * 100) / 100);
    applyCanvasZoom();
  };

  window.adjustZoomFit = function () {
    const container = document.getElementById('canvasOuter');
    if (!container || !canvas) return;
    const availableWidth = container.clientWidth - 120;
    const availableHeight = container.clientHeight - 120;

    const scaleX = availableWidth / CANVAS_WIDTH;
    const scaleY = availableHeight / CANVAS_HEIGHT;
    canvasScale = Math.min(scaleX, scaleY, 0.7);
    applyCanvasZoom();
  };

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

  // ================= 7. 단축키 및 [기현쌤 요청 반영] 통합 전체 선택 =================
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

  // ================= 7-1. [기현쌤 요청 반영]: 슬라이드 중앙선(안내선) 토글 및 렌더링 =================
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

  // ================= 7-2. [기현쌤 요청 반영]: 저장(Ctrl+S), 버전 기록(히스토리) & 백업 시스템 =================
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

  function recordBackup(reason = '사용자 저장') {
    if (!deckData || !deckData.slides) return;
    const now = new Date();
    const backupItem = {
      id: `bk-${Date.now()}`,
      timestamp: now.toISOString(),
      dateStr: formatDateTime(now),
      fileName: formatBackupFilename(deckData.title, now),
      title: deckData.title || '2025 AI 융합 수업 기획안',
      slidesCount: deckData.slides.length,
      reason: reason,
      data: JSON.parse(JSON.stringify(deckData))
    };

    const list = getBackupsList();
    list.unshift(backupItem);
    saveBackupsList(list);

    if (vscode) {
      vscode.postMessage({
        type: 'createBackupFile',
        backup: backupItem
      });
    }

    return backupItem;
  }

  window.handleManualSave = function () {
    saveCurrentSlideState();
    const bk = recordBackup('수동 저장 (Ctrl+S)');
    
    // 고해상도 캔버스 캡처 생성
    let currentScreenshot = null;
    try {
      if (canvas) {
        const guides = canvas.getObjects().filter(o => o.isGuideline);
        guides.forEach(g => { g.visible = false; });
        currentScreenshot = canvas.toDataURL({ format: 'png', multiplier: 0.5 });
        guides.forEach(g => { g.visible = true; });
      }
    } catch (e) {}

    if (vscode) {
      vscode.postMessage({
        type: 'manualSave',
        deck: deckData,
        screenshot: currentScreenshot
      });
    }

    showToast(`슬라이드가 저장되고 백업이 보관되었습니다! (${bk ? bk.fileName : '저장 완료'})`);
  };

  window.createManualBackup = function () {
    saveCurrentSlideState();
    const bk = recordBackup('즉시 백업 생성');
    renderHistoryList();
    showToast(`새 백업이 생성되었습니다: ${bk.fileName}`);
  };

  window.openHistoryModal = function () {
    const modal = document.getElementById('historyModalOverlay');
    if (!modal) return;
    renderHistoryList();
    modal.classList.add('show');
  };

  window.closeHistoryModal = function (e) {
    if (e && e.target && e.target.id !== 'historyModalOverlay') return;
    const modal = document.getElementById('historyModalOverlay');
    if (modal) modal.classList.remove('show');
  };

  function renderHistoryList() {
    const container = document.getElementById('historyListContainer');
    if (!container) return;
    const list = getBackupsList();

    if (list.length === 0) {
      container.innerHTML = `
        <div class="history-empty-notice">
          <div style="font-size: 28px; margin-bottom: 8px;">📁</div>
          <div>보관된 백업 버전이 없습니다.</div>
          <div style="font-size: 12px; color: #475569; margin-top: 4px;">저장(Ctrl+S)을 누르거나 '현재 상태 즉시 백업'을 클릭하면 안전하게 보관됩니다.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    list.forEach((item, idx) => {
      const card = document.createElement('div');
      card.className = `history-item-card ${idx === 0 ? 'current' : ''}`;
      
      const isAuto = item.reason && item.reason.includes('자동');
      const badgeClass = idx === 0 ? 'badge-current' : (isAuto ? 'badge-auto' : 'badge-manual');
      const badgeText = idx === 0 ? '최신 백업' : (item.reason || '백업');

      card.innerHTML = `
        <div class="history-info-left">
          <div class="history-file-name">
            <span>${item.fileName}</span>
            <span class="history-badge ${badgeClass}">${badgeText}</span>
          </div>
          <div class="history-meta-sub">
            <span>🕒 ${item.dateStr}</span>
            <span>📄 슬라이드 ${item.slidesCount || 1}장</span>
            <span>🏷️ ${item.title || '프레젠테이션'}</span>
          </div>
        </div>
        <div class="history-actions-right">
          <button class="history-restore-btn" onclick="window.restoreBackup('${item.id}')" title="이 시점으로 슬라이드 복원">
            <span>⟲ 복원</span>
          </button>
          <button class="history-delete-btn" onclick="window.deleteBackup('${item.id}')" title="이 백업 삭제">❌</button>
        </div>
      `;
      container.appendChild(card);
    });
  }

  window.restoreBackup = function (backupId) {
    const list = getBackupsList();
    const target = list.find(b => b.id === backupId);
    if (!target || !target.data) {
      alert('백업 데이터를 찾을 수 없습니다.');
      return;
    }

    const confirmRestore = confirm(`[${target.dateStr}] 시점의 버전으로 복원하시겠습니까?\n현재 작업 중인 상태는 복원 직전 백업으로 안전하게 자동 보관됩니다.`);
    if (!confirmRestore) return;

    // 복원 직전 현재 상태 안전 백업
    recordBackup('복원 직전 자동 백업');

    deckData = JSON.parse(JSON.stringify(target.data));
    const titleInput = document.getElementById('projectTitleInput');
    if (titleInput && deckData.title) {
      titleInput.value = deckData.title;
    }

    renderSlideList();
    loadSlide(0);
    const modal = document.getElementById('historyModalOverlay');
    if (modal) modal.classList.remove('show');
    saveCurrentSlideState();
    showToast(`'${target.dateStr}' 시점의 버전으로 성공적으로 복원되었습니다! ⟲`);
  };

  window.deleteBackup = function (backupId) {
    let list = getBackupsList();
    list = list.filter(b => b.id !== backupId);
    saveBackupsList(list);
    renderHistoryList();
    showToast('백업 항목이 삭제되었습니다.');
  };

  window.clearOldBackups = function () {
    const list = getBackupsList();
    if (list.length <= 3) {
      showToast('정리할 오래된 백업이 없습니다 (최근 3개 유지 중)');
      return;
    }
    const confirmClear = confirm('최근 3개 백업만 남기고 오래된 백업을 모두 정리하시겠습니까?');
    if (!confirmClear) return;
    saveBackupsList(list.slice(0, 3));
    renderHistoryList();
    showToast('오래된 백업이 정리되었습니다.');
  };

  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', function (e) {
      // [요청 반영 3]: 입력 필드(폰트 검색창, 글자 크기 등)에 포커스된 경우 캔버스 단축키 무시
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable) {
        return;
      }

      // [기현쌤 요청 반영]: Ctrl+S로 저장 및 백업 보관
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        window.handleManualSave();
        return;
      }

      // [기현쌤 특별 요청]: Ctrl+A로 전체 선택 (표 선택 시 표 전체 셀, 그 외 슬라이드 전체 개체)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        window.handleSelectAll();
        return;
      }

      // [요청 반영]: Ctrl+Z 실행 취소, Ctrl+Y / Ctrl+Shift+Z 다시 실행
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          window.redo();
        } else {
          window.undo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        window.redo();
        return;
      }

      const activeObj = canvas.getActiveObject();
      if (activeObj && activeObj.isEditing) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (activeObj) {
          e.preventDefault();
          deleteSelected();
        }
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        if (activeObj) {
          e.preventDefault();
          copySelected();
        }
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        if (clipboard) {
          e.preventDefault();
          pasteClipboard();
        }
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
        if (activeObj) {
          e.preventDefault();
          cutSelected();
        }
      }

      // [요청 반영 2]: Ctrl+G 그룹화, Ctrl+Shift+G 그룹 해제
      if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) {
        e.preventDefault();
        if (e.shiftKey) {
          window.ungroupSelected();
        } else {
          window.groupSelected();
        }
        return;
      }
    });
  }

  // ================= [요청 반영 2]: 그룹화 및 그룹 해제 =================
  window.groupSelected = function () {
    if (!canvas) return;
    const activeObj = canvas.getActiveObject();
    if (!activeObj) {
      showToast('그룹화할 개체들을 선택해주세요.');
      return;
    }

    if (activeObj.type === 'activeSelection') {
      const group = activeObj.toGroup();
      group.id = `el-group-${Date.now()}`;
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
      activeObj.toActiveSelection();
      canvas.requestRenderAll();
      saveCurrentSlideState();
      showToast('그룹이 해제되었습니다 (Ctrl+Shift+G)');
    } else {
      showToast('그룹화된 개체를 선택해주세요.');
    }
  };

  // [기현쌤 요청 반영]: 데이터 직렬화 기반 복사/잘라내기/붙여넣기 (표, 텍스트, 비디오, 다중선택 완벽 보존)
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
          canvas.add(createdObj);
          newObjects.push(createdObj);
          pending--;
          if (pending === 0) {
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

    // [기현쌤 요청 반영]: 크롬 기본 우클릭 메뉴 원천 차단하고 편집기 우클릭 메뉴만 띄우기
    window.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      e.stopPropagation();
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

    if (ctxTblWrapper) {
      ctxTblWrapper.style.display = isTable ? 'block' : 'none';
    }

    if (isTable) {
      if (!obj.selectedCell) obj.selectedCell = { r: 0, c: 0 };
      const { r, c } = obj.selectedCell;
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
        const val = (obj.tableData[r] && obj.tableData[r][c] !== undefined) ? obj.tableData[r][c] : '';
        cellInputEl.value = val;
      }
      if (window.updateTableDpadUI) window.updateTableDpadUI();
    }

    const estimatedHeight = isTable ? 380 : 250;
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

  // ================= 9. [요청 반영 3, 5]: 드롭다운 팝오버 메뉴 제어 =================
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
      alert('현재 브라우저 환경에서 스포이드 API를 지원하지 않습니다.');
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

  // ================= 10. [요청 반영 1]: 색상 적용 & 상단바/표/도형 연동 =================
  window.applyColorChoice = function (color) {
    addRecentColor(color);
    const obj = canvas.getActiveObject();

    if (activeColorTarget === 'text') {
      if (obj && obj.isTable) {
        // [기현쌤 요청 반영]: 표의 선택된 셀(들) 글자색 일괄 변경
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
      // [기현쌤 요청 반영]: 상단 서식 바 배경색 버튼 (텍스트박스 / 표 / 도형 통합)
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

  function switchSlide(idx) {
    if (idx < 0 || idx >= deckData.slides.length) return;
    if (idx === currentSlideIndex) return;
    isSwitchingSlide = true;
    if (canvas) {
      canvas.discardActiveObject();
      canvas.renderAll();
    }
    saveCurrentSlideState();
    loadSlide(idx);
    clearInspector();
    isSwitchingSlide = false;
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

    if (slide.elements && slide.elements.length > 0) {
      slide.elements.forEach(el => {
        createFabricObjectFromData(el, obj => {
          canvas.add(obj);
          canvas.renderAll();
        });
      });
    }
    const currentBg = slide.background || '#FFFFFF';
    updateUnifiedBgBar();

    if (showGuidelines) {
      updateGuidelines();
    }

    updateSlideListActive();
    setTimeout(updateCurrentSlideThumbnail, 50);

    if (resetHistory) {
      undoStack = [JSON.stringify(slide.elements || [])];
      redoStack = [];
      updateUndoRedoButtons();
    }
  }

  function saveCurrentSlideState() {
    const currentSlide = deckData.slides[currentSlideIndex];
    if (!currentSlide || !canvas) return;

    // [기현쌤 버그 완벽 해결]: 다중 선택(ActiveSelection) 상태에서는 객체들의 left/top이 그룹 중심 기준 상대 좌표로 변환되어 있으므로,
    // 반드시 먼저 discardActiveObject()를 호출하여 원래 캔버스 절대 좌표로 복원한 뒤 저장해야 객체 위치가 날아가지 않습니다!
    const activeObj = canvas.getActiveObject();
    let wasActiveSelection = false;
    let selectedObjects = [];

    if (activeObj && activeObj.type === 'activeSelection') {
      wasActiveSelection = true;
      selectedObjects = activeObj.getObjects().slice();
      canvas.discardActiveObject();
      canvas.renderAll();
    }

    const elements = [];
    canvas.getObjects().forEach((obj, idx) => {
      if (obj.isGuideline) return;
      elements.push(exportFabricObjectToData(obj, idx));
    });
    currentSlide.elements = elements;

    // 슬라이드 전환 중이 아닐 때(예: 편집 중 실시간 저장)는 다중 선택 상태를 다시 복원
    if (wasActiveSelection && !isSwitchingSlide && selectedObjects.length > 0) {
      const restoredSel = new fabric.ActiveSelection(selectedObjects, { canvas: canvas });
      canvas.setActiveObject(restoredSel);
      canvas.renderAll();
    }

    recordHistory();
    updateCurrentSlideThumbnail();

    // [기현쌤 요청 반영]: 브라우저 환경에서도 F5 새로고침 시 절대 초기화되지 않도록 localStorage 자동 영구 저장
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deckData));
    } catch (e) {
      console.warn('localStorage autosave failed:', e);
    }

    if (vscode) {
      vscode.postMessage({
        type: 'slideModified',
        deck: deckData
      });
    }
  }

  // [요청 반영]: 슬라이드 배경색 커스텀 변경
  window.changeSlideBackground = function (color) {
    if (!deckData.slides[currentSlideIndex]) return;
    deckData.slides[currentSlideIndex].background = color;
    canvas.setBackgroundColor(color, canvas.renderAll.bind(canvas));
    updateCurrentSlideThumbnail();
    saveCurrentSlideState();
    showToast(`슬라이드 배경색이 변경되었습니다 (${color})`);
  };

  // ================= [요청 반영]: 테이블 및 비디오 생성 헬퍼 =================
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

  function createFabricTableGroup(data) {
    const rows = data.rows || 3;
    const cols = data.cols || 3;
    const left = data.left !== undefined ? data.left : 400;
    const top = data.top !== undefined ? data.top : 280;
    const totalW = data.width || Math.min(cols * 220, 1000);
    const totalH = data.height || (rows * 56);

    // [기현쌤 요청 반영]: 열별 너비(colWidths) 및 행별 높이(rowHeights) 독립 관리
    const colWidths = (data.colWidths && data.colWidths.length === cols)
      ? [...data.colWidths]
      : Array(cols).fill(totalW / cols);
    const rowHeights = (data.rowHeights && data.rowHeights.length === rows)
      ? [...data.rowHeights]
      : Array(rows).fill(totalH / rows);

    // [기현쌤 요청 반영]: 다중 선택 셀 목록 (Ctrl+클릭 및 전체 선택 대응)
    const selectedCells = Array.isArray(data.selectedCells) && data.selectedCells.length > 0
      ? [...data.selectedCells]
      : (data.selectedCell ? [`${data.selectedCell.r}_${data.selectedCell.c}`] : ['0_0']);

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
        const cellLeft = colX[c];
        const cellTop = rowY[r];
        const cellW = colWidths[c];
        const cellH = rowHeights[r];
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

        const val = (tableData[r] && tableData[r][c] !== undefined) ? String(tableData[r][c]) : (isHeader ? `항목 ${c + 1}` : `내용`);
        
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

        // [기현쌤 요청 반영]: 모든 셀에 하이라이트 요소를 사전 생성하여 클릭 시 객체 파괴 없이 초고속 전환
        const isSelected = selectedCells.includes(cellKey);
        const hl = new fabric.Rect({
          left: cellLeft,
          top: cellTop,
          width: cellW,
          height: cellH,
          fill: 'rgba(56, 189, 248, 0.16)',
          stroke: '#38BDF8',
          strokeWidth: 2.5,
          selectable: false,
          evented: false,
          isCellHighlight: true,
          cellKey: cellKey,
          visible: isSelected,
          opacity: isSelected ? 1 : 0
        });
        highlightElements.push(hl);
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
        const active = selKeys.includes(child.cellKey);
        child.set({
          visible: active,
          opacity: active ? 1 : 0
        });
      }
    });
    canvas.requestRenderAll();
  }

  function getTableCellFromPointer(tableObj, pointer) {
    if (!tableObj || !tableObj.isTable) return { r: 0, c: 0 };
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

    return {
      r: Math.max(0, Math.min(rows - 1, foundR)),
      c: Math.max(0, Math.min(cols - 1, foundC))
    };
  }

  function openTableCellEditor(tableObj, r, c) {
    const editor = document.getElementById('tableCellEditor');
    if (!editor) return;

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
    for (let ci = 0; ci < c; ci++) accumLeft += colWidths[ci];
    let accumTop = 0;
    for (let ri = 0; ri < r; ri++) accumTop += rowHeights[ri];

    const cellW = colWidths[c];
    const cellH = rowHeights[r];

    const absLeft = (tableObj.left + accumLeft * scaleX) * canvasScale;
    const absTop = (tableObj.top + accumTop * scaleY) * canvasScale;
    const absW = (cellW * scaleX) * canvasScale;
    const absH = (cellH * scaleY) * canvasScale;

    editor.style.left = absLeft + 'px';
    editor.style.top = absTop + 'px';
    editor.style.width = Math.max(absW, 80) + 'px';
    editor.style.height = Math.max(absH, 36) + 'px';
    editor.style.display = 'block';

    const currentVal = (tableObj.tableData[r] && tableObj.tableData[r][c] !== undefined) ? tableObj.tableData[r][c] : '';
    editor.value = currentVal;
    editor.focus();
    editor.select();

    let isDone = false;
    function finishEdit() {
      if (isDone || editor.style.display === 'none') return;
      isDone = true;
      const newVal = editor.value;
      editor.style.display = 'none';
      if (!tableObj.tableData[r]) tableObj.tableData[r] = [];
      tableObj.tableData[r][c] = newVal;
      const newGroup = rebuildTableGroup(tableObj);
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

    // [기현쌤 요청 반영]: 전달된 객체가 이미 지워졌다면 같은 ID를 가진 객체 검색하여 중복 잔상 원천 차단
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
      stroke: data.stroke || null,
      strokeWidth: (data.strokeWidth || 0) * PX_PER_PT,
      strokeWidthPt: data.strokeWidth !== undefined ? data.strokeWidth : 0
    };

    if (data.type === 'text') {
      const fontSize = data.fontSize || 32;
      const lines = (data.text || '').split('\n');
      const maxLineLen = Math.max(...lines.map(l => l.length), 1);

      // [요청 반영]: 슬라이드 도화지(1920) 우측 경계를 절대 벗어나지 않도록 하드 클램핑
      const maxAllowedWidth = Math.max(80, CANVAS_WIDTH - (data.left || 0) - 50);

      let finalWidth;
      if (data.width && typeof data.width === 'number' && data.width > 0) {
        finalWidth = Math.min(data.width, maxAllowedWidth);
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
        rx: data.rx || 0,
        ry: data.ry || 0
      });
      callback(obj);
    } else if (data.type === 'circle') {
      const obj = new fabric.Circle({
        ...common,
        radius: (data.width || 100) / 2
      });
      callback(obj);
    } else if (data.type === 'triangle') {
      const obj = new fabric.Triangle({
        ...common,
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
        fill: data.fill || '#FACC15'
      });
      obj.shapeSubtype = 'star';
      callback(obj);
    } else if (data.type === 'callout') {
      const obj = new fabric.Path('M 20 0 L 220 0 C 230 0 240 10 240 20 L 240 120 C 240 130 230 140 220 140 L 80 140 L 40 180 L 50 140 L 20 140 C 10 140 0 130 0 120 L 0 20 C 0 10 10 0 20 0 Z', {
        ...common,
        fill: data.fill || '#3B82F6'
      });
      obj.shapeSubtype = 'callout';
      callback(obj);
    } else if (data.type === 'group' && Array.isArray(data.objects)) {
      fabric.util.enlivenObjects(data.objects, function (enlivenedObjects) {
        const grp = new fabric.Group(enlivenedObjects, {
          ...common,
          left: data.left,
          top: data.top
        });
        callback(grp);
      });
    } else if (data.type === 'image' && data.src) {
      fabric.Image.fromURL(data.src, function (img) {
        img.set({ ...common });
        callback(img);
      });
    }
  }

  function exportFabricObjectToData(obj, index) {
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
        left: Math.round(obj.left),
        top: Math.round(obj.top),
        width: scaledW,
        height: scaledH,
        rows: rows,
        cols: cols,
        colWidths: colWidths,
        rowHeights: rowHeights,
        selectedCells: obj.selectedCells || [],
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
        left: Math.round(obj.left),
        top: Math.round(obj.top),
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
        left: Math.round(obj.left),
        top: Math.round(obj.top),
        width: Math.round(obj.getScaledWidth()),
        height: Math.round(obj.getScaledHeight()),
        opacity: obj.opacity !== undefined ? obj.opacity : 1,
        angle: Math.round(obj.angle || 0),
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

    const data = {
      id: obj.id || `el-${index + 1}`,
      type: type,
      left: Math.round(obj.left),
      top: Math.round(obj.top),
      width: Math.round(obj.getScaledWidth()),
      height: Math.round(obj.getScaledHeight()),
      fill: typeof obj.fill === 'string' ? obj.fill : '#2563EB',
      stroke: strokeVal,
      strokeWidth: strokeWidthVal,
      opacity: obj.opacity !== undefined ? obj.opacity : 1,
      angle: Math.round(obj.angle || 0)
    };

    if (type === 'line') {
      data.x1 = Math.round(obj.x1 !== undefined ? obj.x1 : obj.left);
      data.y1 = Math.round(obj.y1 !== undefined ? obj.y1 : obj.top);
      data.x2 = Math.round(obj.x2 !== undefined ? obj.x2 : (obj.left + obj.getScaledWidth()));
      data.y2 = Math.round(obj.y2 !== undefined ? obj.y2 : obj.top);
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
      document.getElementById('fontFamilySelect').value = obj.fontFamily || '맑은 고딕';
      document.getElementById('fontSizeInput').value = Math.round(obj.fontSize);
      document.getElementById('btnBold').classList.toggle('active', obj.fontWeight === 'bold');
      document.getElementById('btnItalic').classList.toggle('active', obj.fontStyle === 'italic');
      document.getElementById('btnUnderline').classList.toggle('active', !!obj.underline);
      updateColorBarVisual(document.getElementById('textColorBar'), obj.fill || '#FFFFFF');
    } else if (obj.isTable) {
      // [기현쌤 요청 반영]: 표 선택 시에도 상단 서식 바 전체 활성화 및 현재 선택 셀 서식 동기화
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

      document.getElementById('fontFamilySelect').value = font;
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
  }

  function onObjectCleared() {
    const formatRow = document.getElementById('formatRow');
    if (formatRow) formatRow.classList.add('disabled');
    enableFormatControls(false);
    clearInspector();
  }

  // ================= 13. [기현쌤 요청 반영]: 서식 조작 (표 다중 선택 일괄 적용) =================
  window.changeFontFamily = function (font) {
    const obj = canvas.getActiveObject();
    if (obj && (obj.type === 'textbox' || obj.type === 'text')) {
      if (obj.isEditing && obj.selectionStart !== obj.selectionEnd) {
        obj.setSelectionStyles({ fontFamily: font });
      } else {
        obj.set('fontFamily', font);
      }
      canvas.renderAll();
      saveCurrentSlideState();
    } else if (obj && obj.isTable) {
      const targetKeys = getTableTargetKeys(obj);
      if (!obj.cellFonts) obj.cellFonts = {};
      targetKeys.forEach(k => {
        obj.cellFonts[k] = font;
      });
      obj.tableFontFamily = font;
      rebuildTableGroup(obj);
      saveCurrentSlideState();
    }
  };

  window.changeFontSize = function (val, isFinal = false) {
    const obj = canvas.getActiveObject();
    const newSize = Math.max(8, Math.min(144, parseInt(val, 10) || 24));
    if (obj && (obj.type === 'textbox' || obj.type === 'text')) {
      if (obj.isEditing && obj.selectionStart !== obj.selectionEnd) {
        obj.setSelectionStyles({ fontSize: newSize });
      } else {
        obj.set('fontSize', newSize);
      }
      canvas.renderAll();
      saveCurrentSlideState();
    } else if (obj && obj.isTable) {
      const targetKeys = getTableTargetKeys(obj);
      if (!obj.cellFontSizes) obj.cellFontSizes = {};
      targetKeys.forEach(k => {
        obj.cellFontSizes[k] = newSize;
      });

      // [기현쌤 요청 반영]: 실시간 타이핑 중에는 내부 텍스트의 fontSize만 즉시 변경하여
      // 입력창 포커스가 절대 끊기지 않게 하고, 입력 완료(isFinal=true) 시에만 정돈합니다.
      if (isFinal) {
        rebuildTableGroup(obj);
      } else if (obj.getObjects) {
        obj.getObjects().forEach(child => {
          if (child.isCellText && targetKeys.includes(child.cellKey)) {
            child.set({ fontSize: newSize });
          }
        });
        canvas.requestRenderAll();
      }
      saveCurrentSlideState();
    }
  };

  window.stepFontSize = function (delta) {
    const obj = canvas.getActiveObject();
    const input = document.getElementById('fontSizeInput');
    let current = input ? parseInt(input.value, 10) : 24;
    if (isNaN(current)) current = 24;
    const next = Math.max(8, Math.min(144, current + delta));
    if (input) input.value = next;
    window.changeFontSize(next, true);
  };

  window.toggleBold = function () {
    const obj = canvas.getActiveObject();
    if (obj && (obj.type === 'textbox' || obj.type === 'text')) {
      if (obj.isEditing && obj.selectionStart !== obj.selectionEnd) {
        const styles = obj.getSelectionStyles();
        const isBold = styles.every(s => s.fontWeight === 'bold');
        obj.setSelectionStyles({ fontWeight: isBold ? 'normal' : 'bold' });
      } else {
        const isBold = obj.fontWeight === 'bold';
        obj.set('fontWeight', isBold ? 'normal' : 'bold');
        document.getElementById('btnBold').classList.toggle('active', !isBold);
      }
      canvas.renderAll();
      saveCurrentSlideState();
    } else if (obj && obj.isTable) {
      const targetKeys = getTableTargetKeys(obj);
      if (!obj.cellBolds) obj.cellBolds = {};
      const firstKey = targetKeys[0] || '0_0';
      const currentBold = (obj.cellBolds[firstKey] !== undefined) ? obj.cellBolds[firstKey] : false;
      const nextBold = !currentBold;
      targetKeys.forEach(k => {
        obj.cellBolds[k] = nextBold;
      });
      document.getElementById('btnBold').classList.toggle('active', nextBold);
      rebuildTableGroup(obj);
      saveCurrentSlideState();
    }
  };

  window.toggleItalic = function () {
    const obj = canvas.getActiveObject();
    if (obj && (obj.type === 'textbox' || obj.type === 'text')) {
      if (obj.isEditing && obj.selectionStart !== obj.selectionEnd) {
        const styles = obj.getSelectionStyles();
        const isItalic = styles.every(s => s.fontStyle === 'italic');
        obj.setSelectionStyles({ fontStyle: isItalic ? 'normal' : 'italic' });
      } else {
        const isItalic = obj.fontStyle === 'italic';
        obj.set('fontStyle', isItalic ? 'normal' : 'italic');
        document.getElementById('btnItalic').classList.toggle('active', !isItalic);
      }
      canvas.renderAll();
      saveCurrentSlideState();
    } else if (obj && obj.isTable) {
      const targetKeys = getTableTargetKeys(obj);
      if (!obj.cellItalics) obj.cellItalics = {};
      const firstKey = targetKeys[0] || '0_0';
      const currentItalic = !!obj.cellItalics[firstKey];
      const nextItalic = !currentItalic;
      targetKeys.forEach(k => {
        obj.cellItalics[k] = nextItalic;
      });
      document.getElementById('btnItalic').classList.toggle('active', nextItalic);
      rebuildTableGroup(obj);
      saveCurrentSlideState();
    }
  };

  window.toggleUnderline = function () {
    const obj = canvas.getActiveObject();
    if (obj && (obj.type === 'textbox' || obj.type === 'text')) {
      if (obj.isEditing && obj.selectionStart !== obj.selectionEnd) {
        const styles = obj.getSelectionStyles();
        const isUnder = styles.every(s => s.underline);
        obj.setSelectionStyles({ underline: !isUnder });
      } else {
        const isUnderline = !!obj.underline;
        obj.set('underline', !isUnderline);
        document.getElementById('btnUnderline').classList.toggle('active', !isUnderline);
      }
      canvas.renderAll();
      saveCurrentSlideState();
    } else if (obj && obj.isTable) {
      const targetKeys = getTableTargetKeys(obj);
      if (!obj.cellUnderlines) obj.cellUnderlines = {};
      const firstKey = targetKeys[0] || '0_0';
      const currentUnder = !!obj.cellUnderlines[firstKey];
      const nextUnder = !currentUnder;
      targetKeys.forEach(k => {
        obj.cellUnderlines[k] = nextUnder;
      });
      document.getElementById('btnUnderline').classList.toggle('active', nextUnder);
      rebuildTableGroup(obj);
      saveCurrentSlideState();
    }
  };

  window.setTextAlign = function (align) {
    const obj = canvas.getActiveObject();
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
      rebuildTableGroup(obj);
      saveCurrentSlideState();
    }
  };

  // [요청 반영 2]: 배경색에 따라 어둡거나 밝은 기본 글자색 지능형 자동 지정
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

  // ================= [요청 반영 5]: 표 삽입 =================
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

  // ================= [요청 반영 5]: 비디오 미디어 삽입 =================
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
      const reader = new FileReader();
      reader.onload = function (e) {
        const dataUrl = e.target.result;
        fabric.Image.fromURL(dataUrl, function (img) {
          img.scaleToWidth(500);
          img.set({ left: 300, top: 250 });
          img.src = dataUrl;
          canvas.add(img);
          canvas.setActiveObject(img);
          canvas.renderAll();
          saveCurrentSlideState();
          showToast('이미지가 삽입되었습니다.');
        });
      };
      reader.readAsDataURL(fileInput.files[0]);
    }
  };

  // ================= 14. [기현쌤 개편]: 상단 통합 인스펙터 & 위치/크기/배경/테두리 제어 =================
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
        const curW = obj.getScaledWidth();
        if (curW > 0) obj.scaleX = (obj.scaleX || 1) * (num / curW);
      } else if (dim === 'h') {
        const curH = obj.getScaledHeight();
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
    if (pw) pw.value = Math.round(obj.getScaledWidth());
    if (ph) ph.value = Math.round(obj.getScaledHeight());
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
      const { r, c } = obj.selectedCell;
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
        const val = (obj.tableData[r] && obj.tableData[r][c] !== undefined) ? obj.tableData[r][c] : '';
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

  // ================= [기현쌤 요청 반영]: 표 셀 텍스트, 전체 선택 및 정밀 2x2 행/열 관리 =================
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
      const { r, c } = obj.selectedCell;
      if (!obj.tableData[r]) obj.tableData[r] = [];
      obj.tableData[r][c] = val;
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

    // [기현쌤 요청 반영]: 버튼 글자는 [위/아래/왼쪽/오른쪽]으로 고정
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
        // [기현쌤 요청 반영]: 가장자리에 더 이상 행이 없으면 삭제 버튼 비활성화 (최소 1행 유지)
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
        // [기현쌤 요청 반영]: 가장자리에 더 이상 열이 없으면 삭제 버튼 비활성화 (최소 1열 유지)
        tblBtnLeft.disabled = (totalC <= 1 || c === 0);
        tblBtnRight.disabled = (totalC <= 1 || c >= totalC - 1);
      }
    }
  };

  // [기현쌤 요청 반영]: 2x2 직관적인 행/열 작업 핸들러 (선택 셀 기준 정확한 위/아래/왼쪽/오른쪽 삽입 및 삭제)
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
    propNames.forEach(prop => {
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
      obj[prop] = newMap;
    });
  }

  function shiftTablePropertyCols(obj, targetIndex, delta) {
    const propNames = ['cellFills', 'cellColors', 'cellBorderColors', 'cellBorderWidths', 'cellFonts', 'cellFontSizes', 'cellBolds', 'cellItalics', 'cellUnderlines', 'cellAligns'];
    propNames.forEach(prop => {
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
      obj[prop] = newMap;
    });
  }

  window.changeOpacity = function (val) {
    const obj = canvas.getActiveObject();
    if (obj) {
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
      if (obj.isTable) {
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

  // [기현쌤 요청 반영]: 도형, 텍스트 상자 및 표 셀 테두리 색상 실시간 설정
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

  // [기현쌤 요청 반영]: 도형, 텍스트 상자 및 표 셀 테두리 굵기(pt) 실시간 설정 - 파워포인트 표준 pt 단위 일원화
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

  // ================= 15. [요청 반영 3]: 위로 / 아래로 직관적인 레이어 순서 =================
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

  // ================= 16. [요청 반영 4]: 실제 슬라이드 축소 화면 썸네일 시스템 =================
  function generateSlideThumbnailFromData(slide) {
    if (!slide) return null;
    const mini = document.createElement('canvas');
    mini.width = 320;
    mini.height = 180;
    const ctx = mini.getContext('2d');
    const scale = 320 / CANVAS_WIDTH; // 1920 기준 1/6 축소

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
      const guides = canvas.getObjects().filter(o => o.isGuideline);
      guides.forEach(g => { g.visible = false; });
      const thumb = canvas.toDataURL({ format: 'png', multiplier: 0.1666 });
      guides.forEach(g => { g.visible = true; });
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

      // [기현쌤 요청 반영]: HTML5 드래그 앤 드롭 슬라이드 순서 이동
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

      // [기현쌤 요청 반영]: 드래그로 순서 이동하므로 ▲/▼ 버튼 대신 깔끔한 복제(📋)와 삭제(-) 버튼 유지
      item.innerHTML = `
        <div class="slide-item-header">
          <span class="slide-number">슬라이드 ${idx + 1}</span>
          <div class="slide-header-actions">
            <button class="slide-action-btn" onclick="window.duplicateSlide(${idx}, event)" title="슬라이드 복제">📚</button>
            <button class="slide-del-btn" onclick="window.deleteSlide(${idx}, event)" title="슬라이드 삭제">❌</button>
          </div>
        </div>
        <div class="slide-thumb" id="slideThumb-${idx}">
          <img src="${thumbImgSrc}" class="slide-thumb-img" alt="슬라이드 ${idx + 1} 미리보기">
        </div>
      `;
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
      item.classList.toggle('active', idx === currentSlideIndex);
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

  // [요청 반영 2]: 새 슬라이드 생성 시 넉넉한 가로폭(width: 1520)을 기본 탑재하여 글자 잘림 방지
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
    deckData.slides.push(newSlide);
    renderSlideList();
    loadSlide(deckData.slides.length - 1);
    showToast('새 슬라이드가 추가되었습니다.');
  };

  window.deleteSlide = function (idx, e) {
    if (e) e.stopPropagation();
    if (deckData.slides.length <= 1) {
      showToast('최소 1개의 슬라이드는 유지되어야 합니다.');
      return;
    }
    deckData.slides.splice(idx, 1);
    if (currentSlideIndex >= deckData.slides.length) {
      currentSlideIndex = deckData.slides.length - 1;
    }
    renderSlideList();
    loadSlide(currentSlideIndex);
    showToast(`슬라이드 ${idx + 1}이(가) 삭제되었습니다.`);
  };

  window.updateProjectTitle = function (newTitle) {
    deckData.title = newTitle.trim() || 'Presentation';
    saveCurrentSlideState();
  };

  // ================= 17. [요청 반영 1, 2]: 색상 변환 및 PPTX 1:1 완벽 내보내기 =================
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
      alert('PptxGenJS 라이브러리가 로드되지 않았습니다.');
      return;
    }

    const pptx = new PptxGenJS();
    pptx.layout = 'LAYOUT_16x9';

    const PX_PER_INCH = 192;
    const PT_PER_PX = 72 / 192;

    deckData.slides.forEach(s => {
      const slide = pptx.addSlide();
      
      if (s.background) {
        slide.background = { color: sanitizeColorToHex(s.background, 'FFFFFF') };
      }

      (s.elements || []).forEach(el => {
        const leftPx = el.left || 0;
        const topPx = el.top || 0;
        const widthPx = el.width || 0;
        const heightPx = el.height || 0;

        const x = leftPx / PX_PER_INCH;
        const y = topPx / PX_PER_INCH;

        if (el.type === 'text') {
          const textLen = (el.text || '').length;
          const fontSizePx = el.fontSize || 24;
          const fontSizePt = Math.max(8, Math.round(fontSizePx * PT_PER_PX));
          const fontFace = el.fontFamily || '맑은 고딕';

          // [가로 너비 1:1 완벽 보존]:
          // 편집창(Fabric)에 지정된 width가 있으면 그 값을 100% 최우선 신뢰하여 유지합니다.
          // 임의로 폭이 늘어나면 가운데 정렬(center)의 중심축이 오른쪽으로 쏠리거나 카드 밖으로 튀어나갑니다.
          let finalWidthPx = widthPx;
          if (!finalWidthPx || finalWidthPx <= 0) {
            finalWidthPx = Math.ceil(textLen * fontSizePx * 1.15) + 40;
          }
          // 슬라이드 도화지(1920) 우측 경계를 초과하지 않도록 안전 클램핑
          finalWidthPx = Math.min(finalWidthPx, Math.max(80, CANVAS_WIDTH - leftPx));

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

          if (hasActualStyles) {
            // 부분 스타일이 있는 경우 TextRuns로 분할
            const textRuns = [];
            const lines = (el.text || '').split('\n');

            lines.forEach((lineText, lineIdx) => {
              if (lineIdx > 0) {
                textRuns.push({ text: '\n' });
              }
              const lineStyle = el.styles[lineIdx] || {};
              let currentRunText = '';
              let currentRunColor = baseColorHex;
              let currentRunBold = el.fontWeight === 'bold';

              for (let charIdx = 0; charIdx < lineText.length; charIdx++) {
                const char = lineText[charIdx];
                const charStyle = lineStyle[charIdx] || {};
                const charColor = charStyle.fill ? sanitizeColorToHex(charStyle.fill, baseColorHex) : baseColorHex;
                const charBold = charStyle.fontWeight ? charStyle.fontWeight === 'bold' : (el.fontWeight === 'bold');

                if (charColor !== currentRunColor || charBold !== currentRunBold) {
                  if (currentRunText) {
                    textRuns.push({
                      text: currentRunText,
                      options: {
                        color: currentRunColor,
                        bold: currentRunBold,
                        fontSize: fontSizePt,
                        fontFace: fontFace
                      }
                    });
                  }
                  currentRunText = char;
                  currentRunColor = charColor;
                  currentRunBold = charBold;
                } else {
                  currentRunText += char;
                }
              }
              if (currentRunText) {
                textRuns.push({
                  text: currentRunText,
                  options: {
                    color: currentRunColor,
                    bold: currentRunBold,
                    fontSize: fontSizePt,
                    fontFace: fontFace
                  }
                });
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
              line: el.stroke && (el.strokeWidth !== undefined ? el.strokeWidth > 0 : false) ? { color: sanitizeColorToHex(el.stroke, '000000'), width: Math.max(0.25, Math.round(el.strokeWidth * 100) / 100) } : undefined
            });
          } else {
            // 단일 스타일 텍스트: 글자색, 중앙정렬, 폰트 완벽 반영
            slide.addText(el.text || '', {
              x: x,
              y: y,
              w: w,
              h: h,
              fontSize: fontSizePt,
              fontFace: fontFace,
              color: baseColorHex,
              bold: el.fontWeight === 'bold',
              italic: el.fontStyle === 'italic',
              underline: !!el.underline,
              align: el.align || 'left',
              valign: 'top',
              margin: 0,
              wrap: true,
              fill: el.backgroundColor && el.backgroundColor !== 'transparent' ? { color: sanitizeColorToHex(el.backgroundColor, 'FFFFFF') } : undefined,
              line: el.stroke && (el.strokeWidth !== undefined ? el.strokeWidth > 0 : false) ? { color: sanitizeColorToHex(el.stroke, '000000'), width: Math.max(0.25, Math.round(el.strokeWidth * 100) / 100) } : undefined
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
            rectRadius: el.rx ? 0.12 : undefined
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
          const w = Math.max((el.width || 300) / PX_PER_INCH, 0.4);
          slide.addShape(pptx.shapes.LINE, {
            x: x,
            y: y,
            w: w,
            h: 0,
            line: { color: sanitizeColorToHex(el.stroke || '#2563EB', '2563EB'), width: Math.max(0.25, Math.round((el.strokeWidth !== undefined ? el.strokeWidth : 2) * 100) / 100) }
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
          slide.addShape(pptx.shapes.RECTANGLE_CALLOUT || pptx.shapes.ROUNDED_RECTANGLE, {
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

          // [기현쌤 요청 반영]: 편집기에서 설정한 colWidths와 rowHeights를 인치 단위로 1:1 정확하게 변환
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

          const pptxTableRows = tableRows.map((row, rIdx) => {
            const isHeader = (rIdx === 0);
            return row.map((cellText, cIdx) => {
              const key = `${rIdx}_${cIdx}`;
              const defaultFill = isHeader ? '1E293B' : (rIdx % 2 === 1 ? 'FFFFFF' : 'F8FAFC');
              const defaultColor = isHeader ? 'FFFFFF' : '334155';
              const cellFill = (el.cellFills && el.cellFills[key]) ? sanitizeColorToHex(el.cellFills[key], defaultFill) : defaultFill;
              const cellColor = (el.cellColors && el.cellColors[key]) ? sanitizeColorToHex(el.cellColors[key], defaultColor) : defaultColor;
              const cellBorderColor = (el.cellBorderColors && el.cellBorderColors[key]) ? sanitizeColorToHex(el.cellBorderColors[key], 'CBD5E1') : 'CBD5E1';
              const cellBorderWidth = (el.cellBorderWidths && el.cellBorderWidths[key] !== undefined) ? el.cellBorderWidths[key] : 1;

              const fontFace = (el.cellFonts && el.cellFonts[key]) || el.tableFontFamily || '맑은 고딕';
              const cellFontPx = (el.cellFontSizes && el.cellFontSizes[key]) || (isHeader ? 20 : 18);
              const fontSizePt = Math.max(8, Math.round(cellFontPx * PT_PER_PX));
              const isBold = (el.cellBolds && el.cellBolds[key] !== undefined) ? el.cellBolds[key] : isHeader;
              const isItalic = !!(el.cellItalics && el.cellItalics[key]);
              const isUnder = !!(el.cellUnderlines && el.cellUnderlines[key]);
              const align = (el.cellAligns && el.cellAligns[key]) || 'center';

              // [기현쌤 요청 반영]: 파워포인트 표준 pt 단위 1:1 직접 전달
              const borderPt = cellBorderWidth === 0
                ? 0
                : Math.max(0.25, cellBorderWidth);

              return {
                text: String(cellText),
                options: {
                  fill: { color: cellFill },
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
                }
              };
            });
          });

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
          // [기현쌤 요청 반영]: 실제 동영상 파일(base64 DataURL)이 있으면 PPTX 진짜 미디어 객체로 임베딩
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
            // [기현쌤 요청 반영]: 단순 박스도형이 아닌, 실제 플레이어 UI와 제목/재생 버튼이 완벽히 렌더링된 비디오 카드
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

    const fileName = `${deckData.title || 'Presentation'}.pptx`;
    pptx.writeFile({ fileName: fileName }).then(() => {
      showToast(`'${fileName}'이(가) 다운로드 폴더(Downloads)에 저장되었습니다!`);
    });
  };

  // ================= 18. 유틸리티 & 토스트 =================
  function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2800);
  }

  window.loadDeckData = function (data) {
    if (data && data.slides) {
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
      loadSlide(0);
      showToast('슬라이드 문서를 불러왔습니다.');
    }
  };

  // [기현쌤 요청 반영]: 실시간 자동 저장된 내용을 초기화하고 새 문서로 시작
  window.resetToDefaultDeck = function () {
    if (confirm('현재 작업 중인 슬라이드를 초기화하고 기본 템플릿으로 되돌리시겠습니까?\n(로컬에 자동 저장된 내용이 초기화됩니다)')) {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}
      location.reload();
    }
  };

  // VS Code Extension 양방향 통신 수신 (에이전트가 .slide.json 수정 시 즉시 캔버스 리렌더링)
  window.addEventListener('message', function (event) {
    const msg = event.data;
    if (msg && msg.type === 'updateDoc' && msg.deck) {
      window.loadDeckData(msg.deck);
    }
  });

  window.addEventListener('DOMContentLoaded', initCanvas);
})();
